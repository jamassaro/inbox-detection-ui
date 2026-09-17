import { useContext } from 'react';
import { ToastContext } from '../contexts/toastContext';
import type { ToastContextValue } from '../contexts/toastContext';

/** Toast accessor — must be used within a ToastProvider (see src/contexts/ToastContext.tsx). */
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
