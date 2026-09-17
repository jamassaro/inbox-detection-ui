import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/apiClient';
import { toDiscovery } from '../lib/discoveryWire';
import type { DiscoveryWire } from '../lib/discoveryWire';
import { DISCOVERIES_PATH } from './useDiscoveries';
import type { Discovery, DiscoverySourceEvidence } from '../types';

/**
 * Discovery detail hooks (FE-014).
 *
 * Wire contract — verified against Inbox-api BE-028/BE-029
 * (src/api/routes/discoveries.routes.ts, read 2026-09-17):
 *
 * - `GET /discoveries/:id` returns the raw Prisma Discovery row (same field
 *   names as the list wire rows) — mapped through the shared `toDiscovery`
 *   adapter. A locked row does NOT return the payload: it answers 402 with
 *   the upgrade context, which surfaces as an ApiError status 402.
 * - Evidence lives at `GET /discoveries/:id/evidence` — NOT `/source` as
 *   FE-014.md sketched. Response:
 *   `{ discoveryId, explanation, evidence: [{ emailId, sender, subject, date, snippet, company }] }`.
 *   The `snippet` is the matched sentence captured at classification time
 *   (never the full email body). There is no `gmailUrl` in the response —
 *   the Gmail deep link is derived client-side from `emailId`.
 * - Dismiss and feedback reuse the FE-013 mutations from useDiscoveries
 *   (PATCH /:id/dismiss empty body; PATCH /:id/feedback { feedback }); their
 *   invalidations cover these detail keys because they are prefixed by
 *   DISCOVERIES_QUERY_KEY.
 */

/** Cache-key prefix shared by every detail/evidence query for one discovery. */
export const DISCOVERY_DETAIL_QUERY_KEY = ['discoveries', 'detail'] as const;

/** Builds the detail endpoint path (BE-028). */
export const discoveryDetailPath = (id: string): string => `${DISCOVERIES_PATH}/${id}`;

/** Builds the evidence endpoint path (BE-029). */
export const discoveryEvidencePath = (id: string): string => `${DISCOVERIES_PATH}/${id}/evidence`;

/**
 * Gmail deep link for a source message. The backend sends only the Gmail
 * message id (sourceEmailIds → FinancialEvent.emailId), so the standard
 * Gmail web deep link is derived here — never stored or guessed beyond it.
 */
export function buildGmailUrl(emailId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(emailId)}`;
}

/** One evidence row as returned by GET /discoveries/:id/evidence (BE-029). */
export interface DiscoveryEvidenceItemWire {
  emailId: string;
  sender: string;
  subject: string;
  date: string;
  /** Matched sentence from classification — the only email text the backend exposes. */
  snippet: string | null;
  company?: string | null;
}

/** Response body of GET /discoveries/:id/evidence (BE-029). */
export interface DiscoveryEvidenceWire {
  discoveryId: string;
  /** The backend's own "why flagged" narrative, when stored. */
  explanation: string | null;
  evidence: DiscoveryEvidenceItemWire[];
}

/** Evidence content the drawer renders (FE-011 DiscoverySourceEvidence). */
export interface DiscoveryEvidence {
  explanation: string | null;
  emails: DiscoverySourceEvidence[];
}

/** Maps a wire evidence row onto the FE-011 evidence shape. */
export function toEvidenceItem(wire: DiscoveryEvidenceItemWire): DiscoverySourceEvidence {
  return {
    id: wire.emailId,
    subject: wire.subject,
    sender: wire.sender,
    date: wire.date,
    excerpt: wire.snippet ?? '',
    gmailUrl: buildGmailUrl(wire.emailId),
  };
}

const toEvidence = (wire: DiscoveryEvidenceWire): DiscoveryEvidence => ({
  explanation: wire.explanation,
  emails: wire.evidence.map(toEvidenceItem),
});

/**
 * Reads one discovery's full detail. 402 (locked row) surfaces as the
 * query's error so the page can render its paywall state — the backend
 * deliberately never returns masked narrative content on this route.
 */
export function useDiscovery(id: string) {
  return useQuery<DiscoveryWire, Error, Discovery>({
    queryKey: [...DISCOVERY_DETAIL_QUERY_KEY, id],
    queryFn: () => apiFetch<DiscoveryWire>(discoveryDetailPath(id)),
    select: toDiscovery,
    enabled: id !== '',
    retry: false,
  });
}

/**
 * Reads a discovery's source-email evidence. `enabled` stays false until the
 * user opens the drawer, so the fetch is lazy (FE-014: fetch on open).
 */
export function useDiscoverySource(id: string, enabled: boolean) {
  return useQuery<DiscoveryEvidenceWire, Error, DiscoveryEvidence>({
    queryKey: [...DISCOVERY_DETAIL_QUERY_KEY, id, 'evidence'],
    queryFn: () => apiFetch<DiscoveryEvidenceWire>(discoveryEvidencePath(id)),
    select: toEvidence,
    enabled: enabled && id !== '',
    retry: false,
  });
}
