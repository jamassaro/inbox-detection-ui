/**
 * Client-side discovery filtering for the FE-013 tabs and search box.
 *
 * The ticket wants every filter and the search wired server-side, but the
 * live backend (BE-028) exposes only type/status/limit/offset/investigationId
 * params — no search, no importance, no date window. Until BE grows them,
 * tabs and search filter the fetched window client-side (a backend gap that
 * must be disclosed; see PR notes). Pure functions — kept out of the
 * component for testability.
 */
import type { Discovery } from '../types';

/** FE-013 filter tabs (translate labels through discoveries.filters.*). */
export type DiscoveryFilter = 'all' | 'ending-soon' | 'new' | 'saved';

/** An item is "Ending Soon" when its event date falls within the next 7 days (or has already passed, but the backend default status filter keeps those out of the list). */
export const ENDING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** A discovery created within this window counts as "New". */
export const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Matches a discovery against the active tab. The saved tab is not wired:
 * the backend has no saved/bookmarks concept, so nothing passes — the page
 * renders an explicit "saving isn't available yet" state for that tab
 * instead of pretending rows are saved.
 */
export function matchesDiscoveryFilter(discovery: Discovery, filter: DiscoveryFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'ending-soon':
      return isEndingSoon(discovery);
    case 'new':
      return isNewDiscovery(discovery);
    case 'saved':
      return false;
  }
}

/** Event date falls within the ending-soon window (or has already passed). */
export function isEndingSoon(discovery: Discovery): boolean {
  if (discovery.date == null) return false;
  const date = new Date(discovery.date);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() - Date.now() <= ENDING_SOON_WINDOW_MS;
}

/** Created within the "new" window. Missing createdAt → not new (fail closed). */
export function isNewDiscovery(discovery: Discovery): boolean {
  if (discovery.createdAt == null) return false;
  const created = new Date(discovery.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return Date.now() - created.getTime() <= NEW_WINDOW_MS;
}

/**
 * Case-insensitive search over company and title. The backend has no search
 * param (BE-028), so the page applies this over the fetched window — items
 * outside the window are not matchable until pagination lands.
 */
export function matchesDiscoverySearch(discovery: Discovery, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return (
    discovery.company.toLowerCase().includes(needle) ||
    discovery.title.toLowerCase().includes(needle)
  );
}

/** Filter + search in one pass, applied in the page's useMemo. */
export function filterDiscoveries(
  discoveries: Discovery[],
  filter: DiscoveryFilter,
  search: string,
): Discovery[] {
  return discoveries.filter(
    (discovery) =>
      matchesDiscoveryFilter(discovery, filter) && matchesDiscoverySearch(discovery, search),
  );
}
