import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ToastContext';
import { TOAST_AUTO_DISMISS_MS, TOAST_MAX_VISIBLE } from '../toastContext';
import { useToast } from '../../hooks/useToast';

const Probe = () => {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success('Saved!')}>add-success</button>
      <button type="button" onClick={() => toast.error('Failed!')}>add-error</button>
      <button type="button" onClick={() => toast.info('Heads up!')}>add-info</button>
    </div>
  );
};

let counter = 0;
const CountingProbe = () => {
  const toast = useToast();
  const [, bump] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        counter += 1;
        bump((value) => value + 1);
        toast.success(`Message ${counter}`);
      }}
    >
      add
    </button>
  );
};

const renderWithToasts = (component: React.ReactElement) =>
  render(<ToastProvider>{component}</ToastProvider>);

beforeEach(() => {
  vi.useFakeTimers();
  counter = 0;
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('ToastContext', () => {
  it('renders toasts in a role=status bottom-right portal on document.body', () => {
    renderWithToasts(<Probe />);

    fireEvent.click(screen.getByRole('button', { name: 'add-success' }));

    const container = screen.getByRole('status');
    expect(screen.getByText('Saved!')).toBeTruthy();
    expect(container.className).toContain('bottom-4');
    expect(container.className).toContain('right-4');
    expect(document.body.contains(container)).toBe(true);
  });

  it('renders error and info variants with distinct test ids', () => {
    renderWithToasts(<Probe />);

    fireEvent.click(screen.getByRole('button', { name: 'add-error' }));
    fireEvent.click(screen.getByRole('button', { name: 'add-info' }));

    expect(screen.getByTestId('toast-error')).toBeTruthy();
    expect(screen.getByTestId('toast-info')).toBeTruthy();
    expect(screen.getByText('Failed!')).toBeTruthy();
    expect(screen.getByText('Heads up!')).toBeTruthy();
  });

  it('auto-dismisses toasts after TOAST_AUTO_DISMISS_MS', () => {
    renderWithToasts(<Probe />);

    fireEvent.click(screen.getByRole('button', { name: 'add-success' }));
    expect(screen.getByText('Saved!')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS - 1);
    });
    expect(screen.getByText('Saved!')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Saved!')).toBeNull();
  });

  it('keeps at most TOAST_MAX_VISIBLE toasts, dropping the oldest', () => {
    renderWithToasts(<CountingProbe />);
    const add = screen.getByRole('button', { name: 'add' });

    for (let i = 0; i < TOAST_MAX_VISIBLE + 1; i += 1) {
      fireEvent.click(add);
    }

    expect(screen.getAllByTestId('toast-success')).toHaveLength(TOAST_MAX_VISIBLE);
    expect(screen.queryByText('Message 1')).toBeNull();
    expect(screen.getByText('Message 2')).toBeTruthy();
  });

  it('throws from useToast when the provider is missing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Orphan = () => {
      useToast();
      return null;
    };

    try {
      expect(() => render(<Orphan />)).toThrow(
        'useToast must be used within a ToastProvider',
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
