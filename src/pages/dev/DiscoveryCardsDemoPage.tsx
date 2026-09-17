import { useState } from 'react';
import DiscoveryCard from '../../components/DiscoveryCard';
import DiscoveryListItem from '../../components/DiscoveryListItem';
import LockedDiscoveryCard from '../../components/LockedDiscoveryCard';
import LanguageSelector from '../../components/LanguageSelector';
import { mockDiscoveries } from '../../data/mockOffers';
import type { DiscoveryAction } from '../../types';

/** Discovery types shown in the representative-cards section. */
const REPRESENTATIVE_TYPES = [
  'subscription',
  'price_change',
  'trial_expiration',
  'refund',
  'meeting',
  'action_required',
] as const;

/**
 * Dev-only discovery cards gallery (FE-012). Not linked from any navigation;
 * exists to visually verify the card system and to capture PR evidence.
 * Mirrors the /dev/primitives and /dev/auth-states pattern — remove whenever
 * the orchestrator asks. Hardcoded headings are intentional (dev tooling).
 */
const DiscoveryCardsDemoPage = () => {
  const [lastAction, setLastAction] = useState('');

  const onAction = (action: DiscoveryAction) => setLastAction(action);
  const onUpgrade = () => setLastAction('upgrade');

  const representative = mockDiscoveries.filter((discovery) =>
    (REPRESENTATIVE_TYPES as readonly string[]).includes(discovery.type),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FE-012 discovery cards gallery</h1>
          <p className="text-sm text-gray-500">Dev-only route — not part of the product UI.</p>
        </div>
        <LanguageSelector />
      </header>

      <section aria-label="DiscoveryCard variants">
        <h2 className="mb-3 text-lg font-semibold">DiscoveryCard — representative types</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {representative.map((discovery) => (
            <DiscoveryCard key={discovery.id} discovery={discovery} onAction={onAction} />
          ))}
        </div>
      </section>

      <section aria-label="DiscoveryCard compact">
        <h2 className="mb-3 text-lg font-semibold">DiscoveryCard — compact</h2>
        <div className="max-w-sm">
          <DiscoveryCard discovery={mockDiscoveries[0]!} onAction={onAction} compact />
        </div>
      </section>

      <section aria-label="DiscoveryListItem">
        <h2 className="mb-3 text-lg font-semibold">DiscoveryListItem</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {mockDiscoveries.map((discovery) => (
            <DiscoveryListItem key={discovery.id} discovery={discovery} onAction={onAction} />
          ))}
        </div>
      </section>

      <section aria-label="LockedDiscoveryCard">
        <h2 className="mb-3 text-lg font-semibold">LockedDiscoveryCard</h2>
        <div className="max-w-md">
          <LockedDiscoveryCard count={7} onUpgrade={onUpgrade} />
        </div>
      </section>

      <footer className="text-sm text-gray-500" data-testid="last-action">
        Last action: {lastAction || '—'}
      </footer>
    </div>
  );
};

export default DiscoveryCardsDemoPage;
