import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppLayout from '../AppLayout';
import { apiFetch } from '../../lib/apiClient';
import { LocaleProvider } from '../../contexts/LocaleProvider';
import i18n from '../../i18n';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn().mockResolvedValue({ connected: false, email: null, lastSync: null }),
}));

const mockApiFetch = vi.mocked(apiFetch);

describe('AppLayout', () => {
  afterEach(() => {
    cleanup();
    mockApiFetch.mockClear();
  });

  it('renders the sidebar beside a scrollable main region that hosts the routed page', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <LocaleProvider>
            <MemoryRouter initialEntries={['/app/dashboard']}>
              <Routes>
                <Route path="/app" element={<AppLayout />}>
                  <Route path="dashboard" element={<div>dash-content</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </LocaleProvider>
        </I18nextProvider>
      </QueryClientProvider>,
    );

    // Sidebar chrome…
    expect(screen.getByText('Inbox Detective')).toBeTruthy();
    // …and the routed page inside <main>.
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main?.className).toContain('flex-1');
    expect(main?.className).toContain('overflow-auto');
    expect(screen.getByText('dash-content')).toBeTruthy();
    // The shell fills the viewport on the gray-50 canvas.
    const shell = main?.parentElement;
    expect(shell?.className).toContain('h-screen');
    expect(shell?.className).toContain('bg-gray-50');
  });
});
