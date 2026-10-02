import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import DetectivePanel from '../components/DetectivePanel';
import ExtensionApp from '../components/ExtensionApp';
import { UnauthenticatedError } from '../services/api';
import type { Discovery } from '../../src/types';

const api = vi.hoisted(() => ({ fetchRecentDiscoveries: vi.fn(), openAppPath: vi.fn() }));
vi.mock('../services/api', async (orig) => ({ ...(await orig<typeof import('../services/api')>()), ...api }));

const discovery: Discovery = {
  id: 'd1',
  type: 'subscription',
  title: 'Netflix renews soon',
  summary: '',
  company: 'Netflix',
  companyInitials: 'N',
  amount: 15.49,
  currency: 'USD',
  importance: 'medium',
  status: 'new',
  createdAt: new Date().toISOString(),
  locked: false,
  availableActions: [],
  callToActions: null,
};

const renderPanel = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient()}>
        <DetectivePanel locale="en" onClose={vi.fn()} />
      </QueryClientProvider>
    </I18nextProvider>,
  );

beforeEach(() => {
  api.fetchRecentDiscoveries.mockReset();
  api.openAppPath.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DetectivePanel', () => {
  it('shows a loading state, then discoveries, and opens the detail page on click', async () => {
    api.fetchRecentDiscoveries.mockResolvedValue([discovery]);
    renderPanel();
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: /Netflix/ }));
    expect(screen.getByText('Netflix renews soon')).toBeTruthy();
    expect(api.openAppPath).toHaveBeenCalledWith('/app/discoveries/d1');
  });

  it('shows the empty state with an Open Dashboard action', async () => {
    api.fetchRecentDiscoveries.mockResolvedValue([]);
    renderPanel();
    await screen.findByText('Nothing new yet');
    await userEvent.click(screen.getByRole('button', { name: 'Open Dashboard' }));
    expect(api.openAppPath).toHaveBeenCalledWith('/app/dashboard');
  });

  it('shows a compact error with retry', async () => {
    api.fetchRecentDiscoveries.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);
    renderPanel();
    await screen.findByText("Couldn't load discoveries.");
    expect(screen.queryByText('boom')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Nothing new yet');
  });

  it('shows the signed-out state', async () => {
    api.fetchRecentDiscoveries.mockRejectedValue(new UnauthenticatedError());
    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect(api.openAppPath).toHaveBeenCalledWith('/app/dashboard');
  });
});

describe('ExtensionApp', () => {
  it('toggles via the launcher and closes on Escape', async () => {
    api.fetchRecentDiscoveries.mockResolvedValue([]);
    render(<ExtensionApp launcherContainer={null} />);
    const launcher = screen.getByRole('button', { name: 'Open Inbox Detective' });
    await userEvent.click(launcher);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(launcher);
    await userEvent.click(launcher);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
