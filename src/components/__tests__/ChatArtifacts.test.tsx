import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import ChatArtifactList from '../ChatArtifacts';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import type { ChatArtifact } from '../../hooks/useChat';
import i18n from '../../i18n';

const renderArtifacts = (artifacts: ChatArtifact[]) =>
  render(
    <I18nextProvider i18n={i18n}>
      <LocaleProvider>
        <MemoryRouter>
          <ChatArtifactList artifacts={artifacts} />
        </MemoryRouter>
      </LocaleProvider>
    </I18nextProvider>,
  );

describe('ChatArtifactList', () => {
  afterEach(() => {
    cleanup();
    void i18n.changeLanguage('en');
  });

  it('renders nothing for an empty array — the common case, not the edge case', () => {
    const { container } = renderArtifacts([]);
    expect(container.querySelector('[data-testid="chat-artifacts"]')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('renders a company card, omitting bestOffer when absent', () => {
    renderArtifacts([
      {
        type: 'company',
        data: {
          companyEntityId: 'co-1',
          name: 'Everlane',
          offerCount: 1,
          lastSeenAt: '2026-09-24T16:01:39.877Z',
        },
      },
    ]);

    const card = screen.getByTestId('artifact-company');
    expect(card.textContent).toContain('Everlane');
    expect(card.textContent).toContain('1 offer on file');
    expect(card.textContent).not.toContain('Best offer');
  });

  it('renders a company card with a formatted bestOffer when present', () => {
    renderArtifacts([
      {
        type: 'company',
        data: {
          companyEntityId: 'co-1',
          name: 'Everlane',
          offerCount: 3,
          bestOffer: { value: 25, unit: 'USD' },
          lastSeenAt: '2026-09-24T16:01:39.877Z',
        },
      },
    ]);

    expect(screen.getByTestId('artifact-company').textContent).toContain('Best offer: $25.00');
  });

  it('renders an offer card linking to its discovery, with unit-aware value formatting', () => {
    renderArtifacts([
      {
        type: 'offer',
        data: {
          discoveryId: 'disc-1',
          companyEntityId: 'co-1',
          company: 'Everlane',
          value: 70,
          unit: 'percent',
          expiresAt: '2026-09-23T00:00:00.000Z',
          historicalBest: true,
        },
      },
    ]);

    const card = screen.getByTestId('artifact-offer');
    expect(card.textContent).toContain('Everlane');
    expect(card.textContent).toContain('70% off');
    expect(card.textContent).toContain('Best ever');
    expect(card.textContent).toContain('Expires');
    expect((card as HTMLAnchorElement).getAttribute('href')).toBe('/app/discoveries/disc-1');
  });

  it('formats a points-unit offer distinctly from currency/percent', () => {
    renderArtifacts([
      {
        type: 'offer',
        data: {
          discoveryId: 'disc-2',
          companyEntityId: 'co-2',
          company: 'Delta',
          value: 934,
          unit: 'points',
          historicalBest: false,
        },
      },
    ]);

    expect(screen.getByTestId('artifact-offer').textContent).toContain('934 points');
    expect(screen.queryByTestId('artifact-historical-best')).toBeNull();
  });

  it('falls back to a raw "value unit" string for an unrecognized unit instead of crashing', () => {
    renderArtifacts([
      {
        type: 'offer',
        data: {
          discoveryId: 'disc-3',
          companyEntityId: 'co-3',
          company: 'Mystery Co',
          value: 12,
          unit: 'not_a_real_unit',
          historicalBest: false,
        },
      },
    ]);

    expect(screen.getByTestId('artifact-offer').textContent).toContain('12 not_a_real_unit');
  });

  it('renders an offer-history card, oldest first, each row linking to its discovery', () => {
    renderArtifacts([
      {
        type: 'offer_history',
        data: {
          companyEntityId: 'co-1',
          company: 'Everlane',
          offers: [
            { discoveryId: 'disc-old', date: '2026-06-01T00:00:00.000Z', value: 20, unit: 'percent' },
            { discoveryId: 'disc-new', date: '2026-09-01T00:00:00.000Z', value: 70, unit: 'percent', best: true },
          ],
        },
      },
    ]);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]!.getAttribute('href')).toBe('/app/discoveries/disc-old');
    expect(links[1]!.textContent).toContain('70% off');
    expect(links[1]!.textContent).toContain('Best ever');
  });

  it('renders at most 2 artifacts, skipping an unrecognized type without crashing', () => {
    renderArtifacts([
      {
        type: 'company',
        data: { companyEntityId: 'co-1', name: 'Everlane', offerCount: 1, lastSeenAt: '2026-09-24T16:01:39.877Z' },
      },
      // @ts-expect-error — simulating a future artifact type the frontend doesn't know about yet.
      { type: 'unknown_future_type', data: {} },
    ]);

    expect(screen.getByTestId('artifact-company')).toBeTruthy();
    expect(screen.queryByTestId('artifact-offer')).toBeNull();
  });
});
