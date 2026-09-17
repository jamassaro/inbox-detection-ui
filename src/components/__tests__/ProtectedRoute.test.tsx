import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '../ProtectedRoute';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../types';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/app/dashboard" element={<div>app-shell</div>} />
        </Route>
        <Route path="/" element={<div>landing</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });
  afterEach(cleanup);

  it('renders a loading spinner (translated sr-only text) while the session check runs', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: true, logout: vi.fn() });
    renderAt('/app/dashboard');
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/loading|cargando/i)).toBeTruthy();
  });

  it('redirects unauthenticated users to /', () => {
    mockUseAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false, logout: vi.fn() });
    renderAt('/app/dashboard');
    expect(screen.getByText('landing')).toBeTruthy();
    expect(screen.queryByText('app-shell')).toBeNull();
  });

  it('renders the outlet for authenticated users', () => {
    const user: User = { id: 'u1', name: 'Ada', email: 'ada@example.com', googleId: 'g1' };
    mockUseAuth.mockReturnValue({ user, isAuthenticated: true, isLoading: false, logout: vi.fn() });
    renderAt('/app/dashboard');
    expect(screen.getByText('app-shell')).toBeTruthy();
  });
});
