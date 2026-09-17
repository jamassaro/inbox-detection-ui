import { useTranslation } from 'react-i18next';

/**
 * The detective's overall state, shown in the sidebar header. Derived ONLY
 * from data the sidebar already has — the Gmail connection status
 * (`useGmailStatus()`) plus the active-investigation flag — never from a
 * separate API endpoint.
 */
export type AgentStatusVariant =
  | 'active'
  | 'investigating'
  | 'needsAttention'
  | 'monitoringPaused'
  | 'notConnected';

export interface AgentStatusInput {
  /** `useGmailStatus().data.connected` — false while disconnected or errored. */
  connected: boolean;
  /** `useGmailStatus().data.lastSync` — ISO-8601 of the last completed scan, or null. */
  lastSync: string | null;
  /** True while an investigation is in flight (FE-010: the sidebar's own mutation; FE-009 will share its hook). */
  isInvestigating?: boolean;
  /** Unseen discovery count, when a caller has one. Nothing on main supplies it yet. */
  newDiscoveryCount?: number | null;
  /** Reserved for a future pause control — no data source on main. */
  isMonitoringPaused?: boolean;
}

export interface ScanAge {
  unit: 'min' | 'hour' | 'day';
  count: number;
}

/**
 * Human age of the last completed scan, floored at 1 minute (a scan that
 * just finished should not render "0 min ago" or a negative age under clock
 * skew). Returns null when there is no parseable `lastSync`.
 */
export function getScanAge(lastSync: string | null, now: number = Date.now()): ScanAge | null {
  if (!lastSync) return null;
  const timestamp = Date.parse(lastSync);
  if (Number.isNaN(timestamp)) return null;
  const minutes = Math.max(1, Math.floor((now - timestamp) / 60_000));
  if (minutes < 60) return { unit: 'min', count: minutes };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { unit: 'hour', count: hours };
  return { unit: 'day', count: Math.floor(hours / 24) };
}

/**
 * Derivation order = urgency: an in-flight investigation is the live event;
 * a dead connection outranks discovery counts (nothing can be "new" while
 * disconnected); "Needs attention" beats the passive paused state; a healthy
 * connection is the default.
 */
export function deriveAgentStatus(input: AgentStatusInput): AgentStatusVariant {
  if (input.isInvestigating) return 'investigating';
  if (!input.connected) return 'notConnected';
  if (input.newDiscoveryCount != null && input.newDiscoveryCount > 0) return 'needsAttention';
  if (input.isMonitoringPaused) return 'monitoringPaused';
  return 'active';
}

const DOT_CLASS: Record<AgentStatusVariant, string> = {
  active: 'bg-green-500',
  investigating: 'bg-blue-500 animate-pulse',
  needsAttention: 'bg-amber-500',
  monitoringPaused: 'bg-gray-400',
  notConnected: 'bg-gray-400',
};

interface AgentStatusBadgeProps extends AgentStatusInput {
  /** Injected clock for deterministic tests — defaults to Date.now(). */
  now?: number;
}

/**
 * "● Active — Last scan: 8 min ago" style indicator for the sidebar header.
 * All copy is translated (EN/ES); the relative time is i18next-pluralized.
 */
const AgentStatusBadge = ({
  connected,
  lastSync,
  isInvestigating = false,
  newDiscoveryCount = null,
  isMonitoringPaused = false,
  now = Date.now(),
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
        ? t('agentStatus.lastScan', { time: t(`agentStatus.scanAge.${age.unit}`, { count: age.count }) })
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
