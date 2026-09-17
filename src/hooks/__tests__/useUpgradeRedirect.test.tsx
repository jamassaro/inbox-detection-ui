import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { useUpgradeRedirect } from '../useUpgradeRedirect';
import { readUpgradeContext } from '../../lib/upgradeContext';

/** Records the live router location so navigation assertions can read it. */
const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
};

/** Harness: a button that redirects with the context the test chooses. */
const RedirectButton = ({
  source,
  discoveryId,
}: {
  source: string;
  discoveryId?: string;
}) => {
  const { redirectToUpgrade } = useUpgradeRedirect();
  return (
    <button type="button" onClick={() => redirectToUpgrade({ source, discoveryId })}>
      go
    </button>
  );
};

const renderHarness = (props: { source: string; discoveryId?: string }) =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/app/discoveries/dsc_42?tab=evidence']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <RedirectButton {...props} />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );

describe('useUpgradeRedirect', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it('saves the context (returnPath defaults to the live location) and navigates to /upgrade?from=', async () => {
    renderHarness({ source: 'locked_discovery', discoveryId: 'dsc_42' });
    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(screen.getByTestId('location').textContent).toBe('/upgrade?from=locked_discovery');
    expect(readUpgradeContext()).toEqual({
      source: 'locked_discovery',
      returnPath: '/app/discoveries/dsc_42?tab=evidence',
      discoveryId: 'dsc_42',
    });
  });

  it('navigates with the source as the from param', async () => {
    renderHarness({ source: 'chat_limit' });
    await userEvent.click(screen.getByRole('button', { name: 'go' }));

    expect(screen.getByTestId('location').textContent).toBe('/upgrade?from=chat_limit');
  });

  it('honors an explicit returnPath over the live location', async () => {
    const ExplicitReturn = () => {
      const { redirectToUpgrade } = useUpgradeRedirect();
      return (
        <button
          type="button"
          onClick={() => redirectToUpgrade({ source: 'reminder', returnPath: '/app/subscriptions' })}
        >
          go
        </button>
      );
    };

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/somewhere/else']}>
          <Routes>
            <Route path="*" element={<ExplicitReturn />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'go' }));
    expect(readUpgradeContext()).toEqual({
      source: 'reminder',
      returnPath: '/app/subscriptions',
    });
  });
});
