import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import AgentStatusBadge from '../AgentStatusBadge';
import { deriveAgentStatus, getScanAge } from '../../lib/agentStatus';
import i18n from '../../i18n';

/** 2026-09-17T12:00:00Z — fixed clock for deterministic relative ages. */
const NOW = Date.parse('2026-09-17T12:00:00Z');
const minutesAgo = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

const renderBadge = (props: Parameters<typeof AgentStatusBadge>[0]) =>
  render(
    <I18nextProvider i18n={i18n}>
      <AgentStatusBadge {...props} />
    </I18nextProvider>,
  );

describe('AgentStatusBadge', () => {
  afterEach(async () => {
    cleanup();
    await i18n.changeLanguage('en');
  });

  it('renders Active with the relative last-scan time (minutes)', () => {
    renderBadge({ connected: true, lastSync: minutesAgo(8), now: NOW });

    expect(screen.getByText('Active — Last scan: 8 min ago')).toBeTruthy();
  });

  it('uses plural hour and day phrasing for older scans', () => {
    renderBadge({ connected: true, lastSync: minutesAgo(2 * 60), now: NOW });
    expect(screen.getByText('Active — Last scan: 2 hrs ago')).toBeTruthy();

    cleanup();

    renderBadge({ connected: true, lastSync: minutesAgo(3 * 24 * 60), now: NOW });
    expect(screen.getByText('Active — Last scan: 3 days ago')).toBeTruthy();
  });

  it('renders bare Active when connected but never scanned', () => {
    renderBadge({ connected: true, lastSync: null, now: NOW });

    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.queryByText(/Last scan/)).toBeNull();
  });

  it('renders Investigating with a pulsing dot', () => {
    const { container } = renderBadge({ connected: true, lastSync: null, isInvestigating: true, now: NOW });

    expect(screen.getByText('Investigating...')).toBeTruthy();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders Needs attention with the new-discovery count', () => {
    renderBadge({ connected: true, lastSync: null, newDiscoveryCount: 3, now: NOW });

    expect(screen.getByText('Needs attention (3 new)')).toBeTruthy();
  });

  it('renders Monitoring paused and Not connected', () => {
    renderBadge({ connected: true, lastSync: null, isMonitoringPaused: true, now: NOW });
    expect(screen.getByText('Monitoring paused')).toBeTruthy();

    cleanup();

    renderBadge({ connected: false, lastSync: null, now: NOW });
    expect(screen.getByText('Not connected')).toBeTruthy();
  });

  it('renders translated variants in ES', async () => {
    await i18n.changeLanguage('es');

    renderBadge({ connected: true, lastSync: minutesAgo(8), now: NOW });
    expect(screen.getByText('Activo — Último escaneo: hace 8 min')).toBeTruthy();

    cleanup();

    renderBadge({ connected: true, lastSync: null, newDiscoveryCount: 2, now: NOW });
    expect(screen.getByText('Necesita atención (2 nuevas)')).toBeTruthy();

    cleanup();

    renderBadge({ connected: false, lastSync: null, now: NOW });
    expect(screen.getByText('No conectado')).toBeTruthy();
  });
});

describe('deriveAgentStatus', () => {
  const base = { connected: true, lastSync: null };

  it('prioritizes the in-flight investigation over everything', () => {
    expect(
      deriveAgentStatus({ ...base, isInvestigating: true, connected: false, isMonitoringPaused: true }),
    ).toBe('investigating');
  });

  it('prioritizes the disconnected state over counts and pause', () => {
    expect(deriveAgentStatus({ ...base, connected: false, newDiscoveryCount: 4, isMonitoringPaused: true })).toBe(
      'notConnected',
    );
  });

  it('reports Needs attention only for a positive count', () => {
    expect(deriveAgentStatus({ ...base, newDiscoveryCount: 1 })).toBe('needsAttention');
    expect(deriveAgentStatus({ ...base, newDiscoveryCount: 0 })).toBe('active');
    expect(deriveAgentStatus({ ...base, newDiscoveryCount: null })).toBe('active');
  });

  it('reports Monitoring paused for a healthy, quiet connection', () => {
    expect(deriveAgentStatus({ ...base, isMonitoringPaused: true })).toBe('monitoringPaused');
  });

  it('defaults to Active', () => {
    expect(deriveAgentStatus({ ...base })).toBe('active');
  });
});

describe('getScanAge', () => {
  it('returns null without a parseable lastSync', () => {
    expect(getScanAge(null, NOW)).toBeNull();
    expect(getScanAge('not-a-date', NOW)).toBeNull();
  });

  it('floors at one minute (no zero or negative ages under clock skew)', () => {
    expect(getScanAge(new Date(NOW - 10_000).toISOString(), NOW)).toEqual({ unit: 'min', count: 1 });
    expect(getScanAge(new Date(NOW + 5 * 60_000).toISOString(), NOW)).toEqual({ unit: 'min', count: 1 });
  });

  it('buckets minutes, hours, and days', () => {
    expect(getScanAge(minutesAgo(8), NOW)).toEqual({ unit: 'min', count: 8 });
    expect(getScanAge(minutesAgo(90), NOW)).toEqual({ unit: 'hour', count: 1 });
    expect(getScanAge(minutesAgo(30 * 60), NOW)).toEqual({ unit: 'day', count: 1 });
    expect(getScanAge(minutesAgo(36 * 60), NOW)).toEqual({ unit: 'day', count: 1 });
  });
});
