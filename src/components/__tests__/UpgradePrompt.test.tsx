import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import UpgradePrompt from '../UpgradePrompt';
import { readUpgradeContext } from '../../lib/upgradeContext';

/** Records the live router location so navigation assertions can read it. */
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

const renderPrompt = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/app/chat']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <UpgradePrompt feature="reminders" />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );

describe('UpgradePrompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    void i18n.changeLanguage('en');
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('renders the English copy by default', () => {
    renderPrompt();
    expect(screen.getByText('Reminders requires Pro.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unlock with Pro' })).toBeTruthy();
  });

  it('renders the Spanish copy when the locale is es', async () => {
    await i18n.changeLanguage('es');
    renderPrompt();
    expect(screen.getByText('Recordatorios requiere Pro.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desbloquear con Pro' })).toBeTruthy();
  });

  it('navigates to /upgrade?from= and persists the context (returnPath in sessionStorage)', async () => {
    renderPrompt();
    await userEvent.click(screen.getByRole('button', { name: 'Unlock with Pro' }));

    expect(screen.getByTestId('location').textContent).toBe('/upgrade?from=reminders');
    expect(readUpgradeContext()).toEqual({
      source: 'reminders',
      returnPath: '/app/chat',
    });
  });
});
