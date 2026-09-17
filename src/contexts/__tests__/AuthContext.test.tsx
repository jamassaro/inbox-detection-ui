import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../AuthContext';
import { useAuth } from '../../hooks/useAuth';
import { AUTH_EXPIRED_EVENT, apiFetch } from '../../lib/apiClient';
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
    expect(mockApiFetch).toHaveBeenCalledWith('/auth/me');
  });

  it('failed session check yields unauthenticated state', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('401'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
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
