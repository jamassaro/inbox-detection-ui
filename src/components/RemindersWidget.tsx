import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import ErrorState from './ErrorState';
import { useLocale } from '../hooks/useLocale';
import { useToast } from '../hooks/useToast';
import { useAllReminders, useDeleteReminder } from '../hooks/useReminders';
import type { ReminderStatus, ReminderWire } from '../hooks/useReminders';
import { formatDate } from '../lib/formatting';

type Tab = 'upcoming' | 'history';

/** Translated label for a History row's status badge (pending never appears in History). */
const STATUS_LABEL_KEY: Record<Exclude<ReminderStatus, 'pending'>, string> = {
  sent: 'widget.status.sent',
  cancelled: 'widget.status.cancelled',
  failed: 'widget.status.failed',
};

/**
 * One reminder row. Upcoming rows get a Cancel button; History rows get a
 * status badge instead. `discoveryId` is only absent for a reminder no
 * current UI can actually produce (every real creation path — ReminderModal
 * — requires one) — handled defensively rather than designed around.
 */
const ReminderRow = ({
  reminder,
  onClose,
  onRequestCancel,
}: {
  reminder: ReminderWire;
  onClose: () => void;
  onRequestCancel: (reminder: ReminderWire) => void;
}) => {
  const { t } = useTranslation('reminders');
  const { locale } = useLocale();

  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2.5" data-testid="reminder-row">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{reminder.title}</p>
        <p className="text-xs text-gray-500">{formatDate(reminder.remindAt, locale)}</p>
        {reminder.discoveryId && (
          <Link
            to={`/app/discoveries/${reminder.discoveryId}`}
            onClick={onClose}
            className="text-xs font-medium text-gray-700 underline-offset-2 hover:underline"
          >
            {t('widget.viewDiscovery')}
          </Link>
        )}
      </div>
      {reminder.status === 'pending' ? (
        <button
          type="button"
          onClick={() => onRequestCancel(reminder)}
          data-testid="reminder-cancel"
          className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700"
        >
          {t('existing.cancel')}
        </button>
      ) : (
        <span
          data-testid="reminder-status-badge"
          className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
        >
          {t(STATUS_LABEL_KEY[reminder.status])}
        </span>
      )}
    </li>
  );
};

/**
 * Reminders widget: a bell icon in the Sidebar header that expands into a
 * popover listing every reminder (Upcoming/History), with Cancel on
 * upcoming ones. Mirrors ScanStatusWidget's collapsed-icon + toggleable-
 * panel shape, but nested inside Sidebar's header row (a dropdown, not a
 * fixed-position overlay) since it belongs to that chrome, not the page.
 *
 * Rescheduling is not done here — a reminder's "View discovery" link goes
 * back to the discovery, where the existing "Remind me" flow already
 * detects and edits the pending reminder (ReminderModal). Free users can
 * open this and cancel an existing reminder (GET/DELETE aren't Pro-gated,
 * only creating one is) — there's just no create entry point here.
 */
const RemindersWidget = () => {
  const { t } = useTranslation('reminders');
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<ReminderWire | null>(null);

  const { data, isPending, isError, refetch } = useAllReminders();
  const cancelReminder = useDeleteReminder();

  const reminders = data?.reminders ?? [];
  const upcoming = reminders.filter((r) => r.status === 'pending');
  // Server sorts remindAt ascending; History reads better most-recent-first.
  const history = reminders.filter((r) => r.status !== 'pending').slice().reverse();
  const rows = tab === 'upcoming' ? upcoming : history;

  const confirmCancel = () => {
    if (!cancelTarget) return;
    cancelReminder.mutate(cancelTarget.id, {
      onSuccess: () => {
        setCancelTarget(null);
        toast.success(t('confirmation.cancelled'));
      },
      onError: () => {
        setCancelTarget(null);
        toast.error(t('errors.cancel'));
      },
    });
  };

  let panelBody: ReactNode;
  if (isPending) {
    panelBody = (
      <div aria-hidden="true" className="space-y-2 px-3 py-2.5">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
      </div>
    );
  } else if (isError) {
    panelBody = (
      <div className="p-3">
        <ErrorState title={t('widget.error')} onRetry={() => void refetch()} />
      </div>
    );
  } else if (rows.length === 0) {
    panelBody = (
      <p className="px-3 py-4 text-sm text-gray-500">
        {tab === 'upcoming' ? t('widget.empty.upcoming') : t('widget.empty.history')}
      </p>
    );
  } else {
    panelBody = (
      <ul className="divide-y divide-gray-100">
        {rows.map((reminder) => (
          <ReminderRow
            key={reminder.id}
            reminder={reminder}
            onClose={() => setOpen(false)}
            onRequestCancel={setCancelTarget}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('widget.title')}
        data-testid="reminders-widget-toggle"
        className="relative flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white hover:text-gray-900"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {upcoming.length > 0 && (
          <span
            data-testid="reminders-widget-badge"
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
          >
            {upcoming.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-full top-0 z-40 ml-2 w-72 rounded-xl border border-gray-200 bg-white shadow-xl"
          data-testid="reminders-widget-panel"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2.5">
            <span className="text-sm font-semibold text-gray-900">{t('widget.title')}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('buttons.close', { ns: 'common' })}
              className="text-gray-400 transition-colors hover:text-gray-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex gap-1 px-3 pt-2.5" role="tablist">
            {(['upcoming', 'history'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                data-testid={`reminders-tab-${key}`}
                onClick={() => setTab(key)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  tab === key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t(`widget.tabs.${key}`)}
              </button>
            ))}
          </div>

          <div className="mt-2 max-h-80 overflow-y-auto">{panelBody}</div>
        </div>
      )}

      <ConfirmModal
        isOpen={cancelTarget !== null}
        title={t('existing.confirmCancelTitle')}
        message={t('existing.confirmCancelMessage')}
        confirmLabel={t('existing.cancel')}
        variant="destructive"
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
};

export default RemindersWidget;
