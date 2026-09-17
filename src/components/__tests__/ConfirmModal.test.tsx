import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import ConfirmModal from '../ConfirmModal';

const renderConfirm = (props: Partial<Parameters<typeof ConfirmModal>[0]> = {}) => {
  const onConfirm = props.onConfirm ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();

  render(
    <I18nextProvider i18n={i18n}>
      <ConfirmModal
        isOpen
        title="Delete offer"
        message="This cannot be undone."
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />
    </I18nextProvider>,
  );

  return { onConfirm, onCancel };
};

afterEach(cleanup);

describe('ConfirmModal', () => {
  it('renders the message with translated default labels', () => {
    renderConfirm();

    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('invokes onConfirm and onCancel from the buttons', () => {
    const { onConfirm, onCancel } = renderConfirm();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape and backdrop click (Modal onClose routes to onCancel)', () => {
    const { onCancel } = renderConfirm();

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('uses custom labels when provided', () => {
    renderConfirm({ confirmLabel: 'Delete it', cancelLabel: 'Keep it' });

    expect(screen.getByRole('button', { name: 'Delete it' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeTruthy();
  });

  it('renders a red confirm button in the destructive variant', () => {
    renderConfirm({ variant: 'destructive' });

    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm.className).toContain('bg-red-600');

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.className).not.toContain('bg-red-600');
  });

  it('renders a dark confirm button in the default variant', () => {
    renderConfirm();
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm.className).toContain('bg-gray-900');
    expect(confirm.className).not.toContain('bg-red-600');
  });
});
