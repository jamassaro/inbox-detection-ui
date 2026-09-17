# Inbox Detective — Frontend Backlog

**Repository:** `inbox-detection-ui`  
**Current branch:** `extension`  
**Plan:** `INBOX_DETECTIVE_FRONTEND_IMPLEMENTATION_PLAN.md`  
**Generated:** 2026-09-17

---

## Current State Summary

The repository is a **prototype UI shell**. It contains:
- React 19 + TypeScript + Vite + Tailwind CSS + React Router v7
- 4 components (`Sidebar`, `StatCard`, `FeaturedOfferCard`, `OfferListItem`)
- 3 pages (`OffersPage` with mock data, `CompaniesPage` stub, `SavedPage` stub)
- A Chrome extension (popup + Gmail content script injection)
- Docker + nginx deployment configuration
- **Zero:** authentication, API layer, real data, state management, i18n, tests

All backlog items are `NOT_STARTED`. Nothing in Production V1 is implemented.

---

## Ticket Summary

| ID | Title | Epic | Priority | Parallel-safe |
|----|-------|------|----------|--------------|
| [FE-001](FE-001.md) | Project Foundation | FOUNDATION | P0 | YES (first) |
| [FE-002](FE-002.md) | i18n Foundation | I18N | P0 | YES (parallel with FE-001) |
| [FE-003](FE-003.md) | Auth Infrastructure | AUTH | P0 | NO |
| [FE-004](FE-004.md) | Entitlement Infrastructure | AUTH | P0 | NO |
| [FE-005](FE-005.md) | Shared UI Primitives | APP SHELL | P0 | NO |
| [FE-006](FE-006.md) | Landing Page | PUBLIC | P0 | NO |
| [FE-007](FE-007.md) | Google OAuth Flow | AUTH | P0 | NO |
| [FE-008](FE-008.md) | Gmail OAuth + Connect Page | ONBOARDING | P0 | NO |
| [FE-009](FE-009.md) | Investigation Flow | ONBOARDING | P0 | NO |
| [FE-010](FE-010.md) | App Shell + Sidebar Update | APP SHELL | P0 | NO |
| [FE-011](FE-011.md) | Discovery Type System | DISCOVERIES | P0 | YES |
| [FE-012](FE-012.md) | Discovery Card Components | DISCOVERIES | P0 | NO |
| [FE-013](FE-013.md) | Discoveries Page | DISCOVERIES | P0 | NO |
| [FE-014](FE-014.md) | Discovery Detail + Email Drawer | DISCOVERIES | P0 | NO |
| [FE-015](FE-015.md) | Dashboard Page | APP SHELL | P0 | NO |
| [FE-016](FE-016.md) | Billing Infrastructure + Upgrade Page | PAYMENTS | P0 | NO |
| [FE-017](FE-017.md) | Stripe Checkout + Upgrade Success | PAYMENTS | P0 | NO |
| [FE-018](FE-018.md) | Billing Settings Page | PAYMENTS | P0 | NO |
| [FE-019](FE-019.md) | Agent Action Panel | AGENT ACTIONS | P0 | NO |
| [FE-020](FE-020.md) | Reminder Flow | REMINDERS | P0 | NO |
| [FE-021](FE-021.md) | Calendar + Meeting Flow | CALENDAR | P0 | NO |
| [FE-022](FE-022.md) | Detective Chat Page | DETECTIVE | P0 | NO |
| [FE-023](FE-023.md) | Settings Page | SETTINGS | P0 | NO |
| [FE-024](FE-024.md) | Account Deletion Flow | SETTINGS | P1 | NO |
| [FE-025](FE-025.md) | Subscriptions Page | SUBSCRIPTIONS | P1 | NO |
| [FE-026](FE-026.md) | Privacy Policy + Terms Pages | PUBLIC | P0 | YES |
| [FE-027](FE-027.md) | DOMPurify Email Sanitization | PRODUCTION HARDENING | P0 | YES |
| [FE-028](FE-028.md) | Responsive Audit + Mobile Fixes | RESPONSIVE | P1 | NO |
| [FE-029](FE-029.md) | Accessibility P0 Fixes | ACCESSIBILITY | P1 | NO |
| [FE-030](FE-030.md) | EN/ES Translation Catalog | I18N | P1 | NO |
| [FE-031](FE-031.md) | Core Unit Test Suite | TESTING | P1 | NO |
| [FE-032](FE-032.md) | E2E Test Suite | TESTING | P1 | NO |

**P0 count:** 24  
**P1 count:** 8  
**P2 count:** 0 (post-launch items excluded from this backlog)

---

## Production V1 Blockers

All P0 tickets are launch blockers. The critical path is:

```
FE-001 + FE-002 (parallel)
    ↓
FE-003 → FE-004 → FE-005
    ↓
FE-006 + FE-007 + FE-008 + FE-009 + FE-011 (parallel after FE-003)
    ↓
FE-010 + FE-012 (parallel)
    ↓
FE-013 + FE-014 + FE-015 + FE-016 (parallel after FE-012)
    ↓
FE-017 + FE-019 (parallel after FE-016)
    ↓
FE-018 + FE-020 + FE-021 + FE-022 (parallel after FE-017 + FE-019)
    ↓
FE-023 + FE-026 + FE-027 (parallel)
    ↓
FE-030 (after all components built)
```

---

## Backend Dependencies

The entire backend API is a dependency. All listed endpoints must be available (or mockable during development). Key dependencies per feature:

| Feature | Required Endpoints |
|---------|-------------------|
| Auth | `GET /auth/google`, `GET /auth/callback`, `GET /auth/me`, `POST /auth/logout` |
| Gmail | `GET /gmail/connect`, `GET /gmail/status`, `DELETE /gmail/connection` |
| Investigation | `POST /investigations`, `GET /investigations/:id` |
| Discoveries | `GET /discoveries`, `GET /discoveries/:id`, `GET /discoveries/:id/source`, `PATCH /discoveries/:id`, `POST /discoveries/:id/feedback` |
| Billing | `GET /user/entitlements`, `POST /billing/checkout-session`, `POST /billing/portal-session`, `GET /billing/status` |
| Reminders | `POST /reminders`, `GET /reminders`, `DELETE /reminders/:id` |
| Calendar | `GET /calendar/status`, `GET /calendar/connect`, `DELETE /calendar/connection` |
| Agent Actions | `POST /agent-actions/availability`, `POST /agent-actions/:id/approve`, `POST /agent-actions/:id/send` |
| Chat | `POST /chat/messages`, `GET /chat/messages` |
| Subscriptions | `GET /subscriptions` |
| Settings | `DELETE /account` |
| **i18n critical** | Backend must return structured error codes (`{ code }` not English strings), AI-generated content must respect `Accept-Language` header |

---

## Dependency Map

```
FE-001 (Foundation) ──────────────────────────────────────────────────────────────┐
FE-002 (i18n Foundation) ─────────────────────────────────────────────────────────┤
FE-027 (DOMPurify) ───────────────────────────────────────────────────────────────┤
   │                                                                               │
   ▼                                                                               │
FE-003 (Auth Infrastructure)                                                       │
   │                                                                               │
   ├── FE-004 (Entitlement Infrastructure)                                        │
   │       │                                                                       │
   │       └── FE-005 (Shared UI Primitives) ──────────────────────────────────── ┤
   │               │                                                               │
   │       ┌───────┼──────────────────────────────────┐                           │
   │       │       │                                  │                           │
   │     FE-006  FE-007  FE-008 → FE-009          FE-011 (Types)                 │
   │   (Landing)(OAuth) (Gmail) (Invest.)              │                          │
   │                                               FE-012 (Cards) ──────────────  ┤
   │                                                   │                          │
   │                          ┌───────────────────────┤                          │
   │                          │                       │                          │
   │                        FE-010                  FE-013 → FE-014 → FE-015     │
   │                      (App Shell)             (Discov.) (Detail) (Dashboard)  │
   │                                                                   │          │
   │                                               FE-016 (Billing Infra)         │
   │                                                   │                          │
   │                                               FE-017 (Stripe Checkout)       │
   │                                                   │                          │
   │                               ┌──────────────────┤                          │
   │                               │                  │                          │
   │                           FE-019              FE-018 (Billing Page)          │
   │                        (AgentPanel)                                          │
   │                               │                                              │
   │                    ┌──────────┼──────────┐                                   │
   │                    │          │          │                                   │
   │                 FE-020     FE-021     FE-022                                 │
   │               (Reminder) (Calendar) (Chat)                                  │
   │                                                                              │
   └─────────────────────────────────────────────────────────────────────────────┘
                                   │
                               FE-023 (Settings)
                               FE-024 (Deletion)
                               FE-025 (Subscriptions)
                               FE-026 (Legal Pages)
                                   │
                               FE-030 (Translation Catalog)
                                   │
                           FE-028 + FE-029 (Responsive + A11y)
                                   │
                           FE-031 + FE-032 (Tests)
```

---

## Recommended First Batch (simultaneous, no conflicts)

These 4 tickets can be assigned to different agents on day one:

| Ticket | Why first |
|--------|----------|
| **FE-001** | All other tickets depend on TanStack Query + apiClient |
| **FE-002** | i18n config must exist before any component is built |
| **FE-011** | Discovery type definitions are pure TypeScript, zero dependencies |
| **FE-027** | DOMPurify install is standalone, needed before EmailDrawer |

After FE-001 completes → assign FE-003 immediately.  
After FE-002 completes → agents building components can use `useTranslation()`.  
After FE-003 completes → assign FE-004, FE-005, FE-006, FE-007, FE-008 in parallel.

---

## Verification Commands (all tickets)

```bash
npm run build    # tsc -b && vite build — zero TypeScript errors
npm run lint     # oxlint — zero warnings/errors
npm run dev      # vite dev — app starts, no console errors
npm run preview  # serve production build locally
```

No test runner is configured yet. FE-031 adds Vitest.

---

## High-Risk Areas

1. **`src/App.tsx` merge conflicts** — FE-003 restructures the entire router. All page-adding tickets must wait for FE-003. FE-003 should define all route slots upfront with lazy imports.
2. **`src/types/index.ts` shared type file** — FE-011 owns this. Any ticket adding types must coordinate to avoid conflicts.
3. **AI-generated Discovery content** — `title` and `summary` fields are AI-generated. Frontend i18n alone cannot translate them. Backend must respect `Accept-Language`. This is a hard dependency that cannot be worked around in the frontend.
4. **Stripe context preservation** — FE-016 and FE-017 must implement sessionStorage-based context preservation before any contextual upgrade flow is tested. Missing this causes the most-important UX requirement (return to original context after payment) to fail silently.
5. **`noUnusedLocals: true`** in tsconfig — any stub/placeholder code using `// @ts-ignore` or unused imports will fail the build. All agents must be aware.
