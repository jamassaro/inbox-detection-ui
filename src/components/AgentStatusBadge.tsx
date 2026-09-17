import { useTranslation } from 'react-i18next';
import { deriveAgentStatus, getScanAge } from '../lib/agentStatus';
import type { AgentStatusVariant } from '../lib/agentStatus';

const DOT_CLASS: Record<AgentStatusVariant, string> = {
  active: 'bg-green-500',
  investigating: 'bg-blue-500 animate-pulse',
  needsAttention: 'bg-amber-500',
  monitoringPaused: 'bg-gray-400',
  notConnected: 'bg-gray-400',
};

interface AgentStatusBadgeProps {
  /** `useGmailStatus().data.connected` — false while disconnected or errored. */
  connected: boolean;
  /** `useGmailStatus().data.lastSync` — ISO-8601 of the last completed scan, or null. */
  lastSync: string | null;
  /** True while an investigation is in flight. */
  isInvestigating?: boolean;
  /** Unseen discovery count, when a caller has one. Nothing on main supplies it yet. */
  newDiscoveryCount?: number | null;
  /** Reserved for a future pause control — no data source on main. */
  isMonitoringPaused?: boolean;
  /** Injected clock for deterministic tests and galleries — real clock by default (resolved in getScanAge). */
  now?: number;
}

/**
 * "● Active — Last scan: 8 min ago" style indicator for the sidebar header.
 * Status is derived ONLY from available data (Gmail connection + last scan
 * age + the in-flight investigation flag) — never a separate API endpoint.
 * All copy is translated (EN/ES); the relative time is i18next-pluralized.
 */
const AgentStatusBadge = ({
  connected,
  lastSync,
  isInvestigating = false,
  newDiscoveryCount = null,
  isMonitoringPaused = false,
  now,
}: AgentStatusBadgeProps) => {
  const { t } = useTranslation('common');
  const variant = deriveAgentStatus({ connected, lastSync, isInvestigating, newDiscoveryCount, isMonitoringPaused });

  let label: string;
  switch (variant) {
    case 'investigating':
      label = t('agentStatus.investigating');
      break;
    case 'needsAttention':
      label = t('agentStatus.needsAttention', { count: newDiscoveryCount ?? 0 });
      break;
    case 'monitoringPaused':
      label = t('agentStatus.monitoringPaused');
      break;
    case 'notConnected':
      label = t('agentStatus.notConnected');
      break;
    case 'active': {
      const age = getScanAge(lastSync, now);
      label = age
        ? t('agentStatus.activeWithScan', { time: t(`agentStatus.scanAge.${age.unit}`, { count: age.count }) })
        : t('agentStatus.active');
      break;
    }
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[variant]}`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
};

export default AgentStatusBadge;
