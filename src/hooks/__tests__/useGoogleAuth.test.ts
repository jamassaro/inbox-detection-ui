import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETURN_PATH_STORAGE_KEY, useGoogleAuth } from '../useGoogleAuth';
import { stubWindowLocation } from '../../test-utils';

describe('useGoogleAuth', () => {
  let location: ReturnType<typeof stubWindowLocation>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    location = stubWindowLocation();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.clear();
  });

  afterEach(() => {
    consoleError.mockRestore();
    sessionStorage.clear();
    vi.unstubAllEnvs();
    location.restore();
  });

  it('redirects to the backend Google auth endpoint and stores the returnPath', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const { result } = renderHook(() => useGoogleAuth());

    const started = result.current.startGoogleAuth({ returnPath: '/app/dashboard' });

    expect(started).toBe(true);
    expect(location.href).toBe('https://api.example.test/auth/google');
    expect(sessionStorage.getItem(RETURN_PATH_STORAGE_KEY)).toBe('/app/dashboard');
  });

  it('skips storage and navigates when no returnPath is given', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const { result } = renderHook(() => useGoogleAuth());

    const started = result.current.startGoogleAuth();

    expect(started).toBe(true);
    expect(location.href).toBe('https://api.example.test/auth/google');
    expect(sessionStorage.getItem(RETURN_PATH_STORAGE_KEY)).toBeNull();
  });

  it('logs a clear error, navigates nowhere, and stores nothing when VITE_API_BASE_URL is unset', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const { result } = renderHook(() => useGoogleAuth());

    const started = result.current.startGoogleAuth({ returnPath: '/app/dashboard' });

    // The guard must short-circuit BEFORE the storage write — a stale
    // returnPath from a failed start must not redirect a later sign-in.
    expect(started).toBe(false);
    expect(location.href).toBe('');
    expect(sessionStorage.getItem(RETURN_PATH_STORAGE_KEY)).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('VITE_API_BASE_URL is not configured'),
    );
  });

  it('never navigates off-site even when the caller passes a foreign returnPath', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const { result } = renderHook(() => useGoogleAuth());

    result.current.startGoogleAuth({ returnPath: 'https://evil.example' });

    // Storage accepts the caller's intent; consumeReturnPath (the read side)
    // is the security boundary that rejects off-site values.
    expect(sessionStorage.getItem(RETURN_PATH_STORAGE_KEY)).toBe('https://evil.example');
    expect(location.href).toBe('https://api.example.test/auth/google');
  });
});
