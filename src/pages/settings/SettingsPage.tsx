import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import ActionButton from '../../components/ActionButton';
import ConfirmModal from '../../components/ConfirmModal';
import ErrorState from '../../components/ErrorState';
import LanguageSelector from '../../components/LanguageSelector';
import RequiresPro from '../../components/RequiresPro';
import { useAuth } from '../../hooks/useAuth';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useGmailStatus } from '../../hooks/useGmailStatus';
import {
  startCalendarConnect,
  useCalendarStatus,
} from '../../hooks/useCalendarStatus';
import { useDisconnectGmail } from '../../hooks/useDisconnectGmail';
import { useDisconnectCalendar } from '../../hooks/useDisconnectCalendar';
import { useLocale } from '../../hooks/useLocale';
import { useToast } from '../../hooks/useToast';
import { formatRelativeDate } from '../../lib/formatting';

/**
 * Settings (FE-023): one place for account details, connected Google
 * services, and billing. Read-only account data comes from AuthContext;
 * connection rows come from the status hooks; disconnects are destructive
 * actions behind ConfirmModal with the ticket's explicit consequence copy.
 *
 * Backend reality note (verified against Inbox-api BE-035): the ticket's
 * `DELETE /gmail/connection` and `DELETE /calendar/connection` do not
 * exist — the disconnect hooks call the real
 * `DELETE /account/disconnect/{gmail,calendar}` endpoints instead.
 */

/** Green/gray connection dot shared by both account rows. */
const StatusDot = ({ connected }: { connected: boolean }) => (
  <span
    className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-green-500' : 'bg-gray-400'}`}
    aria-hidden="true"
  />
);

/** Pulse placeholder shown while a status check resolves. */
const RowSkeleton = ({ testId }: { testId: string }) => (
  <div className="space-y-1.5" data-testid={testId} aria-busy="true">
    <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
    <div className="h-3 w-56 bg-gray-100 rounded animate-pulse" />
  </div>
);

/** Compact inline error with retry, shown when a status check fails. */
const RowError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="mt-2">
    <ErrorState onRetry={onRetry} />
  </div>
);

interface SettingSectionProps {
  testId: string;
  title: string;
  children: ReactNode;
}

/** One section card: title + arbitrary body. */
const SettingSection = ({ testId, title, children }: SettingSectionProps) => (
  <section data-testid={testId} className="bg-white border border-gray-200 rounded-xl p-6">
    <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

const SettingsPage = () => {
  const { t } = useTranslation('settings');
  const { locale } = useLocale();
  const toast = useToast();
  const { user, logout } = useAuth();
  const { plan } = useEntitlements();
  const gmailStatus = useGmailStatus();
  const calendarStatus = useCalendarStatus();
  const disconnectGmail = useDisconnectGmail();
  const disconnectCalendar = useDisconnectCalendar();

  // Which destructive confirmation is open — null closes both modals.
  const [confirming, setConfirming] = useState<'gmail' | 'calendar' | null>(null);

  const gmailConnected = gmailStatus.data?.connected === true;
  const calendarConnected = calendarStatus.data?.connected === true;

  const handleGmailDisconnect = async () => {
    try {
      await disconnectGmail.mutateAsync();
      setConfirming(null);
    } catch {
      // Modal stays open so the user can retry or cancel.
      toast.error(t('errors.disconnectFailed'));
    }
  };

  const handleCalendarDisconnect = async () => {
    try {
      await disconnectCalendar.mutateAsync();
      setConfirming(null);
    } catch {
      toast.error(t('errors.disconnectFailed'));
    }
  };

  const handleCalendarConnect = async () => {
    const started = await startCalendarConnect();
    if (!started) {
      toast.error(t('errors.connectFailed'));
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="settings-page">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      <SettingSection testId="account-section" title={t('account')}>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">{t('accountSection.name')}</dt>
            <dd className="text-gray-900 font-medium" data-testid="account-name">
              {user?.name}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-gray-500">{t('accountSection.email')}</dt>
            <dd className="text-gray-900 font-medium" data-testid="account-email">
              {user?.email}
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <p className="text-sm text-gray-500 mb-1.5">{t('language')}</p>
          <LanguageSelector />
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between gap-4">
          <ActionButton
            variant="secondary"
            onClick={() => void logout()}
            data-testid="logout-button"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            {t('accountSection.logout')}
          </ActionButton>
          <Link
            to="/app/settings/delete"
            data-testid="delete-account-link"
            className="text-sm text-red-600 hover:text-red-700 underline underline-offset-2"
          >
            {t('accountSection.deleteAccount')}
          </Link>
        </div>
      </SettingSection>

      <SettingSection testId="connected-accounts-section" title={t('connectedAccounts')}>
        <ul className="space-y-5">
          <li className="flex items-start justify-between gap-4" data-testid="gmail-row">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{t('gmail.label')}</p>
              {gmailStatus.isLoading ? (
                <RowSkeleton testId="gmail-row-loading" />
              ) : gmailStatus.isError ? (
                <RowError onRetry={() => void gmailStatus.refetch()} />
              ) : gmailConnected ? (
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <StatusDot connected />
                    <span>
                      {t('gmail.connected')} · <span className="truncate">{gmailStatus.data?.email}</span>
                    </span>
                  </p>
                  <p className="text-xs text-gray-500" data-testid="gmail-last-synced">
                    {gmailStatus.data?.lastSync
                      ? t('gmail.lastSynced', {
                          time: formatRelativeDate(gmailStatus.data.lastSync, locale),
                        })
                      : t('gmail.neverSynced')}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                  <StatusDot connected={false} />
                  {t('gmail.notConnected')}
                </p>
              )}
            </div>
            {gmailStatus.isSuccess &&
              (gmailConnected ? (
                <ActionButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirming('gmail')}
                  isLoading={disconnectGmail.isPending}
                  data-testid="gmail-disconnect"
                >
                  {t('gmail.disconnect')}
                </ActionButton>
              ) : (
                <Link
                  to="/onboarding"
                  className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors shrink-0"
                  data-testid="gmail-connect"
                >
                  {t('gmail.connect')}
                </Link>
              ))}
          </li>

          <li
            className="flex items-start justify-between gap-4 pt-5 border-t border-gray-100"
            data-testid="calendar-row"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{t('calendar.label')}</p>
              {calendarStatus.isLoading ? (
                <RowSkeleton testId="calendar-row-loading" />
              ) : calendarStatus.isError ? (
                <RowError onRetry={() => void calendarStatus.refetch()} />
              ) : calendarConnected ? (
                <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                  <StatusDot connected />
                  {t('calendar.connected')}
                </p>
              ) : (
                <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                  <StatusDot connected={false} />
                  {t('calendar.notConnected')}
                </p>
              )}
            </div>
            {calendarStatus.isSuccess &&
              (calendarConnected ? (
                <ActionButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirming('calendar')}
                  isLoading={disconnectCalendar.isPending}
                  data-testid="calendar-disconnect"
                >
                  {t('calendar.disconnect')}
                </ActionButton>
              ) : (
                <RequiresPro feature="calendarActions">
                  <ActionButton
                    size="sm"
                    onClick={() => void handleCalendarConnect()}
                    data-testid="calendar-connect"
                  >
                    {t('calendar.connect')}
                  </ActionButton>
                </RequiresPro>
              ))}
          </li>
        </ul>
      </SettingSection>

      <SettingSection testId="billing-section" title={t('billing')}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            {t('billingSection.currentPlan')}:{' '}
            <span className="font-medium text-gray-900" data-testid="billing-plan">
              {t(`billingSection.plan.${plan ?? 'free'}`)}
            </span>
          </p>
          <Link
            to="/app/settings/billing"
            data-testid="manage-billing-link"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 transition-colors"
          >
            {t('billingSection.manage')}
          </Link>
        </div>
      </SettingSection>

      <SettingSection testId="privacy-section" title={t('privacy')}>
        <ul className="space-y-2 text-sm">
          <li>
            <Link
              to="/privacy"
              data-testid="privacy-policy-link"
              className="text-gray-600 hover:text-gray-900 underline underline-offset-2"
            >
              {t('privacySection.privacyPolicy')}
            </Link>
          </li>
          <li>
            <Link
              to="/terms"
              data-testid="terms-link"
              className="text-gray-600 hover:text-gray-900 underline underline-offset-2"
            >
              {t('privacySection.terms')}
            </Link>
          </li>
        </ul>
      </SettingSection>

      <ConfirmModal
        isOpen={confirming === 'gmail'}
        title={t('gmail.confirmTitle')}
        message={t('gmail.confirmMessage')}
        confirmLabel={t('gmail.disconnect')}
        variant="destructive"
        onConfirm={() => void handleGmailDisconnect()}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmModal
        isOpen={confirming === 'calendar'}
        title={t('calendar.confirmTitle')}
        message={t('calendar.confirmMessage')}
        confirmLabel={t('calendar.disconnect')}
        variant="destructive"
        onConfirm={() => void handleCalendarDisconnect()}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
};

export default SettingsPage;
