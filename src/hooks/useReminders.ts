import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';

/**
 * Reminders API (FE-020) against Inbox-api BE-031 (`/reminders`).
 *
 * Contract notes (verified against src/api/routes/reminders.routes.ts):
 * - `title` is REQUIRED (1–200 chars) — the discovery's title is the natural
 *   value; ReminderModal keeps it editable.
 * - The list route filters by `status` only — there is NO `discoveryId`
 *   param — so linking a reminder to a discovery is a client-side filter.
 * - Editing a reminder is `PATCH /reminders/:id` (reschedule); the FE-020
 *   ticket's "Edit" maps to this endpoint.
 * - Reads/reschedule/cancel are authenticated but not entitlement-gated (a
 *   downgraded user can still clear reminders created while on Pro); only
 *   POST requires the `reminders` entitlement (402 for Free).
 */

/** Reminder lifecycle — mirrors the backend status values. */
export type ReminderStatus = 'pending' | 'sent' | 'cancelled' | 'failed';

/** Wire shape of a Reminder row — full row as returned by `GET /reminders`. */
export interface ReminderWire {
  id: string;
  userId: string;
  discoveryId: string | null;
  title: string;
  description: string | null;
  /** ISO-8601 datetime the reminder fires at. */
  remindAt: string;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
}

/** Body of `POST /reminders` → 201 (the route returns these four fields only). */
export interface CreateReminderResponse {
  id: string;
  title: string;
  remindAt: string;
  status: ReminderStatus;
}

/**
 * Base TanStack Query cache key prefix for every reminders list, regardless
 * of which status filter it was fetched with — the three mutations below
 * invalidate this bare prefix, which matches (and so refreshes) every keyed
 * variant at once.
 */
export const REMINDERS_QUERY_KEY = ['reminders'] as const;

/** Keyed cache entry for one status filter ('all' = no filter, every status). */
const remindersQueryKey = (status: ReminderStatus | 'all') => [...REMINDERS_QUERY_KEY, status] as const;

/**
 * Pending reminders for the signed-in user, optionally narrowed to one
 * discovery. The discovery filter is client-side (BE-031 has no discoveryId
 * query param) — the backend list stays the single source of truth.
 */
export function useReminders(discoveryId?: string) {
  const query = useQuery({
    queryKey: remindersQueryKey('pending'),
    queryFn: () => apiFetch<{ reminders: ReminderWire[] }>('/reminders?status=pending'),
    retry: false,
  });

  const reminders = useMemo(() => {
    const rows = query.data?.reminders ?? [];
    return discoveryId === undefined ? rows : rows.filter((r) => r.discoveryId === discoveryId);
  }, [query.data, discoveryId]);

  return { ...query, reminders };
}

/**
 * Every reminder for the signed-in user, any status, in one request —
 * `GET /reminders` with no `status` param returns the full unfiltered set,
 * sorted `remindAt` ascending (BE-031, no pagination). Backs the Reminders
 * widget's Upcoming/History grouping, which is derived client-side from
 * this single list rather than one request per tab.
 */
export function useAllReminders() {
  return useQuery({
    queryKey: remindersQueryKey('all'),
    queryFn: () => apiFetch<{ reminders: ReminderWire[] }>('/reminders'),
    retry: false,
  });
}

/**
 * Creates a reminder. Free users get the backend's 402 — the modal gates
 * with RequiresPro first, so a 402 here means the entitlement changed
 * mid-flight and is surfaced as a normal mutation error.
 */
export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { discoveryId: string | null; title: string; remindAt: string }) =>
      apiFetch<CreateReminderResponse>('/reminders', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REMINDERS_QUERY_KEY }),
  });
}

/** Reschedules a reminder (PATCH /reminders/:id with the new remindAt). */
export function useRescheduleReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remindAt }: { id: string; remindAt: string }) =>
      apiFetch<ReminderWire>(`/reminders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ remindAt }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REMINDERS_QUERY_KEY }),
  });
}

/** Cancels a reminder (DELETE /reminders/:id → 204, idempotent for cancelled). */
export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/reminders/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REMINDERS_QUERY_KEY }),
  });
}
