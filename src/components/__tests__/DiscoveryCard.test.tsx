import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import DiscoveryCard from '../DiscoveryCard';
import type { Discovery, DiscoveryType } from '../../types';

/** FE-011 catalog labels (en) — the badges must show these, never the enum. */
const TYPE_LABELS: Record<DiscoveryType, string> = {
  subscription: 'Subscription',
  renewal: 'Renewal',
  trial_expiration: 'Trial ending',
  price_change: 'Price change',
  bill_change: 'Bill change',
  credit: 'Credit',
  refund: 'Refund',
  reward: 'Reward',
  expiration: 'Expiration',
  cashback: 'Cashback',
  meeting: 'Meeting request',
  action_required: 'Action required',
};

const buildDiscovery = (overrides: Partial<Discovery> = {}): Discovery => ({
  id: 'disc-1',
  type: 'subscription',
  title: 'AI-generated title rendered as-is',
  summary: 'AI-generated summary rendered as-is',
  company: 'Netflix',
  companyInitials: 'NE',
  importance: 'medium',
  status: 'new',
  locked: false,
  availableActions: ['remind', 'dismiss'],
  ...overrides,
});

const renderCard = (discovery: Discovery, onAction = vi.fn(), compact = false) =>
  render(
    <I18nextProvider i18n={i18n}>
      <DiscoveryCard discovery={discovery} onAction={onAction} compact={compact} />
    </I18nextProvider>,
  );

describe('DiscoveryCard', () => {
  afterEach(() => {
    cleanup();
    void i18n.changeLanguage('en');
  });

  it('renders for all 12 DiscoveryType values with a translated type badge', () => {
    (Object.keys(TYPE_LABELS) as DiscoveryType[]).forEach((type) => {
      renderCard(buildDiscovery({ type }));

      expect(screen.getByTestId('discovery-card')).toBeTruthy();
      const badge = screen.getByTestId('type-badge');
      expect(badge.textContent).toBe(TYPE_LABELS[type]);
      // The raw backend enum value must never surface as UI copy.
      expect(badge.textContent).not.toBe(type);

      cleanup();
    });
  });

  it('renders the AI-generated title as-is, never through t()', () => {
    renderCard(buildDiscovery({ title: 'Hulu renews at $17.99 → $18.99 next week' }));
    expect(screen.getByText('Hulu renews at $17.99 → $18.99 next week')).toBeTruthy();
  });

  it('shows a currency-formatted amount row with the frequency suffix', () => {
    renderCard(buildDiscovery({ amount: 15.49, currency: 'USD', frequency: 'monthly' }));
    const row = screen.getByTestId('amount-row');
    expect(row.textContent).toContain('$15.49');
    expect(row.textContent).toContain('month');
  });

  it('renders the amount badge green for positive amounts', () => {
    renderCard(buildDiscovery({ amount: 15.49, currency: 'USD' }));
    expect(screen.getByTestId('amount-badge').className).toContain('bg-green-100');
  });

  it('hides the amount row when the discovery has no amount', () => {
    renderCard(buildDiscovery({ amount: undefined, frequency: undefined }));
    expect(screen.queryByTestId('amount-row')).toBeNull();
  });

  it('shows a locale-formatted date row with the importance indicator', () => {
    renderCard(
      buildDiscovery({ date: '2026-10-03T12:00:00Z', importance: 'high' }),
    );
    const row = screen.getByTestId('date-row');
    expect(row.textContent).toContain('October 3, 2026');
    expect(row.textContent).toContain('High priority');
    expect(screen.getByTestId('importance-indicator').className).toContain('text-red-600');
  });

  it('hides the date row when the discovery has no date', () => {
    renderCard(buildDiscovery({ date: undefined }));
    expect(screen.queryByTestId('date-row')).toBeNull();
  });

  it('shows the price-change row with was→now and a red diff for an increase', () => {
    renderCard(
      buildDiscovery({ amount: 17.99, previousAmount: 13.99, currency: 'USD' }),
    );
    const row = screen.getByTestId('price-change-row');
    expect(row.textContent).toContain('$13.99');
    expect(row.textContent).toContain('$17.99');
    const diff = screen.getByTestId('price-diff');
    expect(diff.textContent).toBe('+$4.00');
    expect(diff.className).toContain('bg-red-100');
    expect(diff.className).toContain('text-red-700');
  });

  it('color-codes savings green in the price-change row', () => {
    renderCard(
      buildDiscovery({ amount: 13.99, previousAmount: 17.99, currency: 'USD' }),
    );
    const diff = screen.getByTestId('price-diff');
    expect(diff.textContent).toBe('-$4.00');
    expect(diff.className).toContain('bg-green-100');
    expect(diff.className).toContain('text-green-700');
  });

  it('hides the price-change row when there is no previous amount', () => {
    renderCard(buildDiscovery({ amount: 17.99, previousAmount: undefined }));
    expect(screen.queryByTestId('price-change-row')).toBeNull();
  });

  it('renders at most 1 primary + 2 secondary actions via getDiscoveryActionKey', () => {
    renderCard(
      buildDiscovery({
        availableActions: ['remind', 'dismiss', 'view_source', 'ask_detective'],
      }),
    );
    const buttons = Array.from(
      screen.getByTestId('actions-row').querySelectorAll('button'),
    );
    expect(buttons).toHaveLength(3);
    expect(buttons[0]!.className).toContain('bg-gray-900');
    expect(buttons[0]!.textContent).toBe('Remind me');
    buttons.slice(1).forEach((button) => {
      expect(button.className).toContain('border-gray-200');
    });
    expect(buttons[1]!.textContent).toBe('Dismiss');
    expect(buttons[2]!.textContent).toBe('View source email');
  });

  it('invokes onAction with the clicked action', async () => {
    const onAction = vi.fn();
    renderCard(
      buildDiscovery({ availableActions: ['remind', 'dismiss'] }),
      onAction,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('dismiss');
    await userEvent.click(screen.getByRole('button', { name: 'Remind me' }));
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenLastCalledWith('remind');
  });

  it('renders the compact variant without crashing', () => {
    renderCard(buildDiscovery(), vi.fn(), true);
    expect(screen.getByTestId('discovery-card')).toBeTruthy();
  });

  it('renders the Spanish type badge when the locale is es', async () => {
    await i18n.changeLanguage('es');
    renderCard(buildDiscovery({ type: 'price_change' }));
    expect(screen.getByTestId('type-badge').textContent).toBe('Cambio de precio');
  });
});
