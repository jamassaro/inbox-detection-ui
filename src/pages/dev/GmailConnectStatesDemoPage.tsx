import { ConnectGmailContent, ConnectGmailError, ConnectGmailLoading } from '../onboarding/ConnectGmailPage';
import { startGmailConnect } from '../../hooks/useGmailStatus';

/**
 * Dev-only Gmail connect states gallery (FE-008), in the /dev/primitives +
 * /dev/auth-states style. Not linked from any navigation; exists to visually
 * verify and capture PR evidence for the connect page's loading, offer, and
 * OAuth-error states, which otherwise only appear mid-OAuth-redirect or
 * behind an authenticated session with a live backend. The error card's
 * "Try again" and the offer card's CTA are the real handlers: retry/CTA
 * full-page-redirect to the backend's /gmail/connect when VITE_API_BASE_URL
 * is configured (nothing happens otherwise).
 */
const GmailConnectStatesDemoPage = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-10 p-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">FE-008 Gmail connect states</h1>
        <p className="text-sm text-gray-500">Dev-only route — not part of the product UI.</p>
      </header>

      <section aria-label="ConnectGmail loading">
        <h2 className="mb-3 text-lg font-semibold">ConnectGmailLoading</h2>
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <ConnectGmailLoading />
        </div>
      </section>

      <section aria-label="ConnectGmail offer">
        <h2 className="mb-3 text-lg font-semibold">ConnectGmailContent</h2>
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <ConnectGmailContent onConnect={() => startGmailConnect()} />
        </div>
      </section>

      <section aria-label="ConnectGmail error">
        <h2 className="mb-3 text-lg font-semibold">ConnectGmailError</h2>
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-gray-200 bg-white">
          <ConnectGmailError onRetry={() => startGmailConnect()} />
        </div>
      </section>
    </div>
  );
};

export default GmailConnectStatesDemoPage;
