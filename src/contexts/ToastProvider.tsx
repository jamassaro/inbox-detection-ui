import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ToastContext } from './toastContext';
import type { ToastContextValue, ToastItem, ToastVariant } from './toastContext';
import { TOAST_AUTO_DISMISS_MS, TOAST_MAX_VISIBLE } from './toastContext';

const TOAST_ICONS: Record<ToastVariant, LucideIcon> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

const TOAST_ACCENT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-green-500 text-green-700',
  error: 'border-red-500 text-red-700',
  info: 'border-blue-500 text-blue-700',
};

export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Toast host rendered through a portal at a fixed bottom-right position on
 * document.body (avoids z-index clashes). The container carries role="status"
 * so screen readers announce messages. Keeps at most TOAST_MAX_VISIBLE
 * toasts (oldest dropped first); each auto-dismisses after
 * TOAST_AUTO_DISMISS_MS.
 */
export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const add = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextIdRef.current;
      nextIdRef.current += 1;
      setToasts((previous) =>
        [...previous, { id, variant, message }].slice(-TOAST_MAX_VISIBLE),
      );
      timersRef.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => add('success', message),
      error: (message) => add('error', message),
      info: (message) => add('info', message),
    }),
    [add],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
        >
          {toasts.map((toast) => {
            const Icon = TOAST_ICONS[toast.variant];
            return (
              <div
                key={toast.id}
                data-testid={`toast-${toast.variant}`}
                className={`flex items-start gap-2 rounded-lg border-l-4 bg-white p-3 shadow-lg ${TOAST_ACCENT_CLASSES[toast.variant]}`}
              >
                <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-gray-900">{toast.message}</span>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};
