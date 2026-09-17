import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Discovery } from '../types';
import Modal from './Modal';
import RequiresPro from './RequiresPro';
import { useToast } from '../hooks/useToast';
import {
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useRescheduleReminder,
} from '../hooks/useReminders';
import {
  computeRemindAt,
  defaultCustomInputs,
  minCustomDate,
  type ReminderSelection,
} from '../lib/reminderSchedule';
import { formatMeetingTime } from '../lib/formatting';

/** Days-before options offered when the Discovery has a known event date. */
const DAYS_BEFORE_CHOICES = [1, 2, 3];

interface ReminderModalProps {
  discovery: Discovery;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Reminder create/update/cancel for a Discovery (FE-020).
 *
 * Pro users get the scheduling form (shortcuts + custom date/time); Free
 * users see RequiresPro's upgrade path inside the same dialog. The reminder
 * is matched to the Discovery client-side — BE-031 has no discoveryId
 * filter, so the list is fetched and filtered here.
 */
const ReminderModal = ({ discovery, isOpen, onClose }: ReminderModalProps) => {
  const { t, i18n } = useTranslation('reminders');
  const toast = useToast();

  const { reminders } = useReminders(discovery.id);
  const createReminder = useCreateReminder();
  const rescheduleReminder = useRescheduleReminder();
  const deleteReminder = useDeleteReminder();

  const existing = reminders[0];

  const [selection, setSelection] = useState<ReminderSelection | null>(null);
  const [title, setTitle] = useState(discovery.title);
  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [custom, setCustom] = useState(() => defaultCustomInputs(discovery.date));

  const busy =
    createReminder.isPending || rescheduleReminder.isPending || deleteReminder.isPending;

  const schedule = (at: Date) => {
    const remindAt = at.toISOString();
    if (existing) {
      // PATCH takes remindAt only (BE-031) — the title is immutable after
      // creation, so don't pretend to send it.
      rescheduleReminder.mutate(
        { id: existing.id, remindAt },
        {
          onSuccess: () => {
            toast.success(
              t('confirmation.updated', { date: formatMeetingTime(at, i18n.language) }),
            );
            onClose();
          },
          onError: (error) => {
            console.error('[ReminderModal] reschedule failed', error);
            toast.error(t('errors.update'));
          },
        },
      );
      return;
    }
    createReminder.mutate(
      { discoveryId: discovery.id, title, remindAt },
      {
        onSuccess: () => {
          toast.success(t('confirmation.set', { date: formatMeetingTime(at, i18n.language) }));
          onClose();
        },
        onError: (error) => {
          console.error('[ReminderModal] create failed', error);
          toast.error(t('errors.create'));
        },
      },
    );
  };

  const submit = () => {
    if (title.trim() === '') {
      setFormError(t('errors.titleRequired'));
      return;
    }
    if (selection === null) {
      setFormError(t('errors.invalidDate'));
      return;
    }
    const at = computeRemindAt(selection, discovery.date);
    if (at === null) {
      setFormError(t('errors.invalidDate'));
      return;
    }
    setFormError(null);
    schedule(at);
  };

  const cancelReminder = () => {
    if (!existing) return;
    deleteReminder.mutate(existing.id, {
      onSuccess: () => {
        toast.success(t('confirmation.cancelled'));
        onClose();
      },
      onError: (error) => {
        console.error('[ReminderModal] cancel failed', error);
        toast.error(t('errors.cancel'));
        setConfirmingCancel(false);
      },
    });
  };

  const customSelection: ReminderSelection = {
    kind: 'custom',
    date: custom.date,
    time: custom.time,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modal.title')}>
      <div data-testid="reminder-modal">
        <RequiresPro feature="reminders">
          <p className="text-sm text-gray-600">{discovery.title}</p>

          {existing !== undefined && !editing && !confirmingCancel ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900" data-testid="reminder-existing">
                {t('existing.setFor', {
                  date: formatMeetingTime(new Date(existing.remindAt), i18n.language),
                })}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                >
                  {t('existing.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t('existing.cancel')}
                </button>
              </div>
            </div>
          ) : confirmingCancel ? (
            <div className="mt-4" data-testid="reminder-cancel-confirm">
              <p className="text-sm font-medium text-gray-900">
                {t('existing.confirmCancelTitle')}
              </p>
              <p className="mt-1 text-sm text-gray-600">{t('existing.confirmCancelMessage')}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={cancelReminder}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                >
                  {t('existing.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  disabled={busy}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {t('existing.keep')}
                </button>
              </div>
            </div>
          ) : (
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label className="block text-sm font-medium text-gray-900" htmlFor="reminder-title">
                {t('modal.titleLabel')}
              </label>
              <input
                id="reminder-title"
                type="text"
                value={title}
                disabled={editing}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('modal.titlePlaceholder')}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />

              <p className="mt-4 text-sm font-medium text-gray-900">
                {existing !== undefined && editing
                  ? t('modal.optionsHeadingEdit')
                  : t('modal.optionsHeading')}
              </p>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="reminder-option"
                    checked={selection?.kind === 'tomorrow'}
                    onChange={() => setSelection({ kind: 'tomorrow' })}
                  />
                  {t('options.tomorrow')}
                </label>
                {discovery.date !== undefined &&
                  DAYS_BEFORE_CHOICES.map((days) => (
                    <label key={days} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="reminder-option"
                        checked={selection?.kind === 'days_before' && selection.days === days}
                        onChange={() => setSelection({ kind: 'days_before', days })}
                      />
                      {t('options.daysBefore', { count: days })}
                    </label>
                  ))}
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="reminder-option"
                    checked={selection?.kind === 'custom'}
                    onChange={() => setSelection(customSelection)}
                  />
                  {t('options.custom')}
                </label>
                {selection?.kind === 'custom' ? (
                  <div className="ml-6 flex gap-2">
                    <label className="text-sm text-gray-700">
                      <span className="block">{t('options.dateLabel')}</span>
                      <input
                        type="date"
                        value={custom.date}
                        min={minCustomDate()}
                        onChange={(event) => {
                          setCustom({ ...custom, date: event.target.value });
                          setSelection({
                            kind: 'custom',
                            date: event.target.value,
                            time: custom.time,
                          });
                        }}
                        className="mt-1 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                      />
                    </label>
                    <label className="text-sm text-gray-700">
                      <span className="block">{t('options.timeLabel')}</span>
                      <input
                        type="time"
                        value={custom.time}
                        onChange={(event) => {
                          setCustom({ ...custom, time: event.target.value });
                          setSelection({
                            kind: 'custom',
                            date: custom.date,
                            time: event.target.value,
                          });
                        }}
                        className="mt-1 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              {formError !== null ? (
                <p className="mt-3 text-sm text-red-600" role="alert" data-testid="reminder-error">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {existing !== undefined && editing ? t('modal.update') : t('modal.set')}
              </button>
            </form>
          )}
        </RequiresPro>
      </div>
    </Modal>
  );
};

export default ReminderModal;
