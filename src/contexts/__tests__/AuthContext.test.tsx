import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, SESSION_CHECK_MAX_ATTEMPTS } from '../AuthProvider';
import { useAuth } from '../../hooks/useAuth';
import { AUTH_EXPIRED_EVENT, apiFetch } from '../../lib/apiClient';
import { ApiError } from '../../lib/apiError';
import { stubWindowLocation } from '../../test-utils';
import type { User } from '../../types';

vi.mock('../../lib/apiClient', () => ({
  AUTH_EXPIRED_EVENT: 'auth:expired',
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const testUser: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  let location: ReturnType<typeof stubWindowLocation>;

  beforeEach(() => {
    location = stubWindowLocation();
    mockApiFetch.mockReset();
  });

  afterEach(() => {
    cleanup();
    location.restore();
  });

  it('isLoading is true until GET /auth/me resolves', async () => {
    let resolveSession: (u: User) => void = () => {};
    mockApiFetch.mockImplementation(
      () => new Promise<User>((res) => { resolveSession = res; }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => { resolveSession(testUser); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('ada@example.com');
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/me', { authExpiredEvent: false });
  });

  it('a definitive 401 settles unauthenticated after exactly one check call', async () => {
    // 401 is the logged-out answer, not a recoverable failure: one call, no
    // retries, no auth:expired redirect — the landing page must render.
    mockApiFetch.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'no session'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/me', { authExpiredEvent: false });
    expect(location.replace).not.toHaveBeenCalled();
  });

  it('transient network failures retry a bounded number of times, then settle unauthenticated', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'backend unreachable'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockApiFetch).toHaveBeenCalledTimes(SESSION_CHECK_MAX_ATTEMPTS);
    expect(location.replace).not.toHaveBeenCalled();
  });

  it('recovers when a transient network failure is followed by a successful check', async () => {
    mockApiFetch
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'backend unreachable'))
      .mockResolvedValueOnce(testUser);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it('auth:expired event clears the user and redirects to /', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    });
    expect(result.current.user).toBeNull();
    expect(location.replace).toHaveBeenCalledWith('/');
  });

  it('logout() calls POST /auth/logout, clears state, and redirects to /', async () => {
    mockApiFetch.mockResolvedValueOnce(testUser); // /auth/me
    mockApiFetch.mockResolvedValueOnce(undefined); // /auth/logout
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => { await result.current.logout(); });
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/logout', { method: 'POST' });
    expect(result.current.user).toBeNull();
    expect(location.replace).toHaveBeenCalledWith('/');
  });
});
