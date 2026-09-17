import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

/** Anchor for the focus trap — the ticket mandates a `[data-modal-content]` query. */
export const MODAL_CONTENT_SELECTOR = '[data-modal-content]';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Base modal rendered in a portal on document.body. Hand-rolled focus trap
 * (no library): focus moves into the dialog on open, Tab/Shift+Tab cycle
 * within it, and focus returns to the trigger on close. Closes on Escape
 * and on backdrop click.
 */
const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  const { t } = useTranslation('common');
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    const modal = document.querySelector<HTMLElement>(MODAL_CONTENT_SELECTOR);
    if (!modal) return undefined;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const getFocusable = () =>
      Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const focusables = getFocusable();
    (focusables[0] ?? modal).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = getFocusable();
      if (elements.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (active === last && !event.shiftKey) {
        event.preventDefault();
        first.focus();
      } else if ((active === first || active === modal) && event.shiftKey) {
        event.preventDefault();
        last.focus();
      } else if (!elements.includes(active as HTMLElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        data-testid="modal-backdrop"
        aria-hidden="true"
        className="fixed inset-0 bg-gray-900/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-modal-content
        tabIndex={-1}
        className="relative mx-auto mt-24 w-full max-w-md rounded-lg bg-white p-6 shadow-xl focus:outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('buttons.close')}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
