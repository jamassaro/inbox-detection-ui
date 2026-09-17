import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import Modal from '../Modal';

afterEach(cleanup);

const renderModal = (onClose: () => void) =>
  render(
    <I18nextProvider i18n={i18n}>
      <Modal isOpen onClose={onClose} title="Delete offer">
        <p>Body content</p>
        <button type="button">Save</button>
      </Modal>
    </I18nextProvider>,
  );

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Modal isOpen={false} onClose={() => {}} title="Hidden">
          <p>invisible</p>
        </Modal>
      </I18nextProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders dialog semantics with a title reference', () => {
    renderModal(vi.fn());

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(
      screen.getByText('Delete offer').id,
    );
    expect(dialog.getAttribute('data-modal-content')).toBe('true');
  });

  it('focuses the first focusable element on open', () => {
    renderModal(vi.fn());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on backdrop click but not on clicks inside the dialog', () => {
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.click(screen.getByText('Body content'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab and Shift+Tab focus inside the dialog', () => {
    renderModal(vi.fn());

    const dialog = screen.getByRole('dialog');
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
    expect(focusables).toHaveLength(2);

    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);

    focusables[0].focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });
});
