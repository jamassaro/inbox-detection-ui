import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck } from 'lucide-react';
import RequiresPro from './RequiresPro';
import ActionButton from './ActionButton';
import { startCalendarConnect } from '../hooks/useCalendarStatus';
import { storeCalendarReturnContext } from '../lib/calendarReturnContext';



interface CalendarConnectPromptProps {
  discoveryId: string;
  returnPath: string;
}

/**
 * Contextual Calendar connection (FE-021) — the meeting flow's not-connected
 * state. Render-level gate lives here: Free users get the shared Pro
 * upgrade prompt (via <RequiresPro>); Pro users get the connect card.
 *
 * The flow mounts this prompt only when something already said Calendar is
 * not connected (a `calendar_not_connected` API answer, or a status check)
 * — so no connected-state lookup happens here and a stale status can never
 * suppress the card.
 *
 * "Connect" persists the return context, then hands off to
 * startCalendarConnect — a full-page redirect to Google consent (the
 * backend's `/calendar/callback` lands back on `returnPath`), never an XHR.
 */
const CalendarConnectPrompt = ({ discoveryId, returnPath }: CalendarConnectPromptProps) => {
  const { t } = useTranslation('calendar');

  const handleConnect = useCallback(() => {
    storeCalendarReturnContext({ discoveryId, returnPath });
    void startCalendarConnect(returnPath).then((started) => {
      if (!started) {
        console.error(
          '[CalendarConnectPrompt] could not start Calendar OAuth — the consent URL request failed.',
        );
      }
    });
  }, [discoveryId, returnPath]);

  return (
    <RequiresPro feature="calendarActions">
      <div
        data-testid="calendar-connect-prompt"
        className="rounded-xl border border-gray-200 bg-white p-4 text-sm"
      >
        <div className="flex items-start gap-3">
          <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden="true" />
          <div>
            <p className="font-medium text-gray-900">{t('connect.title')}</p>
            <div className="mt-3">
              <ActionButton variant="primary" onClick={handleConnect}>
                {t('connect.cta')}
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </RequiresPro>
  );
};

export default CalendarConnectPrompt;
