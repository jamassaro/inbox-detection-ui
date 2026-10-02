import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import DemoBanner from '../DemoBanner';
import { DEMO_STORAGE_KEY } from '../../lib/demoMode';

const renderBanner = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <DemoBanner />
    </I18nextProvider>,
  );

describe('DemoBanner', () => {
  const assign = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    assign.mockReset();
    vi.stubEnv('VITE_USE_MOCKS', 'false');
    vi.stubGlobal('location', { ...window.location, assign });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders nothing outside demo mode', () => {
    renderBanner();
    expect(screen.queryByTestId('demo-banner')).toBeNull();
  });

  it('shows the notice in demo mode and exits to the landing page', async () => {
    sessionStorage.setItem(DEMO_STORAGE_KEY, 'true');
    renderBanner();

    expect(screen.getByTestId('demo-banner').textContent).toContain('sample data');
    await userEvent.click(screen.getByRole('button', { name: 'Exit demo' }));
    expect(sessionStorage.getItem(DEMO_STORAGE_KEY)).toBeNull();
    expect(assign).toHaveBeenCalledWith('/');
  });
});
