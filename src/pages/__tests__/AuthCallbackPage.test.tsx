import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthCallbackPage from '../AuthCallbackPage';
import { apiFetch } from '../../lib/apiClient';
import { stubWindowLocation } from '../../test-utils';
import type { User } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthCallbackPage />
    </QueryClientProvider>,
  );
};

describe('AuthCallbackPage', () => {
  let location: ReturnType<typeof stubWindowLocation>;

  beforeEach(() => {
    location = stubWindowLocation();
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    location.restore();
  });

  it('redirects to / with an error param when no code is present', async () => {
    // stub default: window.location.search === ''
    renderPage();
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith('/?error=auth'));
    expect(mockApiFetch).not.toHaveBeenCalled();
expect(screen.getByRole('status')).toBeTruthy();
  });

  it('redirects to /onboarding on session success without Gmail connected', async () => {
    window.location.search = '?code=abc';
    const user: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };
    mockApiFetch.mockResolvedValueOnce(user);
    renderPage();
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith('/onboarding'));
  });

  it('redirects to /app/dashboard when Gmail is already connected', async () => {
    window.location.search = '?code=abc';
    mockApiFetch.mockResolvedValueOnce({ id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1', gmailConnected: true });
    renderPage();
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith('/app/dashboard'));
  });

  it('redirects to / with an error param when the session check fails', async () => {
    window.location.search = '?code=abc';
    mockApiFetch.mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await waitFor(() => expect(location.replace).toHaveBeenCalledWith('/?error=auth'));
  });
});
