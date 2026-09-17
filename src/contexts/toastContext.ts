import { createContext } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

export interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export const TOAST_MAX_VISIBLE = 3;
export const TOAST_AUTO_DISMISS_MS = 4000;
