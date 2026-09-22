import type { DiscoveryWire } from '../hooks/useInvestigation';
import { isFormattableCurrency } from './formatting';

/** Rounds a currency sum to cents — floating-point sums must not show 21.990000000000002. */
const roundToCents = (value: number): number => Math.round(value * 100) / 100;

/**
 * Sums the real amounts of the given discoveries, grouped by currency.
 * Locked rows keep their amount on the wire (BE-028 masks narrative
 * content, not the row's existence or amount), so they are included.
 * Rows with a non-monetary `currency` (e.g. a percentage) are excluded —
 * they cannot be summed into a money total.
 */
export function sumPotentialValue(
  items: DiscoveryWire[],
): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (typeof item.amount !== 'number' || !item.currency) continue;
    if (!isFormattableCurrency(item.currency)) continue;
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount: roundToCents(amount) }))
    .sort((x, y) => x.currency.localeCompare(y.currency));
}
