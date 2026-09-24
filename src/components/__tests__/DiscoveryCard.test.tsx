import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
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
  availableActions: ['create_reminder', 'dismiss'],
  callToActions: null,
  ...overrides,
});

const renderCard = (discovery: Discovery, onAction = vi.fn(), compact = false) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <DiscoveryCard discovery={discovery} onAction={onAction} compact={compact} />
      </MemoryRouter>
    </I18nextProvider>,
  );

describe('DiscoveryCard', () => {
  afterEach(() => {
    cleanup();
    void i18n.changeLanguage('en');
  });

  it('renders a repeated secondary action once so the action-row keys stay unique', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // A duplicated action in the wire payload must not yield two identical
    // buttons (duplicate React keys): the secondary row dedupes.
    renderCard(buildDiscovery({ availableActions: ['dismiss', 'create_reminder', 'create_reminder'] }));

    expect(screen.getByTestId('card-primary-action')).toBeTruthy();
    expect(screen.getAllByTestId('card-secondary-action-create_reminder')).toHaveLength(1);
    const duplicateKeyWarning = errorSpy.mock.calls.find((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('key')),
    );
    expect(duplicateKeyWarning).toBeUndefined();
    errorSpy.mockRestore();
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
        availableActions: ['create_reminder', 'dismiss', 'check_availability', 'investigate'],
      }),
    );
    const buttons = Array.from(
      screen.getByTestId('actions-row').querySelectorAll('button'),
    );
    // View button is always first, then 1 primary + up to 2 secondary = 4 total.
    expect(buttons).toHaveLength(4);
    expect(buttons[0]!.textContent).toBe('View');
    expect(buttons[1]!.className).toContain('bg-gray-900');
    expect(buttons[1]!.textContent).toBe('Remind me');
    buttons.slice(2).forEach((button) => {
      expect(button.className).toContain('border-gray-200');
    });
    expect(buttons[2]!.textContent).toBe('Dismiss');
    expect(buttons[3]!.textContent).toBe('Find a time');
  });

  it('excludes view_evidence from the primary/secondary slots — it would just duplicate the View button', () => {
    renderCard(buildDiscovery({ availableActions: ['view_evidence', 'create_reminder', 'dismiss'] }));
    const buttons = Array.from(screen.getByTestId('actions-row').querySelectorAll('button'));

    expect(buttons.map((b) => b.textContent)).not.toContain('View evidence');
    expect(buttons).toHaveLength(3); // View + create_reminder (primary) + dismiss (secondary)
  });

  it('excludes open_provider from the primary/secondary slots — it gets its own CTA row', () => {
    renderCard(
      buildDiscovery({
        availableActions: ['open_provider', 'create_reminder', 'dismiss'],
        callToActions: [{ label: 'Shop the sale', url: 'https://example.com/sale' }],
      }),
    );
    const buttons = Array.from(
      screen.getByTestId('actions-row').querySelectorAll('button'),
    );
    // View + create_reminder (primary) + dismiss (secondary) — open_provider
    // never occupies a primary/secondary slot, so both real actions fit.
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.textContent)).not.toContain('Open in provider');
  });

  it('invokes onAction with the clicked action', async () => {
    const onAction = vi.fn();
    renderCard(
      buildDiscovery({ availableActions: ['create_reminder', 'dismiss'] }),
      onAction,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('dismiss');
    await userEvent.click(screen.getByRole('button', { name: 'Remind me' }));
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenLastCalledWith('create_reminder');
  });

  describe('call-to-action links', () => {
    it('renders nothing when callToActions is null', () => {
      renderCard(buildDiscovery({ callToActions: null }));
      expect(screen.queryByTestId('cta-row')).toBeNull();
    });

    it('renders one link per entry, as real external links, label rendered as-is', () => {
      renderCard(
        buildDiscovery({
          availableActions: ['open_provider', 'dismiss'],
          callToActions: [
            { label: 'Shop comfort', url: 'https://ctrk.klclick.com/l/01M34PCNRHE8S463RD9QXHHEKY_7' },
            { label: 'Redeem your points', url: 'https://example.com/rewards' },
          ],
        }),
      );

      const links = screen.getAllByTestId('cta-link') as HTMLAnchorElement[];
      expect(links).toHaveLength(2);
      expect(links[0]!.textContent).toContain('Shop comfort');
      expect(links[0]!.getAttribute('href')).toBe(
        'https://ctrk.klclick.com/l/01M34PCNRHE8S463RD9QXHHEKY_7',
      );
      expect(links[0]!.getAttribute('target')).toBe('_blank');
      expect(links[0]!.getAttribute('rel')).toContain('noopener');
      expect(links[1]!.textContent).toContain('Redeem your points');
    });
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
