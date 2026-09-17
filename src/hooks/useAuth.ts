import { useContext } from 'react';
import { AuthContext } from '../contexts/authContext';
import type { AuthContextValue } from '../contexts/authContext';

/** Session accessor — must be used within an AuthProvider (see src/contexts/AuthContext.tsx). */
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
