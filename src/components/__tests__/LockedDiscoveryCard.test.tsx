import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import LockedDiscoveryCard from '../LockedDiscoveryCard';

const renderCard = (count: number, onUpgrade = vi.fn()) =>
  render(
    <I18nextProvider i18n={i18n}>
      <LockedDiscoveryCard count={count} onUpgrade={onUpgrade} />
    </I18nextProvider>,
  );

describe('LockedDiscoveryCard', () => {
  afterEach(() => {
    cleanup();
    void i18n.changeLanguage('en');
  });

  it('renders the count, lock icon, category hint, and upgrade CTA', () => {
    renderCard(5);
    expect(screen.getByTestId('locked-count').textContent).toBe(
      '5 more discoveries 🔒',
    );
    expect(screen.getByTestId('locked-category-hint').textContent).toBe(
      'Subscriptions, credits, and more',
    );
    // Lock icon renders as an inline SVG (lucide Lock).
    expect(screen.getByTestId('locked-discovery-card').querySelector('svg')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlock with Pro' })).toBeTruthy();
  });

  it('uses the singular form for one locked discovery', () => {
    renderCard(1);
    expect(screen.getByTestId('locked-count').textContent).toBe(
      '1 more discovery 🔒',
    );
  });

  it('calls onUpgrade when the CTA is clicked', async () => {
    const onUpgrade = vi.fn();
    renderCard(5, onUpgrade);
    await userEvent.click(screen.getByTestId('locked-cta'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('renders Spanish copy when the locale is es', async () => {
    await i18n.changeLanguage('es');
    renderCard(5);
    expect(screen.getByTestId('locked-count').textContent).toBe(
      '5 descubrimientos más 🔒',
    );
    expect(screen.getByTestId('locked-category-hint').textContent).toBe(
      'Suscripciones, créditos y más',
    );
    expect(screen.getByRole('button', { name: 'Desbloquear con Pro' })).toBeTruthy();
  });
});
