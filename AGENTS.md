# AGENTS.md — Inbox Detective Frontend

This file is the authoritative guide for autonomous coding agents working in this repository.
Read it completely before making any changes.

---

## What Is This Project

**Inbox Detective** is an agentic email intelligence product.

Core premise: *Your inbox knows things you don't.*

Inbox Detective connects to Gmail, investigates the inbox, and surfaces **Discoveries** — structured, actionable findings such as subscription renewals, price changes, expiring credits, refund opportunities, and meeting requests. It is **not** an email client. Email is supporting evidence behind a Discovery.

The agent experience follows:
```
DISCOVER → EXPLAIN → RECOMMEND → APPROVE → ACT → VERIFY
```

Consequential actions (send email, create calendar event) require explicit user approval.

### Business Model

| Tier | Price | What it does |
|------|-------|-------------|
| **Free** | $0 | One-time investigation, 3–5 Discoveries, limited Detective Chat |
| **Pro** | $5.99/month or $49/year | Continuous monitoring, all Discoveries, reminders, Calendar actions, full chat |

**Entitlement is always determined by the backend. Never hard-code plan logic in the frontend.**

---

## Repository Structure

```
inbox-detection-ui/
├── src/                          ← Main application source
│   ├── main.tsx                  ← Entry point — providers wrapped here
│   ├── App.tsx                   ← Router root
│   ├── index.css                 ← Tailwind directives + global styles
│   ├── contexts/                 ← React Context providers
│   │   ├── AuthContext.tsx       ← User session state
│   │   ├── EntitlementContext.tsx ← Plan + feature flags from backend
│   │   └── LocaleContext.tsx     ← i18n locale state
│   ├── hooks/                    ← Custom React hooks
│   ├── lib/                      ← Pure utilities (no React)
│   │   ├── apiClient.ts          ← Centralized fetch wrapper
│   │   ├── queryClient.ts        ← TanStack Query singleton
│   │   ├── formatting.ts         ← Date / number / currency (Intl APIs)
│   │   ├── sanitize.ts           ← DOMPurify email HTML sanitization
│   │   ├── discoveryHelpers.ts   ← Enum → translation key mapping
│   │   └── upgradeContext.ts     ← sessionStorage upgrade flow context
│   ├── components/               ← Reusable UI components
│   ├── pages/                    ← Route-level page components
│   │   ├── onboarding/           ← Post-auth, pre-investigation pages
│   │   ├── discoveries/          ← Discovery list + detail
│   │   └── settings/             ← Settings + billing
│   ├── types/                    ← TypeScript type definitions
│   │   └── index.ts              ← All shared types exported here
│   ├── i18n/                     ← Internationalization
│   │   ├── index.ts              ← i18next configuration
│   │   └── locales/
│   │       ├── en/               ← 12 namespace JSON files
│   │       └── es/               ← 12 namespace JSON files (mirrors en/)
│   └── data/
│       └── mockOffers.ts         ← Development mock data (temporary)
├── chrome-extension/             ← Chrome extension (separate build artifact)
│   ├── content/content.ts        ← Gmail sidebar injection script
│   ├── popup/                    ← Extension popup React app
│   └── public/manifest.json      ← Extension manifest v3
├── docs/
│   └── backlog/
│       └── frontend/             ← Executable backlog (FE-001 through FE-032)
│           └── README.md         ← Backlog index + dependency map
├── public/                       ← Static assets
├── INBOX_DETECTIVE_FRONTEND_IMPLEMENTATION_PLAN.md  ← Full V1 plan
├── PRD.md                        ← Product Requirements Document
├── AGENTS.md                     ← This file
├── Dockerfile                    ← Multi-stage: development + production
├── docker-compose.yml            ← Dev + prod services
├── nginx.conf                    ← Production web server config
├── vite.config.ts                ← Main app Vite config
├── vite.config.extension.ts      ← Chrome extension Vite config
└── tailwind.config.js            ← Tailwind configuration
```

---

## Technology Stack

| Concern | Library | Version | Notes |
|---------|---------|---------|-------|
| Framework | React | 19 | |
| Language | TypeScript | ~6.0 | Strict mode — see tsconfig constraints below |
| Build | Vite | 8 | |
| Routing | React Router | v7 | BrowserRouter |
| Styling | Tailwind CSS | v3 | No other CSS framework |
| Icons | Lucide React | latest | No other icon library |
| Server state | TanStack Query | v5 | All API data fetching |
| i18n | react-i18next + i18next | latest | |
| Sanitization | DOMPurify | latest | Required for email HTML |
| Linter | oxlint | latest | |
| Tests | Vitest + React Testing Library | latest | |
| E2E | Playwright | latest | |

**Do NOT introduce additional libraries without a documented reason. The stack above is the approved set.**

---

## Development Commands

```bash
npm install          # install dependencies
npm run dev          # start dev server at http://localhost:5173
npm run build        # TypeScript check + Vite production build
npm run lint         # oxlint — must pass before any PR
npm run preview      # serve the production build locally
npm test             # Vitest unit tests
npm run test:ui      # Vitest with UI
npm run test:e2e     # Playwright E2E tests
npm run build:extension  # build Chrome extension to dist-extension/
```

**Every commit must pass `npm run build` and `npm run lint` with zero errors.**

---

## TypeScript Constraints

`tsconfig.app.json` enforces:
- `noUnusedLocals: true` — unused variables are build errors
- `noUnusedParameters: true` — unused function parameters are build errors
- `noFallthroughCasesInSwitch: true`
- `verbatimModuleSyntax: true` — use `import type` for type-only imports

**Never add `// @ts-ignore` or `// @ts-expect-error` without a comment explaining why.**

---

## Architecture Rules

### API Layer
- **All API calls go through `src/lib/apiClient.ts`** (`apiFetch`). Never use `fetch` directly in components or hooks.
- `apiFetch` attaches the session cookie (`credentials: 'include'`), the `Accept-Language` header (from locale), and handles 401 by dispatching an `auth:expired` event.
- Base URL is `import.meta.env.VITE_API_BASE_URL` — never hardcoded.

### Authentication
- Session is an httpOnly cookie managed by the backend. **The frontend never stores auth tokens.**
- Auth state lives in `AuthContext`. Use `useAuth()` to access it.
- Protected routes use `<ProtectedRoute>`. Unauthenticated access → redirect to `/`.
- 401 responses clear auth state and redirect to `/`.

### Entitlements
- **`useEntitlements()` is the only place that checks plan/features.** Never write `user.plan === 'free'` in a component.
- `<RequiresPro feature="...">` is the gate for Pro-only UI. It renders `<UpgradePrompt>` for Free users.
- Entitlements come from the backend. The frontend never calculates who gets what.

### Server State
- TanStack Query v5 manages all data fetching. Use `useQuery` / `useMutation` hooks.
- The `QueryClient` singleton is in `src/lib/queryClient.ts`.
- Query keys follow this pattern: `['resource']`, `['resource', id]`, `['resource', { filters }]`.
- After mutations that affect multiple queries, use `queryClient.invalidateQueries`.

### i18n (CRITICAL — cross-cutting requirement)
See the full i18n section below. Summary:
- Every user-facing string is a translation key. **No hardcoded English in JSX or UI copy.**
- Use `useTranslation(namespace)` in every component.
- AI-generated content (`Discovery.title`, `Discovery.summary`, chat responses) is rendered as-is — never through `t()`.
- Backend enum values map through `getDiscoveryTypeKey()` / `getDiscoveryActionKey()` before display.
- All dates/numbers/currency go through `src/lib/formatting.ts` — never inline.

### State Management
- **No Redux, no Zustand.** React Context for global state (Auth, Entitlement, Locale). TanStack Query for server state. `useState` / `useReducer` for local UI state.

---

## Internationalization (i18n)

Production V1 supports **English (`en`)** and **Spanish (`es`)**. English is the default and fallback.

### Rules

1. **No hardcoded strings in components.** Every user-visible string must be a translation key.
   ```tsx
   // ✗ Wrong
   <button>Remind me</button>
   
   // ✓ Correct
   <button>{t('discoveries.actions.remindMe')}</button>
   ```

2. **AI-generated content is NOT translated by the frontend.** `Discovery.title`, `Discovery.summary`, and chat `answer` are generated by the backend in the user's locale (via `Accept-Language` header). Render them directly.
   ```tsx
   // ✓ Correct — AI-generated text renders as-is
   <h2>{discovery.title}</h2>
   
   // ✗ Wrong — do not pass AI content through t()
   <h2>{t(discovery.title)}</h2>
   ```

3. **Backend enum values must never appear as UI copy.** Use `getDiscoveryTypeKey(type)` from `src/lib/discoveryHelpers.ts`.
   ```tsx
   // ✗ Wrong — raw enum as UI copy
   <span>{discovery.type}</span>  // renders "PRICE_CHANGE"
   
   // ✓ Correct
   <span>{t(getDiscoveryTypeKey(discovery.type))}</span>  // "Price change" / "Cambio de precio"
   ```

4. **All dates, numbers, and currency go through `src/lib/formatting.ts`.**
   ```tsx
   // ✗ Wrong
   <span>${amount}/month</span>
   
   // ✓ Correct
   <span>{formatCurrency(amount, currency, locale)}/{t('billing.frequency.monthly')}</span>
   ```

5. **Source email content is displayed in its original language.** Never translate raw email excerpts.

6. **Key naming convention:** semantic dot-notation, never English text as a key.
   ```
   ✓ discoveries.actions.remindMe
   ✓ billing.plans.proMonthly
   ✗ "Remind me"
   ✗ "Pro Monthly"
   ```

### Translation Namespaces

| Namespace | File | Content |
|-----------|------|---------|
| `common` | `common.json` | Nav, buttons, actions, status labels |
| `public` | `public.json` | Landing page, marketing, pricing, FAQ |
| `onboarding` | `onboarding.json` | Welcome, Gmail connect, interests |
| `investigation` | `investigation.json` | Progress states, results |
| `discoveries` | `discoveries.json` | Types, actions, evidence labels |
| `subscriptions` | `subscriptions.json` | Subscription overview, detail |
| `detective` | `detective.json` | Chat, briefing, agent states |
| `calendar` | `calendar.json` | Connection, availability, meeting flow |
| `reminders` | `reminders.json` | Selector, confirmation |
| `billing` | `billing.json` | Plans, upgrade, payment states |
| `settings` | `settings.json` | Account, connections, preferences |
| `errors` | `errors.json` | Error code → user message mapping |

### Locale Detection Order

1. `localStorage` key `inbox-detective-locale` (explicit user selection)
2. `navigator.language` (browser preference)
3. `en` (fallback)

---

## Security Rules

1. **Never render email HTML without sanitization.** Use `sanitizeEmailHtml(html)` from `src/lib/sanitize.ts` before any `dangerouslySetInnerHTML`.

2. **Never store auth tokens in `localStorage` or `sessionStorage`.** Session is managed via httpOnly cookies by the backend.

3. **Never `console.log` user email content, auth tokens, or sensitive personal data.**

4. **`Accept-Language` header is attached by `apiFetch` automatically.** Do not add it manually.

5. **Upgrade/billing context uses `sessionStorage`** (not `localStorage`) — it must not persist across browser sessions.

---

## Routing

All routes are defined in `src/App.tsx` using lazy-loaded `React.lazy()` imports.

| Path | Auth | Page |
|------|------|------|
| `/` | Public | Landing page |
| `/auth/callback` | Public | Google OAuth callback |
| `/onboarding` | Protected | Connect Gmail |
| `/onboarding/investigating` | Protected | Investigation progress |
| `/onboarding/results` | Protected | Investigation results |
| `/upgrade` | Public | Upgrade / pricing |
| `/upgrade/success` | Protected | Post-Stripe return |
| `/privacy` | Public | Privacy Policy |
| `/terms` | Public | Terms of Service |
| `/app/dashboard` | Protected | Dashboard (default authenticated home) |
| `/app/discoveries` | Protected | Discoveries list |
| `/app/discoveries/:id` | Protected | Discovery detail |
| `/app/subscriptions` | Protected | Subscriptions |
| `/app/chat` | Protected | Detective Chat |
| `/app/settings` | Protected | Settings |
| `/app/settings/billing` | Protected | Billing |

**Do not add new routes without adding them to `src/App.tsx` using `React.lazy()`.**

---

## Design System

The existing visual identity must be preserved. Inbox Detective uses a clean, minimal gray/white design language:

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `bg-gray-50` | App shell background |
| Card background | `bg-white` | All cards |
| Card border | `border border-gray-200` | All cards |
| Card radius | `rounded-xl` | All cards |
| Primary button | `bg-gray-900 text-white rounded-lg hover:bg-gray-800` | Primary CTAs |
| Secondary button | `border border-gray-200 text-gray-700 hover:bg-gray-50` | Secondary actions |
| Destructive button | `bg-red-600 text-white rounded-lg hover:bg-red-700` | Delete, send email |
| Primary text | `text-gray-900` | Headings |
| Secondary text | `text-gray-600` | Descriptions |
| Muted text | `text-gray-500` | Metadata |
| Success accent | `text-green-600` / `bg-green-100` | Positive amounts, connected |
| Danger accent | `text-red-600` | Urgency, ending soon |
| Warning accent | `text-orange-600` | Ending soon |

**Do not introduce a new component library (e.g., shadcn/ui, Radix, MUI). Use Tailwind classes only.**

---

## Component Conventions

- One component per file (except small co-located sub-components inside the same file)
- File name matches the exported component name: `DiscoveryCard.tsx` exports `DiscoveryCard`
- Props interfaces defined inline above the component, not in `types/index.ts` (unless shared across 3+ files)
- All shared domain types in `src/types/index.ts`
- `useTranslation(namespace)` at the top of every component that renders user-facing text
- No hardcoded English strings anywhere in JSX

---

## Backlog

The executable backlog is at `docs/backlog/frontend/`.

- `README.md` — index, dependency map, recommended first batch
- `FE-001.md` through `FE-032.md` — individual tickets

**Before starting any work, find the relevant backlog ticket and read it completely.** Each ticket specifies:
- Current state (what exists)
- Target state (what to build)
- Scope / Out of scope
- Acceptance criteria
- Files to modify

---

## Product Reference Documents

| Document | Location | When to read |
|----------|----------|--------------|
| PRD | `PRD.md` | For product requirement questions |
| Implementation Plan | `INBOX_DETECTIVE_FRONTEND_IMPLEMENTATION_PLAN.md` | For architecture and sequencing questions |
| Backlog | `docs/backlog/frontend/README.md` | For task assignment and dependencies |

---

## Backend API

Base URL: `import.meta.env.VITE_API_BASE_URL`

All endpoints use JSON. Session authentication via httpOnly cookie (sent automatically with `credentials: 'include'`).

The `apiFetch` wrapper handles auth and error handling. Use it for all API calls.

**Critical API rules:**
- Backend returns structured error codes: `{ code: "GMAIL_CONNECTION_EXPIRED" }` — map through `errors.json` translation namespace
- Backend returns `Accept-Language`-aware AI content — set correct locale before calling AI-generating endpoints
- Entitlements endpoint: `GET /user/entitlements` — call after auth and after Stripe return

Full API contract: see `INBOX_DETECTIVE_FRONTEND_IMPLEMENTATION_PLAN.md` Section 23.

---

## Discovery Domain Object

The primary product object. Understanding this is essential for all feature work.

```typescript
interface Discovery {
  id: string;
  type: DiscoveryType;         // enum → always map through getDiscoveryTypeKey()
  title: string;               // AI-generated — render as-is, never through t()
  summary: string;             // AI-generated — render as-is, never through t()
  company: string;             // proper noun — never translate
  companyInitials: string;
  amount?: number;             // always format with formatCurrency(amount, currency, locale)
  currency?: string;           // ISO code e.g. 'USD' — separate from locale
  frequency?: string;          // enum → map through billing.frequency.* keys
  date?: string;               // ISO 8601 — always format with formatDate(date, locale)
  previousAmount?: number;
  importance: 'high' | 'medium' | 'low';
  status: 'new' | 'viewed' | 'acted' | 'dismissed';
  locked: boolean;             // backend determines this — never calculate client-side
  availableActions: DiscoveryAction[];  // enum array → map through getDiscoveryActionKey()
}
```

---

## Agent Action Permission Levels

Agent actions that affect external systems require explicit user confirmation:

| Level | Description | UI |
|-------|-------------|-----|
| 1 | Automatic (analyze, classify, detect) | No UI needed |
| 2 | Approval required (create event, set reminder) | `AgentActionPanel` approval state |
| 3 | Explicit confirmation (send email) | `AgentActionPanel` Level 3 — red destructive button |

**Never make a Level 3 action look like a normal navigation button.**

---

## Common Mistakes to Avoid

```tsx
// ✗ Hardcoded string
<p>Remind me</p>

// ✗ Raw enum as UI text
<span>{discovery.type}</span>

// ✗ Inline currency formatting
<span>${discovery.amount}/month</span>

// ✗ Raw email HTML without sanitization
<div dangerouslySetInnerHTML={{ __html: emailContent }} />

// ✗ Direct entitlement check
if (user.plan === 'free') { ... }

// ✗ Multiple competing API patterns
const response = await fetch('/api/discoveries')  // use apiFetch instead

// ✗ Token in localStorage
localStorage.setItem('token', authToken)

// ✗ Separate components per language
<EnglishDiscoveryCard />
<SpanishDiscoveryCard />

// ✗ Hardcoded Stripe price ID
const priceId = 'price_1234abcd'

// ✗ AI-generated text through translation
<h2>{t(discovery.title)}</h2>
```

---

## Chrome Extension

The Chrome extension is a separate build artifact at `chrome-extension/`. It:
- Injects a sidebar into `mail.google.com` via `content/content.ts`
- Runs a popup at `chrome-extension/popup/`
- Shares `src/types/index.ts` and `src/data/mockOffers.ts` with the main app
- Builds to `dist-extension/` via `npm run build:extension`

**The Chrome extension is NOT the V1 focus.** It currently uses mock data and hardcoded localhost. Do not modify extension files unless the ticket explicitly targets the extension.

---

## Definition of Done

A ticket is not done until:

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm run lint` — zero lint warnings or errors
- [ ] `npm test` — all tests pass (or new tests added pass)
- [ ] Loading state handled
- [ ] Empty state handled
- [ ] Error state handled (with retry where applicable)
- [ ] Works in English (`en`)
- [ ] Works in Spanish (`es`)
- [ ] No hardcoded strings in JSX
- [ ] All amounts/dates formatted via `src/lib/formatting.ts`
- [ ] No console errors in browser
- [ ] No regressions in existing tests
