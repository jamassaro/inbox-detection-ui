/**
 * Enum-to-translation-key and display mappings for the Discovery domain.
 *
 * Backend enum values (src/types) are wire values and must never be rendered
 * directly — every user-visible string goes through an i18n key produced here.
 * See AGENTS.md "The Discovery Object" and docs/backlog/frontend/FE-011.md.
 */
import type { Discovery, DiscoveryAction, DiscoveryType } from '../types';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  CalendarClock,
  CalendarDays,
  CirclePlus,
  CreditCard,
  Gift,
  Hourglass,
  Receipt,
  RefreshCw,
  TriangleAlert,
  TrendingUp,
  Undo2,
} from 'lucide-react';

/**
 * Maps a backend DiscoveryType to its `discoveries.types.*` i18n key.
 *
 * @example getDiscoveryTypeKey('subscription') // 'discoveries.types.subscription'
 * @example getDiscoveryTypeKey('price_change') // 'discoveries.types.priceChange'
 */
export function getDiscoveryTypeKey(type: DiscoveryType): string {
  return `discoveries.types.${TYPE_TO_KEY_SLUG[type]}`;
}

/**
 * Maps a backend DiscoveryAction to its `discoveries.actions.*` i18n key.
 *
 * @example getDiscoveryActionKey('remind') // 'discoveries.actions.remindMe'
 * @example getDiscoveryActionKey('dismiss') // 'discoveries.actions.dismiss'
 */
export function getDiscoveryActionKey(action: DiscoveryAction): string {
  return `discoveries.actions.${ACTION_TO_KEY_SLUG[action]}`;
}

/**
 * Icon and color treatment for a Discovery type. Icons come from
 * lucide-react (already a project dependency); color classes are static
 * Tailwind strings so Tailwind's scanner can see them.
 */
export interface DiscoveryTypeMeta {
  /** Category icon for the Discovery. */
  icon: LucideIcon;
  /** Tailwind classes for the icon treatment (text + background). */
  colorClass: string;
}

/**
 * Derives the color/icon treatment for a Discovery type.
 * Returns an entry for every type — exhaustiveness is enforced by the type.
 */
export function getDiscoveryMeta(type: DiscoveryType): DiscoveryTypeMeta {
  return TYPE_META[type];
}

/**
 * Derives display initials from a company name: the first letter of each of
 * the first two words, uppercased. Used as a fallback when the backend does
 * not supply `companyInitials`.
 *
 * @example getInitials('Netflix') // 'N'
 * @example getInitials('Acme Corp') // 'AC'
 * @example getInitials('') // ''
 */
export function getInitials(company: string): string {
  return company
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

/**
 * Exhaustive slug maps: a missing enum member is a compile error, and an
 * unknown key cannot be constructed, so keys stay in sync with the backend.
 */
const TYPE_TO_KEY_SLUG: Record<DiscoveryType, string> = {
  subscription: 'subscription',
  renewal: 'renewal',
  trial_expiration: 'trialExpiration',
  price_change: 'priceChange',
  bill_change: 'billChange',
  credit: 'credit',
  refund: 'refund',
  reward: 'reward',
  expiration: 'expiration',
  cashback: 'cashback',
  meeting: 'meeting',
  action_required: 'actionRequired',
};

const ACTION_TO_KEY_SLUG: Record<DiscoveryAction, string> = {
  remind: 'remindMe',
  dismiss: 'dismiss',
  view_source: 'viewSource',
  open_provider: 'openProvider',
  review_subscription: 'reviewSubscription',
  investigate: 'investigate',
  find_time: 'findTime',
  track_refund: 'trackRefund',
  ask_detective: 'askDetective',
};

const TYPE_META: Record<DiscoveryType, DiscoveryTypeMeta> = {
  subscription: { icon: CreditCard, colorClass: 'text-blue-600 bg-blue-100' },
  renewal: { icon: RefreshCw, colorClass: 'text-indigo-600 bg-indigo-100' },
  trial_expiration: { icon: Hourglass, colorClass: 'text-orange-600 bg-orange-100' },
  price_change: { icon: TrendingUp, colorClass: 'text-amber-600 bg-amber-100' },
  bill_change: { icon: Receipt, colorClass: 'text-yellow-600 bg-yellow-100' },
  credit: { icon: CirclePlus, colorClass: 'text-emerald-600 bg-emerald-100' },
  refund: { icon: Undo2, colorClass: 'text-green-600 bg-green-100' },
  reward: { icon: Gift, colorClass: 'text-pink-600 bg-pink-100' },
  expiration: { icon: CalendarClock, colorClass: 'text-red-600 bg-red-100' },
  cashback: { icon: Banknote, colorClass: 'text-teal-600 bg-teal-100' },
  meeting: { icon: CalendarDays, colorClass: 'text-violet-600 bg-violet-100' },
  action_required: { icon: TriangleAlert, colorClass: 'text-rose-600 bg-rose-100' },
};

/**
 * Billing cadence values a Discovery may carry (inline union on `Discovery`).
 */
export type DiscoveryFrequency = NonNullable<Discovery['frequency']>;

/**
 * Maps a Discovery billing frequency to its i18n key. `monthly`/`annual`
 * reuse the existing `billing.frequency.*` catalog keys; `weekly` is FE-012
 * card copy in the discoveries namespace; one-time amounts have no repetition
 * suffix (null — render the bare amount).
 *
 * @example getFrequencyLabelKey('monthly') // 'billing:frequency.monthly'
 * @example getFrequencyLabelKey('one_time') // null
 */
export function getFrequencyLabelKey(frequency: DiscoveryFrequency): string | null {
  switch (frequency) {
    case 'monthly':
      return 'billing:frequency.monthly';
    case 'annual':
      return 'billing:frequency.annual';
    case 'weekly':
      return 'discoveries:card.frequency.weekly';
    case 'one_time':
      return null;
  }
}
