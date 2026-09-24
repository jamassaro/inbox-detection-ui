import {
  InvestigationPartialState,
  InvestigationProgressContent,
} from '../onboarding/InvestigationProgressPage';
import { InvestigationResultsContent } from '../onboarding/InvestigationResultsPage';
import ErrorState from '../../components/ErrorState';
import type { Discovery } from '../../types';

/**
 * Dev-only investigation states gallery (FE-009), in the /dev/primitives +
 * /dev/gmail-states style. Not linked from any navigation; exists to
 * visually verify and capture PR evidence for the progress page's states,
 * which otherwise only appear mid-poll against a live backend. Every card
 * renders the REAL exported components with fixture data — fixture counts
 * are evidence fixtures, not product behavior.
 *
 * The interactive live flow (auto-trigger POST → 3 s polling → navigate on
 * complete) is exercised separately with Playwright network interception —
 * see the FE-009 PR's test evidence.
 */

const fixtureDiscoveries: Discovery[] = [
  {
    id: 'd-1',
    type: 'subscription',
    title: 'You are paying for Netflix monthly — you also have a Standard plan upgrade from last March.',
    summary: 'Netflix Standard plan renews monthly at $15.49.',
    company: 'Netflix',
    companyInitials: 'N',
    amount: 15.49,
    currency: 'USD',
    frequency: 'monthly',
    importance: 'high',
    status: 'new',
    locked: false,
    availableActions: ['view_evidence', 'dismiss'],
    callToActions: null,
  },
  {
    id: 'd-2',
    type: 'price_change',
    title: 'Spotify raised your Premium plan from $9.99 to $10.99 this month.',
    summary: 'Spotify Premium went up $1.00.',
    company: 'Spotify',
    companyInitials: 'S',
    amount: 10.99,
    previousAmount: 9.99,
    currency: 'USD',
    importance: 'medium',
    status: 'new',
    locked: false,
    availableActions: ['dismiss'],
    callToActions: null,
  },
  {
    id: 'd-3',
    type: 'credit',
    title: 'Your Delta SkyMiles account posted a $50 travel credit, expiring in 30 days.',
    summary: 'A $50 credit expires soon.',
    company: 'Delta',
    companyInitials: 'D',
    amount: 50,
    currency: 'USD',
    date: '2026-10-17',
    importance: 'high',
    status: 'new',
    locked: false,
    availableActions: ['create_reminder', 'open_provider', 'dismiss'],
    callToActions: [{ label: 'Redeem your credit', url: 'https://www.delta.com/skymiles' }],
  },
];

const section = 'flex min-h-60 items-center justify-center rounded-xl border border-gray-200 bg-white';

const InvestigationStatesDemoPage = () => {
  return (
    // No router wrapper: this route renders inside the app's own router
    // (the results section's Links need that context anyway).
    <div className="mx-auto max-w-4xl space-y-10 p-8">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">FE-009 investigation states</h1>
          <p className="text-sm text-gray-500">Dev-only route — not part of the product UI.</p>
        </header>

        <section aria-label="Investigation starting">
          <h2 className="mb-3 text-lg font-semibold">starting (0 reviewed)</h2>
          <div className={section}>
            <InvestigationProgressContent
              emailsReviewed={0}
              categoriesSeen={{}}
              statusLabel="Starting investigation…"
              isActive
            />
          </div>
        </section>

        <section aria-label="Investigation running">
          <h2 className="mb-3 text-lg font-semibold">running (live counts)</h2>
          <div className={section}>
            <InvestigationProgressContent
              emailsReviewed={128}
              categoriesSeen={{ subscriptions: 4 }}
              statusLabel="Reviewing your emails…"
              isActive
            />
          </div>
        </section>

        <section aria-label="Investigation complete">
          <h2 className="mb-3 text-lg font-semibold">complete (final counts)</h2>
          <div className={section}>
            <InvestigationProgressContent
              emailsReviewed={312}
              categoriesSeen={{ subscriptions: 7 }}
              statusLabel="Investigation complete"
              isActive={false}
            />
          </div>
        </section>

        <section aria-label="Investigation partial">
          <h2 className="mb-3 text-lg font-semibold">partial</h2>
          <div className={section}>
            <InvestigationPartialState onContinue={() => undefined} />
          </div>
        </section>

        <section aria-label="Investigation failed">
          <h2 className="mb-3 text-lg font-semibold">failed (ErrorState + retry)</h2>
          <div className={section}>
            <ErrorState
              title="Investigation failed"
              description="The scan worker reported an error."
              onRetry={() => undefined}
            />
          </div>
        </section>

        <section aria-label="Investigation timeout">
          <h2 className="mb-3 text-lg font-semibold">retry — 5-minute timeout message</h2>
          <div className={section}>
            <ErrorState
              title="This is taking longer than expected"
              description="Your investigation is still running in the background, but it hasn't finished after 5 minutes. You can keep waiting or try again."
              onRetry={() => undefined}
            />
          </div>
        </section>

        <section aria-label="Investigation results">
          <h2 className="mb-3 text-lg font-semibold">results (summary + cards + locked)</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <InvestigationResultsContent
              discoveries={fixtureDiscoveries}
              lockedCount={2}
              onAction={() => undefined}
              onUpgrade={() => undefined}
            />
          </div>
        </section>
    </div>
  );
};

export default InvestigationStatesDemoPage;
