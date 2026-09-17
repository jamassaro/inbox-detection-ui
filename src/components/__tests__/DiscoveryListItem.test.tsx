import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import DiscoveryListItem from '../DiscoveryListItem';
import type { Discovery } from '../../types';

/** Records the live router location so navigation assertions can read it. */
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

const buildDiscovery = (overrides: Partial<Discovery> = {}): Discovery => ({
  id: 'disc-1',
  type: 'subscription',
  title: 'AI-generated title rendered as-is',
  summary: 'AI-generated summary',
  company: 'Netflix',
  companyInitials: 'NE',
  importance: 'medium',
  status: 'new',
  locked: false,
  availableActions: ['remind', 'dismiss'],
  ...overrides,
});

const renderListItem = (discovery: Discovery, onAction = vi.fn()) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/app/discoveries']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <DiscoveryListItem discovery={discovery} onAction={onAction} />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );

describe('DiscoveryListItem', () => {
  afterEach(() => {
    cleanup();
    void i18n.changeLanguage('en');
  });

  it('renders the company, AI title, formatted amount, and date fields', () => {
    renderListItem(
      buildDiscovery({
        title: 'Spotify raised your plan to $12.99',
        company: 'Spotify',
        companyInitials: 'SP',
        amount: 12.99,
        currency: 'USD',
        frequency: 'monthly',
        date: '2026-09-10',
      }),
    );
    expect(screen.getByText('Spotify')).toBeTruthy();
    expect(screen.getByText('Spotify raised your plan to $12.99')).toBeTruthy();
    expect(screen.getByTestId('list-item-avatar').textContent).toBe('SP');
    const meta = screen.getByTestId('list-item-meta');
    expect(meta.textContent).toContain('$12.99');
    expect(meta.textContent).toContain('September 10, 2026');
  });

  it('renders the type icon with the FE-011 meta treatment', () => {
    renderListItem(buildDiscovery({ type: 'price_change' }));
    const icon = screen.getByTestId('type-icon');
    // FE-011 price_change treatment: TrendingUp icon in amber.
    expect(icon.className).toContain('bg-amber-100');
    expect(icon.querySelector('svg')).toBeTruthy();
  });

  it('renders the importance badge', () => {
    renderListItem(buildDiscovery({ importance: 'low' }));
    const badge = screen.getByTestId('importance-indicator');
    expect(badge.textContent).toContain('Low priority');
    expect(badge.className).toContain('text-gray-500');
  });

  it('navigates to the discovery detail page on click', async () => {
    renderListItem(buildDiscovery({ id: 'disc-42' }));
    await userEvent.click(screen.getByTestId('discovery-list-item'));
    expect(screen.getByTestId('location').textContent).toBe('/app/discoveries/disc-42');
  });

  it('invokes onAction for the primary action without navigating', async () => {
    const onAction = vi.fn();
    renderListItem(
      buildDiscovery({ id: 'disc-42', availableActions: ['remind', 'dismiss'] }),
      onAction,
    );
    await userEvent.click(screen.getByTestId('list-item-primary-action'));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('remind');
    expect(screen.getByTestId('location').textContent).toBe('/app/discoveries');
  });
});
