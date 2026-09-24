import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../hooks/useLocale';
import { useToast } from '../hooks/useToast';
import { useUpgradeRedirect } from '../hooks/useUpgradeRedirect';
import {
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useRescheduleReminder,
  type ReminderWire,
} from '../hooks/useReminders';
import { formatDate } from '../lib/formatting';
import {
  buildCustomReminderIso,
  buildReminderOptions,
  toLocalInputValues,
  type ReminderOption,
  type ReminderOptionKind,
} from '../lib/reminderOptions';
import ConfirmModal from './ConfirmModal';
import Modal from './Modal';
import RequiresPro from './RequiresPro';

export interface ReminderModalProps {
  discoveryId: string;
  /** ISO event date of the discovery — anchors the "N days before" options. */
  discoveryDate?: string;
  /**
   * Discovery title — prefills the reminder title. The backend REQUIRES a
   * title (1–200 chars); the FE-020 ticket's prop list omits it, so surfaces
   * pass the discovery's own title through (documented delta).
   */
  discoveryTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

/** Default time-of-day for the custom date input (FE-020: native inputs, V1). */
const DEFAULT_CUSTOM_TIME = '09:00';

/**
 * Inline paywall shown to Free users inside the modal. Same look and copy as
 * <UpgradePrompt>, but the CTA persists the richer resumption context
 * (discoveryId + pendingAction: 'create_reminder') the post-upgrade flow needs to drop
 * the user back into THIS modal — the shared component's CTA carries neither.
 */
const ReminderUpgradeFallback = ({ discoveryId }: { discoveryId: string }) => {
  const { t } = useTranslation('billing');
  const { redirectToUpgrade } = useUpgradeRedirect();

  return (
    <div
      className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl p-4"
      data-testid="upgrade-prompt"
    >
      <p className="text-sm text-gray-600">
        {t('requiresPro.message', { feature: t('requiresPro.feature.reminders') })}
      </p>
      <button
        type="button"
        onClick={() =>
          redirectToUpgrade({
            source: 'reminder',
            returnPath: `/app/discoveries/${discoveryId}`,
            discoveryId,
            pendingAction: 'create_reminder',
          })
        }
        className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
      >
        {t('requiresPro.cta')}
      </button>
    </div>
  );
};

interface ReminderFormProps {
  discoveryId: string;
  discoveryTitle?: string;
  discoveryDate?: string;
  /** Soonest pending reminder for this discovery, when one exists. */
  existing: ReminderWire | undefined;
  onClose: () => void;
}

/**
 * The Pro half of the modal: reminder options, create/reschedule/cancel.
 * Rendered only for entitled users (via <RequiresPro>).
 */
const ReminderForm = ({
  discoveryId,
  discoveryTitle,
  discoveryDate,
  existing,
  onClose,
}: ReminderFormProps) => {
  const { t } = useTranslation('reminders');
  const { locale } = useLocale();
  const toast = useToast();

  const [title, setTitle] = useState(existing?.title ?? discoveryTitle ?? '');
  const [selected, setSelected] = useState<ReminderOptionKind>('tomorrow');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState(DEFAULT_CUSTOM_TIME);
  /** Edit mode: prefilled from the existing reminder; submit reschedules. */
  const [editing, setEditing] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const create = useCreateReminder();
  const reschedule = useRescheduleReminder();
  const cancelReminder = useDeleteReminder();
  const mutating = create.isPending || reschedule.isPending || cancelReminder.isPending;

  const options = buildReminderOptions(discoveryDate, new Date());

  const startEdit = () => {
    if (!existing) return;
    const inputs = toLocalInputValues(existing.remindAt);
    setCustomDate(inputs.date);
    setCustomTime(inputs.time || DEFAULT_CUSTOM_TIME);
    setSelected('custom');
    setEditing(true);
    setInlineError(null);
  };

  /** Resolves the selected option to an ISO timestamp, or null when invalid. */
  const resolveRemindAt = (): string | null => {
    if (selected === 'custom') {
      return buildCustomReminderIso(customDate, customTime);
    }
    return options.find((option) => option.kind === selected)?.remindAt ?? null;
  };

  const submit = () => {
    setInlineError(null);
    const remindAt = resolveRemindAt();
    if (remindAt === null) {
      setInlineError(t('errors.invalidDate'));
      return;
    }
    if (!editing && title.trim() === '') {
      setInlineError(t('errors.titleRequired'));
      return;
    }
    if (editing && existing) {
      reschedule.mutate(
        { id: existing.id, remindAt },
        {
          onSuccess: () => {
            toast.success(t('confirmation.updated', { date: formatDate(remindAt, locale) }));
            onClose();
          },
          onError: () => setInlineError(t('errors.update')),
        },
      );
      return;
    }
    create.mutate(
      { discoveryId, title: title.trim(), remindAt },
      {
        onSuccess: () => {
          toast.success(t('confirmation.set', { date: formatDate(remindAt, locale) }));
          onClose();
        },
        onError: () => setInlineError(t('errors.create')),
      },
    );
  };

  const cancelExisting = () => {
    if (!existing) return;
    cancelReminder.mutate(existing.id, {
      onSuccess: () => {
        setCancelOpen(false);
        setEditing(false);
        toast.success(t('confirmation.cancelled'));
      },
      onError: () => {
        setCancelOpen(false);
        toast.error(t('errors.cancel'));
      },
    });
  };

  const optionLabel = (option: ReminderOption): string =>
    option.count === undefined ? t(option.labelKey) : t(option.labelKey, { count: option.count });

  return (
    <div data-testid="reminder-form">
      {existing !== undefined && !editing && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-gray-50 border border-gray-200 p-3"
          data-testid="existing-reminder"
        >
          <p className="text-sm text-gray-700">
            {t('existing.setFor', { date: formatDate(existing.remindAt, locale) })} ✓
          </p>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={startEdit}
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {t('existing.edit')}
            </button>
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              {t('existing.cancel')}
            </button>
          </span>
        </div>
      )}

      {!editing && (
        <div className="mb-4">
          <label htmlFor="reminder-title" className="block text-sm font-medium text-gray-700">
            {t('modal.titleLabel')}
          </label>
          <input
            id="reminder-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('modal.titlePlaceholder')}
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      )}

      <p className="text-sm font-medium text-gray-700">
        {editing ? t('modal.optionsHeadingEdit') : t('modal.optionsHeading')}
      </p>
      <div className="mt-2 space-y-2" role="radiogroup" aria-label={t('modal.optionsHeading')}>
        {options.map((option) => (
          <button
            key={option.kind}
            type="button"
            role="radio"
            aria-checked={selected === option.kind}
            disabled={option.disabled}
            data-testid="reminder-option"
            onClick={() => setSelected(option.kind)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              selected === option.kind
                ? 'border-gray-900 bg-gray-50 font-medium'
                : 'border-gray-200 hover:bg-gray-50'
            } ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className="block">{optionLabel(option)}</span>
            <span className="block text-xs text-gray-500">{formatDate(option.remindAt, locale)}</span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={selected === 'custom'}
          data-testid="reminder-option"
          onClick={() => setSelected('custom')}
          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
            selected === 'custom'
              ? 'border-gray-900 bg-gray-50 font-medium'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="block">{t('options.custom')}</span>
        </button>
      </div>

      {selected === 'custom' && (
        <div className="mt-3 grid grid-cols-2 gap-3" data-testid="custom-date-inputs">
          <div>
            <label htmlFor="reminder-date" className="block text-xs text-gray-500">
              {t('options.dateLabel')}
            </label>
            <input
              id="reminder-date"
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label htmlFor="reminder-time" className="block text-xs text-gray-500">
              {t('options.timeLabel')}
            </label>
            <input
              id="reminder-time"
              type="time"
              value={customTime}
              onChange={(event) => setCustomTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>
      )}

      {inlineError !== null && (
        <p className="mt-3 text-sm text-red-600" data-testid="reminder-error" role="alert">
          {inlineError}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={mutating}
          data-testid="reminder-submit"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {editing ? t('modal.update') : t('modal.set')}
        </button>
      </div>

      <ConfirmModal
        isOpen={cancelOpen}
        title={t('existing.confirmCancelTitle')}
        message={t('existing.confirmCancelMessage')}
        confirmLabel={t('existing.cancel')}
        onCancel={() => setCancelOpen(false)}
        onConfirm={cancelExisting}
        variant="destructive"
      />
    </div>
  );
};

/**
 * "Remind me" dialog for a discovery (FE-020). Free users see the upgrade
 * prompt inline (with full post-upgrade resumption context); Pro users see
 * reminder options and create/edit/cancel reminders against `/reminders`.
 * Must be rendered inside ToastProvider and EntitlementProvider.
 */
const ReminderModal = ({
  discoveryId,
  discoveryDate,
  discoveryTitle,
  isOpen,
  onClose,
}: ReminderModalProps) => {
  const { t } = useTranslation('reminders');

  // GET /reminders?status=pending, filtered to this discovery client-side
  // (BE-031 has no discoveryId param). The list is remindAt-asc, so [0] is
  // the soonest pending reminder for the discovery.
  const { reminders } = useReminders(discoveryId);
  const existing = reminders[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modal.title')}>
      <RequiresPro
        feature="reminders"
        fallback={<ReminderUpgradeFallback discoveryId={discoveryId} />}
      >
        <ReminderForm
          discoveryId={discoveryId}
          discoveryTitle={discoveryTitle}
          discoveryDate={discoveryDate}
          existing={existing}
          onClose={onClose}
        />
      </RequiresPro>
    </Modal>
  );
};

export default ReminderModal;
