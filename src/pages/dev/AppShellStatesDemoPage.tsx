import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgentStatusBadge from '../../components/AgentStatusBadge';
import Sidebar from '../../components/Sidebar';
import LanguageSelector from '../../components/LanguageSelector';

/** Fixed clock so the "Last scan" relative time is stable while capturing. */
const NOW = Date.parse('2026-09-17T12:00:00Z');
const LAST_SYNC = new Date(NOW - 8 * 60_000).toISOString();

/** Module-level client — a per-render client would drop the cache between renders. */
const queryClient = new QueryClient();

const VARIANTS = [
  { label: 'Active (last scan 8 min ago)', props: { connected: true, lastSync: LAST_SYNC } },
  { label: 'Investigating', props: { connected: true, lastSync: null, isInvestigating: true } },
  { label: 'Needs attention (3 new)', props: { connected: true, lastSync: null, newDiscoveryCount: 3 } },
  { label: 'Monitoring paused', props: { connected: true, lastSync: null, isMonitoringPaused: true } },
  { label: 'Not connected', props: { connected: false, lastSync: null } },
] as const;

/**
 * Dev-only app shell gallery (FE-010). Not linked from any navigation; exists
 * to visually verify the sidebar states and the AgentStatusBadge variants and
 * to capture PR evidence. Mirrors the /dev/primitives and /dev/discovery-cards
 * pattern — remove whenever the orchestrator asks. Hardcoded headings are
 * intentional (dev tooling).
 *
 * The live Sidebar at the bottom talks to the real (dev) API, so its Gmail
 * status block reflects whatever `GET /gmail/status` currently returns.
 */
const AppShellStatesDemoPage = () => (
  <div className="flex h-screen bg-gray-50">
    <MemoryRouter initialEntries={['/app/dashboard']}>
      <QueryClientProvider client={queryClient}>
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-auto p-8">
            <div className="mx-auto max-w-3xl space-y-10">
              <header className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">FE-010 app shell gallery</h1>
                  <p className="text-sm text-gray-500">Dev-only route — not part of the product UI.</p>
                </div>
                <LanguageSelector />
              </header>

              <section aria-label="AgentStatusBadge variants">
                <h2 className="mb-3 text-lg font-semibold">AgentStatusBadge — all variants</h2>
                <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
                  {VARIANTS.map((variant) => (
                    <div key={variant.label} className="flex items-center justify-between gap-4">
                      <span className="text-xs font-mono text-gray-400">{variant.label}</span>
                      <AgentStatusBadge {...variant.props} now={NOW} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </QueryClientProvider>
    </MemoryRouter>
  </div>
);

export default AppShellStatesDemoPage;
