import { useTranslation } from 'react-i18next';
import ActionButton from './ActionButton';
import Modal from './Modal';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  /** Defaults to the translated `buttons.confirm` copy. */
  confirmLabel?: string;
  /** Defaults to the translated `buttons.cancel` copy. */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** `destructive` renders a red confirm button. */
  variant?: 'default' | 'destructive';
}

/**
 * Confirmation dialog built on Modal. Escape and backdrop clicks route to
 * `onCancel`, so every close path cancels the pending action.
 */
const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmModalProps) => {
  const { t } = useTranslation('common');

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="text-sm text-gray-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <ActionButton variant="secondary" onClick={onCancel}>
          {cancelLabel ?? t('buttons.cancel')}
        </ActionButton>
        <ActionButton
          variant={variant === 'destructive' ? 'destructive' : 'primary'}
          onClick={onConfirm}
        >
          {confirmLabel ?? t('buttons.confirm')}
        </ActionButton>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
