import { useState } from 'react';
import ReminderModal from '../../components/ReminderModal';
import MeetingActionFlow from '../../components/calendar/MeetingActionFlow';
import EmailActionFlow from '../../components/calendar/EmailActionFlow';
import LanguageSelector from '../../components/LanguageSelector';
import { mockDiscoveries } from '../../data/mockOffers';
import type { AgentActionWire } from '../../hooks/useAgentAction';

const demoDiscovery = mockDiscoveries[0];

const HOUR = 3_600_000;
const iso = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * HOUR).toISOString();

const meetingAction: AgentActionWire = {
  id: 'demo-action-1',
  userId: 'demo-user',
  discoveryId: demoDiscovery.id,
  actionType: 'create_calendar_event',
  permissionLevel: 2,
  status: 'proposed',
  requestPayload: {
    title: 'Renewal call with vendor',
    start: iso(26),
    end: iso(27),
    description: 'Discuss the reported price change before renewal.',
  },
  resultPayload: null,
  verificationResult: null,
  approvedAt: null,
  executedAt: null,
  verifiedAt: null,
  failureReason: null,
  createdAt: iso(-1),
  updatedAt: iso(-1),
};

const draftAction: AgentActionWire = {
  ...meetingAction,
  id: 'demo-action-2',
  actionType: 'draft_email',
  requestPayload: {
    to: 'vendor@example.com',
    subject: 'Re: upcoming renewal',
    body: 'Hi — I saw the renewal notice. Can we discuss the new rate before it takes effect?',
  },
};

const sendAction: AgentActionWire = {
  ...meetingAction,
  id: 'demo-action-3',
  actionType: 'send_email',
  permissionLevel: 3,
  requestPayload: { draftId: 'demo-draft-1' },
};

/**
 * Dev-only reminders + calendar flows gallery (FE-020/FE-021). Not linked
 * from any navigation; exists to dogfood the flows and capture PR evidence.
 * Mirrors the /dev/primitives pattern — remove whenever the orchestrator
 * asks. Hardcoded headings are intentional (dev tooling).
 */
const RemindersCalendarDemoPage = () => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FE-020/021 reminders + calendar gallery</h1>
          <p className="text-sm text-gray-500">Dev-only route — not part of the product UI.</p>
        </div>
        <LanguageSelector />
      </header>

      <section aria-label="ReminderModal">
        <h2 className="mb-3 text-lg font-semibold">ReminderModal</h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Open reminder modal
        </button>
        {modalOpen ? (
          <ReminderModal
            discoveryId={demoDiscovery.id}
            discoveryTitle={demoDiscovery.title}
            discoveryDate={demoDiscovery.date}
            isOpen
            onClose={() => setModalOpen(false)}
          />
        ) : null}
      </section>

      <section aria-label="MeetingActionFlow">
        <h2 className="mb-3 text-lg font-semibold">MeetingActionFlow</h2>
        <div className="max-w-xl">
          <MeetingActionFlow action={meetingAction} />
        </div>
      </section>

      <section aria-label="EmailActionFlow">
        <h2 className="mb-3 text-lg font-semibold">EmailActionFlow — draft (Level 2)</h2>
        <div className="max-w-xl">
          <EmailActionFlow action={draftAction} />
        </div>
      </section>

      <section aria-label="EmailActionFlow send">
        <h2 className="mb-3 text-lg font-semibold">EmailActionFlow — send (Level 3)</h2>
        <div className="max-w-xl">
          <EmailActionFlow action={sendAction} />
        </div>
      </section>
    </div>
  );
};

export default RemindersCalendarDemoPage;
