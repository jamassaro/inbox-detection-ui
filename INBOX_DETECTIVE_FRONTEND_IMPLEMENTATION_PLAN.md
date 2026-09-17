# Inbox Detective — Frontend Production V1 Implementation Plan

**Prepared:** 2026-09-16  
**Revised:** 2026-09-16 — i18n (English + Spanish) added as cross-cutting architecture requirement  
**Repository:** `inbox-detection-ui` (branch: `extension`)  
**Status:** AWAITING APPROVAL — DO NOT IMPLEMENT

---

## SECTION 1 — Executive Assessment

### What Already Exists

The current repository is a **early prototype UI shell** — approximately **10–15% of the Production V1 frontend** exists in a meaningful state. What does exist is well-structured and worth preserving:

- A functional React + TypeScript + Vite + Tailwind CSS application shell
- React Router v7 with a working route layout pattern
- A Sidebar navigation component with correct UX shape
- Three card/list components (`FeaturedOfferCard`, `OfferListItem`, `StatCard`) with a clean visual identity
- One partially real screen: the Offers page, with search, filter, stats, featured cards, and list items (all on mock data)
- A Chrome extension with a working sidebar-injection content script and popup — sharing types/data with the main app
- Docker containerization with dev + prod targets

### What Is Genuinely Missing

Everything required to make the application real:

- Authentication (Google Sign-In, session, protected routes)
- Gmail OAuth and connection flow
- Any backend API integration (no API client, no hooks, no query cache)
- Real state management beyond `useState`
- Investigation progress UI
- Dashboard with agent status
- Discovery domain (subscriptions, money, expirations, price changes, meetings)
- Discovery detail view
- Locked discoveries / paywall
- Billing (Stripe Checkout, Customer Portal)
- Entitlement system
- Detective Chat
- Reminders
- Google Calendar integration
- Agent action approval UI
- Landing page
- Onboarding flow
- Settings implementation
- Error states, loading states, empty states
- Analytics and observability
- Tests

### Biggest Risks

| Risk | Type | Notes |
|------|------|-------|
| No auth infrastructure | Technical | Most critical blocker — nothing works without it |
| No API layer | Technical | All data is mocked; no patterns to extend |
| "Offers" mental model vs. "Discovery" product vision | Product | The current UI communicates coupon clipping, not an intelligent agent |
| No entitlement system | Architecture | Plan/entitlement logic must be centralized from day one to avoid scattering `if plan === 'free'` everywhere |
| Chrome extension scope | Scope | Extension is a separate delivery artifact; V1 should ship web app first |

### Fastest Path to First Paying Customer

1. Implement Google Auth + Gmail OAuth
2. Build investigation trigger + polling progress UI (even coarse-grained)
3. Render real discoveries from the backend
4. Show Free tier discovery limit with locked previews
5. Implement Stripe Checkout
6. Return user to discoveries post-upgrade
7. Soft-launch with billing and one real discovery type working

The existing visual shell means UI scaffolding is faster than a greenfield project. The bottleneck is backend readiness and OAuth wiring.

---

## SECTION 2 — Current Frontend Architecture

| Concern | Current State | File(s) |
|---------|--------------|---------|
| **Framework** | React 19 | `src/main.tsx`, `package.json` |
| **Language** | TypeScript ~6.0 | `tsconfig.json`, `tsconfig.app.json` |
| **Build** | Vite 8 | `vite.config.ts` |
| **Extension Build** | Vite (separate config) | `vite.config.extension.ts` |
| **Routing** | React Router v7 (`BrowserRouter`) | `src/App.tsx` |
| **Styling** | Tailwind CSS v3 | `tailwind.config.js`, `src/index.css` |
| **Icons** | Lucide React | Used across all components |
| **State Management** | None (React `useState` only) | — |
| **Query/Cache** | None | — |
| **API Client** | None | — |
| **Authentication** | None | — |
| **Design System** | Ad-hoc Tailwind (gray palette, white cards, rounded-xl) | Components |
| **Component Library** | Custom only | `src/components/` |
| **Dashboard** | Offers page with mock data | `src/pages/OffersPage.tsx` |
| **Investigation UI** | None | — |
| **Email UI** | None | — |
| **Subscription UI** | None (Companies page is a stub) | `src/pages/CompaniesPage.tsx` |
| **Agent/Chat UI** | None | — |
| **Settings** | Inline placeholder `<div>` | `src/App.tsx` |
| **Billing** | None | — |
| **Calendar** | None | — |
| **Analytics** | None | — |
| **Error Monitoring** | None | — |
| **Tests** | None | — |
| **Linter** | oxlint | `package.json` |
| **Containerization** | Docker + docker-compose (dev + prod targets) | `Dockerfile`, `docker-compose.yml` |
| **Web Server (prod)** | nginx | `nginx.conf` |
| **CI/CD** | None | — |

### Application Bootstrap

`src/main.tsx` → `<App />` → `<BrowserRouter>` → `<div className="flex h-screen bg-gray-50">` → `<Sidebar />` + `<Routes>`

There is no authentication wrapper. All routes are currently public.

### Current Routes

| Path | Component | Notes |
|------|-----------|-------|
| `/` | Navigate → `/offers` | Redirect only |
| `/offers` | `OffersPage` | Functional with mock data |
| `/companies` | `CompaniesPage` | Stub ("coming soon") |
| `/saved` | `SavedPage` | Stub (empty) |
| `/settings` | Inline `<div>` | Placeholder |
| `/help` | Inline `<div>` | Placeholder |

### Chrome Extension

- **Manifest v3**, `host_permissions: ["https://mail.google.com/*"]`
- **Content script:** `content.ts` — injects a fixed sidebar with an iframe (popup) into Gmail
- **Popup:** `chrome-extension/popup/App.tsx` — 380px panel showing mock offers, "View all offers" links to `localhost:5173`
- Popup shares `mockOffers` and `Offer` type with the main app
- Extension has its own Vite build config outputting to `dist-extension/`

### Visual Design Language

- **Primary palette:** gray-50 (page bg), gray-100, gray-200 (borders), gray-800/900 (primary actions, text)
- **Accent:** green-100/green-700 (discount badges), red-500/red-600 (urgency), orange-600 (ending soon)
- **Cards:** `rounded-xl`, `border border-gray-200`, white background, `hover:shadow-md`
- **Buttons (primary):** `bg-gray-900 text-white rounded-lg hover:bg-gray-800`
- **Buttons (secondary):** `border border-gray-200 text-gray-700 hover:bg-gray-50`
- **Sidebar:** `w-48 bg-gray-50 border-r border-gray-200 flex flex-col h-screen`
- **Body font:** system-ui / -apple-system stack

---

## SECTION 3 — Existing User Flows

### Authentication
**Does not exist.** The application renders immediately to all users regardless of auth state.

### Gmail Connection
**Does not exist.** The sidebar shows "Connected" as hardcoded text (`<p className="text-xs text-gray-500 ml-10">Connected</p>`). No OAuth, no connection state.

### Investigation / Analysis
**Does not exist.** The "Scan Inbox" button in the sidebar is an unstyled `<button>` with no handler.

### Dashboard / Results
The `OffersPage` is the de facto "results" screen. It:
- Renders 2 featured offers in a `grid grid-cols-2` 
- Renders 3 list offers below
- Has filter tabs (All, Ending Soon, New, Saved) — filtering is not wired to data
- Has a search input — search is not wired to data
- Shows 3 StatCards with hardcoded values (18 offers, 3 ending soon, 8 new this week)

### Subscriptions
**Does not exist.** `CompaniesPage` displays "Companies page coming soon..."

### Saved
**Does not exist.** `SavedPage` displays "No saved offers yet..."

### Agent / Chat
**Does not exist.**

### Settings
**Does not exist.** Route renders an inline `<div className="flex-1 p-8">Settings page</div>`.

---

## SECTION 4 — Existing Route / Screen Inventory

| Route | Screen | Current Purpose | Status | Keep | Extend | Replace | Files |
|-------|--------|----------------|--------|------|--------|---------|-------|
| `/` | Redirect | Redirects to /offers | Reconfigure | No | — | Redirect to `/app/dashboard` for auth users, `/` for landing | `src/App.tsx` |
| `/offers` | Offers/Discoveries | Main mock data view | Extend → `/app/discoveries` | Partial | Yes | Rename + connect real data | `src/pages/OffersPage.tsx` |
| `/companies` | Companies | Coming soon stub | Dead | No | — | Repurpose or remove | `src/pages/CompaniesPage.tsx` |
| `/saved` | Saved Offers | Empty stub | Dead | No | — | Fold into Discoveries filter | `src/pages/SavedPage.tsx` |
| `/settings` | Settings | Inline div | Dead | No | — | Implement properly | `src/App.tsx` |
| `/help` | Help | Inline div | Dead | No | — | Defer post-launch | `src/App.tsx` |

**New routes required:**

| Route | Screen | Purpose |
|-------|--------|---------|
| `/` | Landing | Public marketing/CTA page |
| `/auth/callback` | Auth Callback | Handle Google OAuth redirect |
| `/onboarding` | Onboarding | Post-auth welcome + Gmail connect |
| `/onboarding/investigate` | Investigation Progress | Show real-time investigation status |
| `/app` | App Shell | Authenticated layout wrapper |
| `/app/dashboard` | Dashboard | Agent status + key discoveries |
| `/app/discoveries` | Discoveries | Full discovery list |
| `/app/discoveries/:id` | Discovery Detail | Detail + source + actions |
| `/app/subscriptions` | Subscriptions | Subscription overview |
| `/app/chat` | Detective Chat | Conversational interface |
| `/app/settings` | Settings | Account + connections + billing |
| `/app/settings/billing` | Billing | Plan + manage subscription |
| `/upgrade` | Upgrade / Paywall | Contextual upgrade with Stripe redirect |

---

## SECTION 5 — Existing Component Inventory

| Component | File | Current Purpose | Reuse For | Changes Needed |
|-----------|------|----------------|-----------|---------------|
| `Sidebar` | `src/components/Sidebar.tsx` | Navigation shell | App navigation | Update nav items, add agent status indicator, wire "Scan Inbox" |
| `StatCard` | `src/components/StatCard.tsx` | Numeric stat display | Dashboard stats, investigation stats | Minor: make label clickable optionally |
| `FeaturedOfferCard` | `src/components/FeaturedOfferCard.tsx` | Featured offer display | High-priority Discovery card | Extend with Discovery type, action, locked state |
| `OfferListItem` | `src/components/OfferListItem.tsx` | Offer list row | Discovery list item | Extend with type icons, amount, date, locked state |

**Chrome Extension Components (popup only):**

| Component | File | Reuse For | Notes |
|-----------|------|-----------|-------|
| `FeaturedCard` | `chrome-extension/popup/App.tsx` | Extension popup | Shares visual language with main app |
| `OtherOfferRow` | `chrome-extension/popup/App.tsx` | Extension popup | Simple list row |
| `Avatar` | `chrome-extension/popup/App.tsx` | Possibly | Initials avatar pattern |
| `DiscountBadge` | `chrome-extension/popup/App.tsx` | Possibly | Badge pattern |

---

## SECTION 6 — Existing Capability Map

| Capability | Status | Existing Implementation | Files | Current Behavior | Proposed Change |
|-----------|--------|------------------------|-------|-----------------|----------------|
| Application shell (layout) | REUSE | `App.tsx` flex layout | `src/App.tsx` | Always visible, no auth | Wrap in auth guard |
| Sidebar navigation | EXTEND | `Sidebar.tsx` | `src/components/Sidebar.tsx` | Static nav links, dead button | New nav items, agent status, real scan button |
| Offer/Discovery list | EXTEND | `OffersPage.tsx` | `src/pages/OffersPage.tsx` | Mock data only, filter not wired | Wire to real API, extend for Discovery types |
| Featured Discovery card | EXTEND | `FeaturedOfferCard.tsx` | `src/components/FeaturedOfferCard.tsx` | Shows offer data | Extend for Discovery types, locked state, actions |
| List Discovery row | EXTEND | `OfferListItem.tsx` | `src/components/OfferListItem.tsx` | Shows offer data | Extend for Discovery types, locked state |
| Stat display | REUSE | `StatCard.tsx` | `src/components/StatCard.tsx` | Numeric + label | Use for dashboard and investigation results |
| Routing | EXTEND | React Router v7 BrowserRouter | `src/App.tsx` | 6 routes, no auth | Add auth wrapper, new routes, nested routes |
| Google Authentication | MISSING | — | — | — | Google OAuth via backend redirect |
| Gmail OAuth | MISSING | — | — | — | Backend-mediated Gmail OAuth connection |
| Investigation trigger | MISSING | — | — | — | "Scan Inbox" wired to API |
| Investigation progress UI | MISSING | — | — | — | New screen with real/honest status |
| API client | MISSING | — | — | — | Centralized fetch client with auth header |
| Query / cache layer | MISSING | — | — | — | TanStack Query v5 |
| Auth state | MISSING | — | — | — | Auth context + protected route component |
| Entitlement state | MISSING | — | — | — | Centralized entitlement context from backend |
| Discovery detail | MISSING | — | — | — | New page |
| Locked discovery | MISSING | — | — | — | New locked state on Discovery card |
| Dashboard | MISSING | — | — | — | New page (agent status + discoveries) |
| Subscription UI | MISSING | — | — | — | Extend /app/subscriptions |
| Stripe Checkout | MISSING | — | — | — | Backend session → redirect |
| Customer Portal | MISSING | — | — | — | Backend session → redirect |
| Reminder creation | MISSING | — | — | — | New modal/action flow |
| Calendar connection | MISSING | — | — | — | New contextual OAuth flow |
| Calendar availability | MISSING | — | — | — | New agent action UI |
| Detective Chat | MISSING | — | — | — | New chat screen |
| Agent action approval | MISSING | — | — | — | New approval pattern |
| Settings page | MISSING | — | — | — | Replace inline placeholder |
| Landing page | MISSING | — | — | — | New public page |
| Onboarding | MISSING | — | — | — | New flow |
| Error states | MISSING | — | — | — | Needed throughout |
| Loading states | MISSING | — | — | — | Needed throughout |
| Empty states | MISSING | — | — | — | Needed throughout |
| Toast/notifications | MISSING | — | — | — | Lightweight toast system |
| Analytics | MISSING | — | — | — | Event tracking |
| Error monitoring | MISSING | — | — | — | Sentry or equivalent |
| Tests | MISSING | — | — | — | See Section 36 |

---

## SECTION 7 — Existing UI to Preserve

### Preserve Without Change
- **Build tooling:** Vite config, Tailwind config, TypeScript config — mature, correct for this stack
- **Docker setup:** Works for dev and prod; no changes needed for V1
- **Chrome Extension structure:** `manifest.json`, content script injection pattern, Vite extension build
- **Visual design language:** Gray palette, white cards, `rounded-xl`, system font stack — this is the product's visual identity

### Preserve With Extension
- **`Sidebar.tsx`** — Shell and navigation pattern are correct; extend, do not replace
- **`FeaturedOfferCard.tsx`** — Card layout is right for featured Discoveries; extend props and actions
- **`OfferListItem.tsx`** — List row pattern is right; extend for Discovery types and locked state
- **`StatCard.tsx`** — Exactly right for stats in discovery results and dashboard
- **`OffersPage.tsx`** — Layout pattern (stats → featured grid → list) maps well to the Discovery list page; refactor to use real data rather than rewrite

### Why
These components define the product's visual character. The clean gray/white minimal aesthetic is appropriate for an intelligent assistant product. Replacing them would require justifying a full visual redesign, which has no user-facing benefit at launch.

---

## SECTION 8 — Technical Debt / Duplicate / Dead UI

| Issue | Type | Priority | Notes |
|-------|------|----------|-------|
| `CompaniesPage` stub | Dead route | P1 | Remove or repurpose; "Companies" doesn't map to V1 IA |
| `SavedPage` stub | Dead route | P1 | Fold saved-state into Discoveries filter |
| Inline `/settings` placeholder | Dead route | P0 | Must be implemented for V1 |
| Inline `/help` placeholder | Dead | P2 | Defer post-launch |
| "Scan Inbox" button has no handler | Non-functional | P0 | Must wire to backend |
| "Connected" hardcoded in Sidebar | Misleading | P0 | Must show real Gmail connection state |
| Filter tabs not wired to data in `OffersPage` | Non-functional | P1 | Wire to real API params |
| Search input not wired to data in `OffersPage` | Non-functional | P1 | Wire to real API |
| Mock data in `src/data/mockOffers.ts` | Technical debt | P1 | Retained for dev/testing until real API exists |
| Chrome extension popup uses `localhost:5173` hardcoded URL | Configuration issue | P1 | Should be an environment variable |
| `index.html` title is "inbox-detection-ui" | Polish | P2 | Should be "Inbox Detective" |
| No `<meta>` description, OG tags | SEO/sharing | P1 | Add before launch |
| No `favicon.svg` (referenced but absent) | Broken asset | P2 | Create favicon |
| `chrome-extension/popup/App.tsx` duplicates card/badge patterns from main app | Duplication | P2 | Share component if feasible post-V1 |
| `package.json` name is "inbox-detection-ui" | Cosmetic | P2 | Rename to "inbox-detective" |

---

## SECTION 9 — Gap Analysis

| Requirement | Current Capability | Missing Behavior | Recommended Approach | Existing Code Reused | Priority |
|------------|-------------------|-----------------|---------------------|---------------------|----------|
| Landing page | None | Public marketing page with CTA | New `/` route, simple page | Visual design language | P0 |
| Google Sign-In | None | Auth entry point | Google OAuth via backend redirect | None | P0 |
| Auth state / protected routes | None | Authenticated shell | Auth context + `<ProtectedRoute>` wrapper | Router setup | P0 |
| Gmail OAuth connection | None | Connect Gmail to backend | Post-auth OAuth redirect flow | None | P0 |
| Investigation trigger | Non-functional "Scan Inbox" button | Wire to backend + show progress | Wire button + new investigation screen | Sidebar button | P0 |
| Investigation progress UI | None | Real-time/polled status | New screen, polling, honest async states | StatCard pattern | P0 |
| Real Discovery data | Mock data | Backend API, real Discoveries | API client + TanStack Query | OffersPage layout | P0 |
| Discovery types (subscriptions, money, expirations, etc.) | One generic "Offer" type | Typed Discovery rendering | Extend `Offer` type → `Discovery` union type | Types, card components | P0 |
| Discovery detail | None | Drill-in to see why + source + actions | New route `/app/discoveries/:id` | Card/layout patterns | P0 |
| Locked discoveries (Free limit) | None | Show that more exist, CTA to upgrade | Locked card variant + paywall modal | FeaturedOfferCard | P0 |
| Dashboard | Offers page (partial) | Agent status, key discoveries, summary | Extend/replace OffersPage with real Dashboard | StatCard, card components | P0 |
| Stripe Checkout | None | Upgrade CTA → backend session → redirect | Backend session request + redirect | None | P0 |
| Entitlement state | None | Plan-aware UI without scattered checks | Centralized EntitlementContext | None | P0 |
| Settings page | Inline placeholder | Account, Gmail status, billing, logout | New `SettingsPage` component | Sidebar, layout | P0 |
| Subscription UI | None | View detected subscriptions | New subscriptions list, extend Discovery pattern | OfferListItem | P1 |
| Reminder creation | None | Remind me flow with Free/Pro check | Reminder modal + API call | Modal pattern (new) | P1 |
| Calendar connection | None | Contextual OAuth trigger | New contextual prompt + OAuth redirect | None | P1 |
| Detective Chat | None | Conversational interface | New `/app/chat` page | None | P1 |
| Agent action approval | None | Confirm before consequential actions | Reusable approval dialog | None | P1 |
| Billing settings | None | Plan display + Customer Portal | `/app/settings/billing` | Settings layout | P1 |
| Daily Briefing | None | Pro briefing on dashboard | Can extend Dashboard | Dashboard | P1 |
| Empty states | None | "Nothing to show" states | Reusable `EmptyState` component | None | P1 |
| Loading states | None | Skeletons + spinners | Reusable skeleton/loading components | None | P0 |
| Error states | None | Useful error messages + retry | Reusable `ErrorState` component | None | P0 |
| Toast system | None | Action feedback | Lightweight toast context | None | P1 |
| Onboarding | None | Post-auth welcome + interests selection | New onboarding flow | None | P0 |
| Analytics | None | Funnel event tracking | Lightweight analytics client | None | P1 |
| Error monitoring | None | Production error visibility | Sentry integration | None | P1 |
| Responsive layout | Desktop-only layout | Mobile/tablet must not be broken | Audit + fix critical responsive issues | All | P1 |
| Account deletion | None | Deliberate delete flow | Settings section | None | P1 |

---

## SECTION 10 — Proposed Information Architecture

### Navigation Structure

```
/ (public — Landing)
/auth/callback (public — OAuth return)
/onboarding (semi-public — post-auth, pre-Gmail)
  /onboarding/connect-gmail
  /onboarding/interests
  /onboarding/investigating
  /onboarding/results (first discoveries)

/app (authenticated shell — shares Sidebar)
  /app/dashboard
  /app/discoveries
  /app/discoveries/:id
  /app/subscriptions
  /app/chat
  /app/settings
    /app/settings/billing
```

### Navigation Items (updated Sidebar)

```
[Detective Status indicator]
──────────────────────────
Dashboard
Discoveries     [badge: N new]
Subscriptions
Detective Chat
──────────────────────────
Settings
──────────────────────────
[Scan Inbox / Investigating... button]
```

### IA Rationale

- **Dashboard** replaces the current default. It shows the agent's current state and highest-priority discoveries.
- **Discoveries** replaces "Offers" — it is the primary content object.
- **Subscriptions** is a dedicated view because subscription monitoring is a top-level V1 product value.
- **Detective Chat** is top-level because it is a core Pro feature used frequently.
- **Companies** and **Saved** as top-level nav items are removed — "Saved" becomes a filter on Discoveries; "Companies" is subsumed by Subscriptions.
- **Settings** consolidates all account management including billing.

---

## SECTION 11 — Proposed Frontend Architecture

### Application Shell

```
src/
  main.tsx                      # Entry point (unchanged)
  App.tsx                       # Router root, auth context providers
  index.css                     # Tailwind directives (unchanged)

  # Core providers / infrastructure
  contexts/
    AuthContext.tsx              # User session state
    EntitlementContext.tsx       # Plan + feature flags from backend
  
  # API layer
  lib/
    apiClient.ts                 # Centralized fetch wrapper (auth header, error handling)
    queryClient.ts               # TanStack Query client config
  
  # Hooks (shared)
  hooks/
    useAuth.ts
    useEntitlements.ts
    useInvestigation.ts
    useDiscoveries.ts

  # Shared UI components (design system)
  components/
    # Existing (keep)
    Sidebar.tsx                  # Extended
    StatCard.tsx                 # Unchanged
    FeaturedOfferCard.tsx        # → DiscoveryCard.tsx (extended)
    OfferListItem.tsx            # → DiscoveryListItem.tsx (extended)
    # New shared
    LoadingSpinner.tsx
    SkeletonCard.tsx
    EmptyState.tsx
    ErrorState.tsx
    Toast.tsx / ToastContext.tsx
    Modal.tsx
    LockedDiscoveryCard.tsx
    AgentStatusBadge.tsx

  # Feature modules
  pages/
    # Public
    LandingPage.tsx
    # Onboarding
    onboarding/
      WelcomePage.tsx
      ConnectGmailPage.tsx
      InvestigationProgressPage.tsx
      InvestigationResultsPage.tsx
    # App
    DashboardPage.tsx
    discoveries/
      DiscoveriesPage.tsx
      DiscoveryDetailPage.tsx
    SubscriptionsPage.tsx
    ChatPage.tsx
    settings/
      SettingsPage.tsx
      BillingPage.tsx

  # Internationalization
  i18n/
    index.ts                     # i18next init: detection, fallback, namespace config
    locales/
      en/
        common.json              # Shared: nav, buttons, actions, status labels
        public.json              # Landing page + marketing copy
        onboarding.json          # Welcome, Gmail connect, interests
        investigation.json       # Progress states, results summary
        discoveries.json         # Discovery types, titles, actions, evidence labels
        subscriptions.json       # Subscription overview, detail, price history
        detective.json           # Chat UI, daily briefing, agent states
        calendar.json            # Calendar connection + meeting flow
        reminders.json           # Reminder creation + confirmation
        billing.json             # Plans, upgrade copy, checkout states
        settings.json            # Account, connections, preferences, privacy
        errors.json              # User-facing error codes → messages
      es/
        (mirrors en/ — all 12 files)

  # Formatting utilities
  lib/
    formatting.ts                # formatDate, formatCurrency, formatNumber — all use Intl APIs

  # Type definitions (extended)
  types/
    index.ts                     # Discovery, Subscription, Entitlement, User types

  # Mock data (retained for dev)
  data/
    mockOffers.ts                # Retained during development

chrome-extension/                # Separate artifact — minimal V1 changes
```

### Key Architecture Decisions

1. **TanStack Query v5** for all server state (add as dependency). No competing query libraries.
2. **React Context** for auth + entitlement state (lightweight, no Redux/Zustand needed at this scale).
3. **Centralized API client** in `lib/apiClient.ts` — all API calls go through it, not direct `fetch` in components.
4. **Entitlement checks** via `useEntitlements()` hook only — never `user.plan === 'free'` inline in JSX.
5. **Existing Tailwind CSS** — no new UI framework.
6. **Existing Lucide React** — no new icon library.
7. **React Router v7** — extend existing BrowserRouter, add `<ProtectedRoute>` wrapper.
8. **react-i18next** for all user-facing strings — no hardcoded copy anywhere in components. Every new V1 component must use `useTranslation()` from day one.
9. **`useLocale()` hook** centralizes locale state — wraps i18next, persists to `localStorage`, updates `<html lang>`, injects `Accept-Language` header via `apiClient`.
10. **`src/lib/formatting.ts`** for all date/number/currency presentation — uses `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.RelativeTimeFormat` with the active locale. Never format inline in components.

---

## SECTION 12 — User Journey A: New User Investigation

```
/ (Landing)
  → CTA: "Investigate my inbox"
  → Renders LandingPage.tsx
  
→ /auth/callback (Google OAuth redirect)
  → AuthCallbackPage.tsx
  → Exchanges code for session with backend
  → Sets auth state in AuthContext
  → Redirects to /onboarding
  
→ /onboarding (WelcomePage.tsx)
  → "Welcome to Inbox Detective"
  → Brief product explanation
  → CTA: "Connect Gmail"
  
→ /onboarding/connect-gmail (ConnectGmailPage.tsx)
  → Explain what access is requested
  → CTA triggers backend Gmail OAuth redirect
  → OAuth return: backend sets Gmail connection state
  → Redirect to /onboarding/interests
  
→ /onboarding/interests (InterestsPage.tsx — optional, keep short)
  → User selects: Subscriptions / Money & Credits / Expirations / Price Changes / Meetings
  → Stored as preferences for backend investigation focus
  → CTA: "Start investigation"
  
→ /onboarding/investigating (InvestigationProgressPage.tsx)
  → POST /investigations (trigger)
  → Poll GET /investigations/:id for status
  → Display: emails reviewed, categories found, honest progress
  → States: starting → running → complete / failed
  → On complete → redirect to /onboarding/results
  
→ /onboarding/results (InvestigationResultsPage.tsx)
  → Shows: X emails analyzed, N discoveries found, $Y potential value
  → Shows 3–5 real discoveries (DiscoveryCard)
  → Shows locked count if Free limit reached (LockedDiscoveryCard)
  → CTA: "See all discoveries" → /app/discoveries
  → CTA: "Unlock with Pro" → /upgrade (if locked)
```

**Backend dependencies:** Google OAuth endpoint, Gmail OAuth endpoint, POST /investigations, GET /investigations/:id (polling), GET /discoveries (with entitlement filter), GET /user/entitlements

**Loading states:** Auth redirect spinner, OAuth consent (external), investigation progress screen (honest async), discovery skeleton cards

**Error states:** OAuth failure (explain + retry), Gmail revoked (reconnect CTA), investigation failure (retry + support link)

**Analytics:** `signup_started`, `signup_completed`, `gmail_connect_started`, `gmail_connected`, `investigation_started`, `investigation_completed`

---

## SECTION 13 — User Journey B: Free → Pro

```
/app/discoveries (DiscoveriesPage.tsx)
  → User sees 3–5 real discoveries
  → Locked section: "8 more discoveries found 🔒"
  → LockedDiscoveryCard components (show category, company initial, vague value indicator)
  → CTA: "Unlock with Pro"

→ /upgrade (UpgradePage.tsx or modal)
  → Context-aware message: "You found 8 more things worth your attention"
  → Plan card: Pro $5.99/month
  → CTA: "Upgrade to Pro"
  → Store pre-upgrade context: { from: 'locked_discoveries', returnPath: '/app/discoveries' }

→ Backend: POST /billing/checkout-session
  → Returns Stripe Checkout URL
  → Redirect to Stripe Checkout (external)

→ Stripe Checkout (external)
  → User completes payment

→ Return to /upgrade/success?session_id=...
  → UpgradeSuccessPage.tsx
  → Loading: "Activating your Pro access..."
  → Poll or refresh: GET /user/entitlements until plan === 'pro'
  → EntitlementContext updates
  → Redirect to stored returnPath (/app/discoveries)

→ /app/discoveries (Pro view)
  → All discoveries now visible
  → Locked cards replaced with real cards
  → Success toast: "Pro activated — all discoveries unlocked"
```

**Context preservation:** Store `{ returnPath, intent }` in sessionStorage before Stripe redirect so the return URL can navigate correctly.

**Backend dependencies:** GET /user/entitlements, POST /billing/checkout-session, GET /billing/checkout-session/:id (status check)

**Error states:** Checkout initiation failure (retry), payment failure (Stripe handles), entitlement refresh timeout (manual refresh button)

**Analytics:** `paywall_viewed`, `checkout_started`, `checkout_completed`, `pro_activated`

---

## SECTION 14 — User Journey C: Subscription

```
/app/discoveries (or /app/subscriptions)
  → Subscription discovery in list
  → User clicks → /app/discoveries/:id (DiscoveryDetailPage.tsx)

DiscoveryDetailPage.tsx (type: subscription)
  → Company, product, price, frequency, annualized cost, renewal date
  → Price history section (if data available): previous → current, % change
  → "Why did Detective flag this?" — evidence section with source email
  → Source email button → opens EmailDrawer.tsx

Actions:
  → "Remind me" → ReminderModal.tsx (see Journey E)
  → "Open provider" → external link
  → "View source" → EmailDrawer.tsx
  → "Dismiss" → API call, optimistic hide

EmailDrawer.tsx:
  → Slides in from right
  → Shows relevant email data: sender, subject, date, relevant excerpt
  → Does NOT render full raw HTML — show safe sanitized excerpt or link to Gmail
  → "Open in Gmail" external link
```

**Backend dependencies:** GET /discoveries/:id, GET /discoveries/:id/source-evidence, PATCH /discoveries/:id/dismiss

---

## SECTION 15 — User Journey D: Meeting

```
/app/discoveries
  → Meeting request discovery
  → User clicks → /app/discoveries/:id (type: meeting)

DiscoveryDetailPage.tsx (type: meeting)
  → "Sarah wants to schedule a meeting"
  → Requested: Tuesday afternoon
  → Action: "Find a time"
  → If Calendar NOT connected → CalendarConnectPrompt.tsx inline
    → "Connect Google Calendar so Detective can find available times"
    → CTA: "Connect Calendar"
    → OAuth redirect → return to same discovery

→ If Calendar IS connected:
  → POST /agent-actions/find-availability { discoveryId }
  → AgentActionPanel.tsx: "Checking your calendar..." (THINKING state)
  → Response: available slots
  → AgentActionPanel.tsx: PROPOSING state
    → Tuesday 2:00 PM / 3:30 PM / 4:30 PM (selectable)
  → User selects 2:00 PM
  → AgentActionPanel.tsx: WAITING_FOR_APPROVAL state
    → "Create meeting Tuesday at 2:00 PM?"
    → [Create meeting] button
  → POST /agent-actions/:id/approve
  → AgentActionPanel.tsx: EXECUTING state "Creating calendar event..."
  → VERIFYING state "Confirming..."
  → DONE state
    → "✓ Calendar event created — Tuesday, Sep 22, 2:00 PM"
    → "✓ Response drafted"
    → Show draft email
    → [Send response] (Level 3 approval — prominent confirm)
  → POST /agent-actions/:id/send-email (explicit approval)
  → "✓ Response sent"
```

**Backend dependencies:** GET /calendar/status, POST /calendar/connect, POST /agent-actions/find-availability, POST /agent-actions/:id/approve, POST /agent-actions/:id/send-email

---

## SECTION 16 — User Journey E: Reminder

```
Discovery (any type with a date/deadline)
  → Action button: "Remind me"

  If Free user:
    → ReminderPaywallPrompt.tsx (inline or modal)
    → "Persistent reminders are a Pro feature"
    → CTA: "Enable with Pro" → /upgrade (with return context)

  If Pro user:
    → ReminderModal.tsx
    → Options: Tomorrow / 1 day before / 3 days before / 7 days before / Custom date
    → [Set reminder] button
    → Loading state: spinner on button
    → Success state:
      → Modal closes
      → Toast: "✓ I'll remind you [date]"
      → Discovery action button changes to "Reminder set ✓"
    → Error state:
      → Error message in modal
      → Retry available
    
  If reminder already set:
    → Discovery shows "Reminder: Sep 21 ✓"
    → Action: "Edit reminder" → opens ReminderModal pre-filled
    → Or: "Cancel reminder" → confirmation → API delete
```

**Backend dependencies:** POST /reminders, GET /reminders?discoveryId=:id, DELETE /reminders/:id, PATCH /reminders/:id

---

## SECTION 17 — User Journey F: Detective Chat

```
/app/chat (ChatPage.tsx)
  → Empty state: "Ask me anything about your inbox"
  → Suggested prompts: "What subscriptions am I paying for?" etc.
  → Input: text field + send

  → User types question
  → POST /chat/messages { message }
  → Loading state: "Detective is thinking..." (animated dots)
  
  → Response renders:
    → Text answer
    → Linked Discovery cards (inline DiscoveryCard components)
    → Source email references (open EmailDrawer on click)
    → Follow-up action buttons where applicable

  If Free user with limit:
    → Counter shown: "2 of 5 questions used"
    → On limit hit: "You've used your free questions. Upgrade for unlimited access."
    → CTA: "Upgrade to Pro"

  If chat failure:
    → "Detective couldn't answer that right now. Try again."
    → Retry button
```

**Backend dependencies:** POST /chat/messages, GET /chat/history (optional), GET /user/entitlements (chat limit)

---

## SECTION 18 — User Journey G: Billing

```
/app/settings (SettingsPage.tsx)
  → "Billing" section / tab → /app/settings/billing

/app/settings/billing (BillingPage.tsx)
  → Current plan: Free / Pro
  → If Pro: renewal date, status (active / cancelling)
  → If Pro cancelling: "Subscription ends [date]" + option to reactivate
  → CTA (Pro): "Manage subscription" 
    → POST /billing/portal-session → redirect to Stripe Customer Portal (external)
    → Return to /app/settings/billing
    → Refresh entitlement state
  → CTA (Free): "Upgrade to Pro" → /upgrade

Return from Stripe Portal:
  → /app/settings/billing?portal_return=1
  → Refresh: GET /user/entitlements
  → Display updated state
```

**Backend dependencies:** GET /user/billing-status, POST /billing/portal-session

---

## SECTION 19 — User Journey H: Disconnect / Delete

### Disconnect Gmail

```
/app/settings → Connected Accounts → Gmail
  → Status: "Gmail connected ✓ — [email]"
  → Action: "Disconnect Gmail"
  → ConfirmModal.tsx:
    → "Disconnecting Gmail will stop all monitoring and investigations."
    → [Disconnect] (destructive button style)
  → DELETE /gmail/connection
  → Loading state
  → Success: redirect to /onboarding/connect-gmail with context "reconnect"
```

### Disconnect Calendar

```
/app/settings → Connected Accounts → Calendar
  → Status: "Calendar connected ✓" or "Not connected"
  → If connected: "Disconnect Calendar"
  → ConfirmModal.tsx:
    → "Disconnecting Calendar will disable meeting scheduling."
  → DELETE /calendar/connection
  → Success: settings page refreshed, status shows "Not connected"
```

### Delete Account

```
/app/settings → Account → "Delete account and data"
  → ConfirmModal.tsx (multi-step):
    1. "This will permanently delete your account and all imported data."
    2. "Type 'delete' to confirm" (text input)
    3. [Delete my account] (red destructive button)
  → Loading: "Deleting your account..."
  → DELETE /account
  → Success: logout → redirect to /
  → Error: "Account deletion failed. Contact support."
```

---

## SECTION 20 — Discovery Component Architecture

### Primary Component: `DiscoveryCard`

Evolves from `FeaturedOfferCard`. Accepts a `Discovery` union type and renders appropriately:

```typescript
type DiscoveryType = 
  | 'subscription' | 'renewal' | 'price_change'
  | 'credit' | 'refund' | 'expiration'
  | 'meeting' | 'trial_expiration' | 'bill_change';

interface Discovery {
  id: string;
  type: DiscoveryType;
  title: string;
  company: string;
  companyInitials: string;
  amount?: string;
  frequency?: string;
  date?: string;       // renewal / expiration date
  importance: 'high' | 'medium' | 'low';
  status: 'new' | 'viewed' | 'acted' | 'dismissed';
  locked?: boolean;
  availableActions: DiscoveryAction[];
  summary: string;     // "Why it matters" one-liner
}
```

**Component variants:**
- `DiscoveryCard` — featured card (extends `FeaturedOfferCard`)
- `DiscoveryListItem` — list row (extends `OfferListItem`)
- `LockedDiscoveryCard` — blurred/locked variant (new)
- `DiscoveryDetailView` — full detail page content (new)

**One component architecture for all Discovery types.** Type-specific rendering is handled via helper functions and small sub-components inside `DiscoveryCard`, not separate top-level components per type.

**Discovery actions:** Rendered as a prioritized list. Each action has a `level` (1=automatic, 2=approval, 3=explicit confirmation). Only level 2 and 3 are shown in UI.

---

## SECTION 21 — Agent Interaction Architecture

### Reusable `AgentActionPanel` Component

Used for Calendar, Email, and future actions. Renders based on current `AgentActionState`:

```typescript
type AgentActionState =
  | 'idle'
  | 'thinking'      // POST sent, awaiting response
  | 'proposing'     // Backend returned proposal, user chooses
  | 'approving'     // User confirmed, waiting for execution
  | 'executing'     // Backend running the action
  | 'verifying'     // Backend confirming result
  | 'done'          // Success
  | 'failed';       // Error with retry option
```

Each state renders a distinct UI block within the panel:
- `thinking`: animated "Detective is working..." with subtle indicator
- `proposing`: selectable options list (calendar slots, drafted text)
- `approving`: confirmation card with clear action description + [Confirm] [Cancel]
- `executing`: progress indicator
- `verifying`: "Confirming..."
- `done`: success message + result summary
- `failed`: error message + [Retry] + [Get help]

**Calendar, Reminder, and Email Sending all reuse `AgentActionPanel`** — they pass different state and content through props.

---

## SECTION 22 — State Architecture

### AuthContext

```typescript
interface AuthState {
  user: User | null;            // null = unauthenticated
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}
```

Initialized from a GET /auth/me on app load. Stores session in a cookie (httpOnly, managed by backend).

### EntitlementContext

```typescript
interface EntitlementState {
  plan: 'free' | 'pro';
  entitlements: {
    visibleDiscoveries: number;
    continuousMonitoring: boolean;
    reminders: boolean;
    calendarActions: boolean;
    emailActions: boolean;
    dailyBriefing: boolean;
    chatQuestionsRemaining: number | null; // null = unlimited
  };
  isLoading: boolean;
  refresh: () => Promise<void>;
}
```

Initialized after auth. Provides `useEntitlements()` hook. **All paywall gates use this hook only.**

### Server State (TanStack Query)

| Key | Hook | Description |
|-----|------|-------------|
| `['user']` | `useUser()` | Current user profile |
| `['entitlements']` | `useEntitlements()` | Plan + feature flags |
| `['investigations', id]` | `useInvestigation(id)` | Investigation status (polling) |
| `['discoveries']` | `useDiscoveries(filters)` | Discovery list |
| `['discoveries', id]` | `useDiscovery(id)` | Discovery detail |
| `['subscriptions']` | `useSubscriptions()` | Subscription list |
| `['chat', sessionId]` | `useChatMessages()` | Chat history |
| `['reminders']` | `useReminders()` | User's reminders |
| `['billing']` | `useBillingStatus()` | Plan + renewal info |
| `['gmail-status']` | `useGmailStatus()` | Gmail connection state |
| `['calendar-status']` | `useCalendarStatus()` | Calendar connection state |

### Local UI State (useState / useReducer)

- Modal open/close
- Filter selection
- Search input
- Toast queue (ToastContext)
- Agent action panel state per action

---

## SECTION 23 — API Requirements

| Feature | Endpoint | Method | Request | Response | Auth | Entitlement | Existing/New | Blocking? | UI Consumer |
|---------|----------|--------|---------|----------|------|-------------|-------------|----------|------------|
| Google Sign-In | `/auth/google` | GET | — | Redirect | None | None | New | Yes | LandingPage → redirect |
| Google Callback | `/auth/callback` | GET | `?code=` | `{ user, sessionCookie }` | None | None | New | Yes | AuthCallbackPage |
| Get current user | `/auth/me` | GET | — | `User` | Session | None | New | Yes | AuthContext init |
| Logout | `/auth/logout` | POST | — | `{ ok }` | Session | None | New | No | Settings |
| Get entitlements | `/user/entitlements` | GET | — | `EntitlementState` | Session | None | New | Yes | EntitlementContext |
| Gmail OAuth start | `/gmail/connect` | GET | — | Redirect | Session | None | New | Yes | Onboarding |
| Gmail status | `/gmail/status` | GET | — | `{ connected, email, lastSync }` | Session | None | New | No | Sidebar, Settings |
| Disconnect Gmail | `/gmail/connection` | DELETE | — | `{ ok }` | Session | None | New | No | Settings |
| Start investigation | `/investigations` | POST | `{ preferences? }` | `{ id, status }` | Session | Free | New | No | InvestigationPage |
| Get investigation | `/investigations/:id` | GET | — | `{ status, stats, progress }` | Session | None | New | Yes (polling) | InvestigationProgressPage |
| List discoveries | `/discoveries` | GET | `?type=&status=&page=` | `{ items: Discovery[], locked: number, total }` | Session | Free (count) | New | No | DiscoveriesPage |
| Get discovery | `/discoveries/:id` | GET | — | `Discovery` (full) | Session | Pro for locked | New | No | DiscoveryDetailPage |
| Get source evidence | `/discoveries/:id/source` | GET | — | `{ emails: EmailSummary[] }` | Session | None | New | No | DiscoveryDetailPage |
| Dismiss discovery | `/discoveries/:id` | PATCH | `{ status: 'dismissed' }` | `Discovery` | Session | None | New | No | DiscoveryCard |
| List subscriptions | `/subscriptions` | GET | — | `Subscription[]` | Session | None | New | No | SubscriptionsPage |
| Send feedback | `/discoveries/:id/feedback` | POST | `{ signal: 'useful'\|'not_useful'\|'never_show' }` | `{ ok }` | Session | None | New | No | DiscoveryCard |
| Create reminder | `/reminders` | POST | `{ discoveryId, remindAt }` | `Reminder` | Session | Pro | New | No | ReminderModal |
| List reminders | `/reminders` | GET | `?discoveryId=` | `Reminder[]` | Session | Pro | New | No | DiscoveryDetail |
| Delete reminder | `/reminders/:id` | DELETE | — | `{ ok }` | Session | Pro | New | No | ReminderModal |
| Calendar status | `/calendar/status` | GET | — | `{ connected }` | Session | None | New | No | Settings, CalendarPrompt |
| Calendar connect | `/calendar/connect` | GET | — | Redirect | Session | Pro | New | Yes | CalendarConnectPrompt |
| Disconnect calendar | `/calendar/connection` | DELETE | — | `{ ok }` | Session | None | New | No | Settings |
| Find availability | `/agent-actions/availability` | POST | `{ discoveryId }` | `AgentAction` | Session | Pro | New | No | AgentActionPanel |
| Approve agent action | `/agent-actions/:id/approve` | POST | `{ selection? }` | `AgentAction` | Session | Pro | New | No | AgentActionPanel |
| Send email (agent) | `/agent-actions/:id/send` | POST | `{}` | `AgentAction` | Session | Pro | New | No | AgentActionPanel |
| Chat message | `/chat/messages` | POST | `{ message }` | `{ answer, sources }` | Session | Free (limit) | New | No | ChatPage |
| Chat history | `/chat/messages` | GET | — | `ChatMessage[]` | Session | None | New | No | ChatPage |
| Stripe checkout | `/billing/checkout-session` | POST | `{ returnPath }` | `{ url }` | Session | None | New | No | UpgradePage |
| Stripe portal | `/billing/portal-session` | POST | — | `{ url }` | Session | Pro | New | No | BillingPage |
| Billing status | `/billing/status` | GET | — | `{ plan, renewalDate, status }` | Session | None | New | No | BillingPage |
| Delete account | `/account` | DELETE | `{ confirmation: 'delete' }` | `{ ok }` | Session | None | New | No | Settings |

---

## SECTION 24 — Free / Pro Entitlement UX

### Capability Matrix

| Capability | Free | Pro | Locked UI |
|-----------|------|-----|----------|
| Gmail investigation (once) | ✓ | ✓ | — |
| Visible discoveries | 3–5 | Unlimited | `LockedDiscoveryCard` with count |
| Continuous monitoring | — | ✓ | Dashboard status shows "Manual only" |
| Subscription detection | ✓ (partial) | ✓ (full) | — |
| Discovery detail | ✓ (unlocked only) | ✓ | Paywall on locked |
| Reminders | — | ✓ | `ReminderPaywallPrompt` inline |
| Daily Briefing | — | ✓ | Dashboard teaser section |
| Detective Chat | Limited (N questions) | Unlimited | Counter + prompt on limit |
| Calendar connection | — | ✓ | Contextual prompt when needed |
| Meeting scheduling | — | ✓ | Contextual prompt in meeting discovery |
| Email drafting | — | ✓ | Contextual prompt |
| Price change history | — | ✓ | Locked in discovery detail |
| Full scan history | — | ✓ | Locked in settings |

### Implementation Rules

1. **`useEntitlements()` is the only entitlement access point.** No inline `plan === 'free'` checks.
2. **Paywall gates are components**, not logic inside page components:
   - `<RequiresPro feature="reminders">` wraps actions that need Pro
   - Falls back to `<UpgradePrompt feature="reminders" />` for Free users
3. **Entitlement state comes entirely from backend.** Never hard-code feature limits.
4. **Entitlement is refreshed after Stripe return.** Poll until updated or timeout with manual refresh.

---

## SECTION 25 — Stripe UX Plan

### Upgrade CTA Locations
- Locked discovery cards (primary)
- Reminder action for Free users
- Calendar action for Free users
- Chat limit reached
- Dashboard "upgrade" banner
- Settings / Billing page

### Pricing Options
- **Monthly:** $5.99/month (V1 launch)
- **Annual:** $49/year (optional, PRD §27) — present as a toggle on the upgrade page if Stripe has a second price ID configured. V1 may launch monthly-only; annual is additive and requires only a second `priceId` in the checkout session request. Do not block launch on annual option.

### Checkout Flow

1. User clicks upgrade CTA
2. Store `{ returnPath, intent }` in `sessionStorage`
3. Show loading state ("Setting up checkout...")
4. `POST /billing/checkout-session { returnPath: '/upgrade/success', priceId }` — `priceId` selects monthly or annual
5. Redirect to Stripe Checkout (external page — do NOT replicate)
6. Stripe redirects to `/upgrade/success?session_id=...`
7. `UpgradeSuccessPage`: "Activating Pro..." — poll entitlements until `plan === 'pro'` (max 10s, then manual refresh)
8. Read `returnPath` from `sessionStorage`, navigate there
9. Toast: "Pro activated — welcome to Inbox Detective Pro"

### Customer Portal Flow

1. User clicks "Manage subscription" in `/app/settings/billing`
2. `POST /billing/portal-session { returnUrl: window.location.href }`
3. Redirect to Stripe Customer Portal
4. Return to `/app/settings/billing`
5. Refresh `useBillingStatus()` and `useEntitlements()`

### States

| State | UI |
|-------|-----|
| Checkout loading | Button spinner, "Setting up..." |
| Checkout error | Toast: "Could not start checkout. Try again." |
| Stripe Checkout | External (Stripe owns) |
| Return / activating | Full-screen "Activating Pro..." with progress |
| Entitlement timeout | "Still activating... [Refresh]" |
| Cancellation state | "Pro ends [date]" in billing settings |

---

## SECTION 26 — Calendar UX Plan

### Connection
- **Not required during onboarding** unless user triggers a meeting action
- Contextual prompt appears when user clicks "Find a time" on a meeting discovery (Free → Pro gate first)
- Prompt: "Connect Google Calendar so Detective can find available times" + [Connect Calendar]
- `GET /calendar/connect` → OAuth redirect → return to same discovery
- Context preserved: store `{ returnPath: '/app/discoveries/:id' }` before OAuth redirect

### Availability Flow
- `POST /agent-actions/availability { discoveryId }` after Calendar connected
- `AgentActionPanel` transitions: idle → thinking → proposing
- Proposing: rendered list of time slots, user taps to select
- Selected: transitions to `approving` state

### Event Creation
- `POST /agent-actions/:id/approve { selectedSlot }`
- Transitions: approving → executing → verifying → done
- Done: shows "✓ Meeting created — [date/time]"

### Email Draft
- Shown after event creation if applicable
- [Send response] renders a Level 3 approval button (prominent, not dismissable by accident)

### Disconnect
- In Settings → Connected Accounts → "Disconnect Calendar"
- Confirm modal → DELETE /calendar/connection

### Failure States
- OAuth failure: "Calendar connection failed" + retry
- Availability fetch failure: "Couldn't check calendar" + retry
- Creation failure: "Event not created" + retry, what changed explained

---

## SECTION 27 — Reminder UX Plan

### Free User Flow
- Click "Remind me" on any dated discovery
- `<RequiresPro feature="reminders">` renders `<UpgradePrompt>`
- "Reminders require Pro — [Unlock with Pro]"
- Preserve context: after upgrade, return to same discovery and auto-trigger reminder

### Pro User Flow
- `ReminderModal` opens
- Options: Tomorrow / 1 day before deadline / 3 days before / 7 days before / Custom (date picker)
- [Set reminder] → `POST /reminders { discoveryId, remindAt }`
- Button loading state
- On success:
  - Modal closes
  - Toast: "✓ I'll remind you [formatted date]"
  - Discovery card/detail updates action to "Reminder set ✓"

### Existing Reminder
- Discovery shows "Reminder: [date] ✓" in metadata
- Click → modal opens pre-filled
- Options: Update / Cancel reminder
- Cancel: confirm → `DELETE /reminders/:id` → optimistic update

### Error States
- Failed to create: "Reminder not set. Try again." (stays in modal)
- Retry available in modal

---

## SECTION 28 — Detective Chat UX Plan

### Layout (ChatPage.tsx)
```
┌─────────────────────────────────┐
│ Detective Chat                  │
├─────────────────────────────────┤
│                                 │
│  [Suggested prompts if empty]   │
│                                 │
│  [User message bubble]          │
│  [Detective response bubble]    │
│    └── [Linked Discovery card]  │
│    └── [Source reference chip]  │
│                                 │
│  [User message]                 │
│  [Loading: "Detective is...]    │
│                                 │
├─────────────────────────────────┤
│ [2 of 5 questions] (Free)       │
│ [Message input] [Send]          │
└─────────────────────────────────┘
```

### Existing Chat Reused
None — chat does not exist. `ChatPage` is entirely new.

### Message Rendering
- User messages: right-aligned, gray bubble
- Detective responses: left-aligned, white card with subtle border
- Discovery references: inline `DiscoveryCard` (compact) within response
- Source references: `"Source: Adobe email, Sep 14"` chip, opens `EmailDrawer` on click

### Free Limit
- Counter shown in footer: "2 of 5 questions used"
- On limit: Chat input disabled, paywall prompt in footer
- Entitlement refreshed on page load

### States
- Empty: suggested prompts grid ("What subscriptions am I paying for?" etc.)
- Loading: "Detective is thinking..." with animated dots
- Response: streamed or full text + discovery cards + source chips
- Error: "Couldn't answer that. [Try again]"
- Limit reached: "Upgrade for unlimited Detective access"

---

## SECTION 29 — Settings Plan

### Route: `/app/settings` (SettingsPage.tsx)

**Tab / section structure:**

```
Account
  → Display name, email (read-only from Google)
  → [Logout]
  → [Delete account] (destructive, at bottom)

Connected Accounts
  → Gmail: status, email, last sync, [Disconnect]
  → Calendar: status, [Connect] or [Disconnect]

Detective
  → Investigation preferences (from onboarding interests)
  → Notification email (if backend supports)

Billing
  → Plan: Free / Pro
  → If Pro: renewal date, status
  → [Manage subscription] (Stripe Portal) or [Upgrade to Pro]

Privacy
  → Link: Privacy Policy
  → Link: Terms of Service
  → [Request data export] (if supported)
  → [Delete account and data]
```

### Reuse Existing
- Page layout pattern from existing pages
- Sidebar navigation (already links to `/settings`)
- ConfirmModal for destructive actions

---

## SECTION 30 — Loading / Empty / Error State Inventory

| Feature | Loading | Empty | Error | Retry/Recovery |
|---------|---------|-------|-------|----------------|
| App init (auth check) | Full-screen spinner | — | "Couldn't load session" + [Retry] | Reload |
| Gmail OAuth | "Connecting to Gmail..." | — | "Gmail connection failed" + [Try again] | Restart OAuth |
| Investigation start | "Starting investigation..." | — | "Couldn't start investigation" + [Try again] | Retry button |
| Investigation progress | Progress screen with live stats | — | "Investigation stopped" + details + [Retry] | Retry button |
| Discoveries list | Skeleton cards (3 rows) | "Nothing needs your attention right now. Detective is monitoring." | "Couldn't load discoveries" + [Refresh] | Pull to refresh |
| Discovery detail | Skeleton detail layout | — | "Couldn't load discovery" + [Go back] | Back button |
| Source evidence | Inline spinner | "No source available" | "Couldn't load source" | Retry inline |
| Subscriptions list | Skeleton rows | "No active subscriptions detected yet." | "Couldn't load subscriptions" | Refresh |
| Chat | — | Suggested prompts grid | "Couldn't reach Detective" + [Try again] | Retry send |
| Chat response | "Detective is thinking..." (animated) | — | "Couldn't answer that. [Retry]" | Inline retry |
| Reminders | Modal spinner | — | "Reminder not set. Try again." | Retry in modal |
| Calendar availability | AgentActionPanel: thinking | — | "Couldn't check calendar" + [Retry] | Retry in panel |
| Calendar creation | AgentActionPanel: executing | — | "Event not created" + explanation | Retry + alternative |
| Stripe Checkout session | Button spinner | — | Toast: "Checkout not available. Try again." | Retry button |
| Pro activation | Full-screen "Activating..." | — | "Still activating... [Refresh manually]" | Manual refresh |
| Billing status | Skeleton | — | "Couldn't load billing info" + [Refresh] | Refresh |
| Settings | Page skeleton | — | "Couldn't load settings" | Reload |
| Gmail disconnect | Modal spinner | — | "Disconnect failed" | Retry |
| Account delete | Full overlay "Deleting..." | — | "Deletion failed. Contact support." | Support link |

---

## SECTION 31 — Responsive Review

### P0 — Launch Blockers

| Issue | Impact |
|-------|--------|
| `w-48` fixed sidebar takes 25%+ width on small screens | Dashboard is unusable below ~640px |
| `grid-cols-2` featured card grid on `OffersPage` wraps badly on 360px mobile | Overlapping content |
| `max-w-5xl mx-auto px-8` has 32px padding — on 375px phone this leaves almost no content width | Poor readability |
| `w-80` fixed search input will overflow on small screens | Layout breakage |
| `h-screen` full height layout not handling mobile browsers' dynamic viewport (address bar resize) | Content clip |
| Chrome extension is fixed 380px — acceptable for extension, but popup index.html title also says "inbox-detection-ui" | Polish issue |

**Recommendation:** The primary launch target is desktop. Add a mobile-aware sidebar collapse (hamburger menu or slide-over) and ensure the main content area is usable at 375px width. Do not full-redesign for mobile at launch.

### P1 — Important

| Issue | Notes |
|-------|-------|
| Sidebar should collapse on tablet-width (768px) | Use a hamburger-menu pattern |
| Card grids should respond: `grid-cols-2 sm:grid-cols-2 grid-cols-1` for mobile | Quick Tailwind fix |
| Chat input area on mobile — keyboard pushes content | Use `dvh` units or scroll management |
| Settings tabs on mobile — horizontal scroll or stack | Evaluate at implementation |

### P2 — Polish

| Issue | Notes |
|-------|-------|
| No touch-specific tap targets audited | 44px minimum |
| No PWA manifest / mobile icons | Post-launch |

---

## SECTION 32 — Accessibility Review

### P0 — Launch Blockers

| Issue | Impact |
|-------|--------|
| Sidebar nav items are `<Link>` elements — ensure keyboard focus is visible | Tab navigation broken without visible focus |
| Filter buttons in `OffersPage` have no aria state | Screen readers don't know which is active |
| `<input>` search field has no `<label>` — only placeholder text | Screen reader can't identify field |
| Modal/Dialog (new) must trap focus and return focus on close | Standard dialog accessibility |
| Agent action confirmation buttons must be clearly labeled | "Confirm" alone is not enough context |
| Toast messages must be announced by screen readers | `role="status"` or `aria-live` needed |

### P1 — Important

| Issue | Notes |
|-------|-------|
| All icon-only buttons need `aria-label` | Settings icon, user icon in extension popup |
| Loading states should use `aria-busy` or `aria-live` | Dynamic content accessibility |
| Discovery "Dismiss" should be accessible with keyboard | Focus management after dismiss |
| Form inputs in settings need associated labels | Semantic HTML |

### P2 — Polish

| Issue | Notes |
|-------|-------|
| Color contrast audit on gray-500 text on white | Check against WCAG AA |
| Animation preference: add `prefers-reduced-motion` | Agent thinking animation |

---

## SECTION 33 — Privacy / Frontend Security Review

### P0 — Critical

| Issue | Classification | Notes |
|-------|---------------|-------|
| Email content in source evidence must be sanitized before rendering | P0 | Never use `dangerouslySetInnerHTML` with raw email HTML without DOMPurify |
| OAuth tokens must NOT be stored in localStorage | P0 | Session cookies managed by backend (httpOnly). Frontend never sees raw tokens. |
| Google OAuth `code` in URL after callback must not be logged to analytics | P0 | Clear it from URL after exchange |
| User email / PII must NOT be sent to analytics events | P0 | Track events, not identities |
| "Disconnect Gmail" and "Delete account" must require explicit confirmation | P0 | Prevents accidental data exposure |

### P1 — Important

| Issue | Notes |
|-------|-------|
| Authentication expiration must redirect to login, not silently fail | API 401 → clear auth state → redirect to `/` |
| Console.log statements must not output email content or auth tokens | Audit before launch |
| Entitlement state from backend only — no client-side override possible | Architecture enforces this |
| Account deletion confirmation input (type 'delete') prevents dark-pattern accidents | Implemented in UX plan |

### P2 — Polish

| Issue | Notes |
|-------|-------|
| Content Security Policy headers (nginx config) | Add restrictive CSP |
| Subresource integrity for any CDN assets | Audit if any added |

---

## SECTION 34 — Analytics Plan

### Existing Analytics
None. Analytics infrastructure is entirely missing.

### Recommended Approach
Add a lightweight analytics abstraction in `lib/analytics.ts` that wraps a provider (PostHog recommended for privacy-friendly self-hostable option, or Segment/Mixpanel). No personally identifiable information or email content in event payloads.

### Event Plan

| Event | Properties | When |
|-------|-----------|------|
| `landing_view` | — | LandingPage mount |
| `signup_started` | — | Google Sign-In CTA click |
| `signup_completed` | — | Auth callback success |
| `gmail_connect_started` | — | Gmail OAuth CTA click |
| `gmail_connected` | — | Gmail status confirmed connected |
| `investigation_started` | — | POST /investigations success |
| `investigation_completed` | `{ discoveriesFound, emailsAnalyzed }` | Investigation status = complete |
| `discovery_viewed` | `{ type, importance }` | Discovery detail page mount |
| `discovery_action_clicked` | `{ type, action }` | Any discovery action button |
| `discovery_dismissed` | `{ type }` | Dismiss action |
| `paywall_viewed` | `{ trigger, feature }` | Any paywall shown |
| `checkout_started` | — | Stripe Checkout session created |
| `checkout_completed` | — | Upgrade success page, entitlement updated |
| `pro_activated` | — | Entitlement plan = pro confirmed |
| `reminder_created` | `{ discoveryType }` | Reminder POST success |
| `calendar_connected` | — | Calendar status confirmed |
| `calendar_action_started` | `{ type }` | Agent action initiated |
| `calendar_action_completed` | `{ type }` | Agent action done state |
| `chat_question_asked` | — | Chat POST (no message content) |
| `feedback_submitted` | `{ signal, discoveryType }` | Feedback POST |

---

## SECTION 35 — Frontend Observability Plan

### Existing Monitoring
None.

### Recommended: Sentry

Add Sentry for error monitoring. Configure:
- Source maps uploaded at build time
- `beforeSend` filter: strip email content, user email, auth tokens from payloads
- User context: set user ID (non-PII) in Sentry context after auth
- Custom tags: `plan`, `gmail_connected`

### Error Boundaries

- **Root error boundary** wrapping `<App>` — catch unhandled rendering errors
- **Route-level boundaries** for each major page section
- **Agent action error boundary** — agent failures are isolated

### Critical Paths to Monitor

| Path | What to Track |
|------|--------------|
| Auth | OAuth callback failures, session restoration failures |
| Gmail | OAuth failures, connection status fetch errors |
| Investigation | Trigger failures, status poll failures, timeout |
| Discoveries | Fetch failures, discovery detail failures |
| Stripe Checkout | Session creation failures, return handling failures |
| Agent actions | POST failures, approval failures, state transition errors |
| Chat | POST failures, response parse errors |

---

## SECTION 36 — Testing Plan

### Unit / Component Tests (Vitest + React Testing Library)
- `DiscoveryCard` renders all Discovery types correctly
- `LockedDiscoveryCard` shows locked state correctly
- `StatCard` renders with correct color variants
- `AgentActionPanel` transitions through all states
- `ReminderModal` shows Free paywall vs Pro flow
- `RequiresPro` renders upgrade prompt for Free, content for Pro
- `useEntitlements()` returns correct values from context
- `EntitlementContext` provides correct entitlement shape

### Hook Tests
- `useInvestigation` — polling behavior, completion, failure
- `useDiscoveries` — pagination, filter params
- `useAuth` — authenticated/unauthenticated states, logout

### Integration Tests
- Investigation flow: trigger → polling → completion → redirect
- Checkout flow: CTA → session request → return URL handling → entitlement refresh
- Gmail connect: OAuth redirect construction, return handling
- Discovery dismiss: optimistic update, rollback on failure

### E2E Critical Paths (Playwright)
1. New user → sign in → connect Gmail → start investigation → see discoveries
2. Free user → hit paywall → upgrade → see Pro discoveries
3. Reminder creation (Pro)
4. Discovery dismiss
5. Settings: disconnect Gmail, logout

### Accessibility Tests
- `axe-core` on DiscoveryCard, ReminderModal, ConfirmModal, ChatPage
- Keyboard navigation through Sidebar, Discovery list, Settings

---

## SECTION 37 — Implementation Sequence

### Phase 0 — Foundation (P0, blocking everything)

| ID | Description | Priority | Complexity | Dependencies | Files Affected | New Files | Backend Dep | Tests |
|----|-------------|----------|------------|-------------|----------------|-----------|-------------|-------|
| F-01 | Add TanStack Query v5, configure `queryClient.ts` | P0 | S | None | `package.json`, `src/main.tsx` | `src/lib/queryClient.ts` | No | No |
| F-02 | Create `apiClient.ts` — centralized fetch with auth header + 401 handling | P0 | S | F-01 | — | `src/lib/apiClient.ts` | No | Unit |
| F-03 | Implement `AuthContext` — GET /auth/me on init, `isAuthenticated` state | P0 | M | F-01, F-02 | `src/App.tsx` | `src/contexts/AuthContext.tsx` | GET /auth/me, GET /auth/google | Yes |
| F-04 | Implement `<ProtectedRoute>` — redirect unauthenticated to `/` | P0 | S | F-03 | `src/App.tsx` | — | No | Unit |
| F-05 | Implement `EntitlementContext` — GET /user/entitlements, `useEntitlements()` hook | P0 | M | F-03 | — | `src/contexts/EntitlementContext.tsx`, `src/hooks/useEntitlements.ts` | GET /user/entitlements | Yes |
| F-06 | Update router: add auth-protected `/app` nested routes, public routes | P0 | M | F-04 | `src/App.tsx` | — | No | No |
| F-07 | Update `index.html` title and add basic meta tags | P0 | S | None | `index.html` | — | No | No |

**Acceptance criteria Phase 0:** App loads, checks auth, redirects unauthenticated users to landing, authenticated users to `/app/dashboard`. Entitlements available in context throughout app.

---

### Phase 0b — i18n Foundation (P0, parallel with Phase 0)

> **Cross-cutting requirement:** i18n must be set up before Phase 1 begins. Every component built from Phase 1 onward must use `useTranslation()` — no hardcoded strings. Setting up the infrastructure now prevents a costly retrofit later.

| ID | Description | Priority | Complexity | Dependencies | Files Affected | New Files | Backend Dep | Tests |
|----|-------------|----------|------------|-------------|----------------|-----------|-------------|-------|
| I-01 | Add `i18next`, `react-i18next`, `i18next-browser-languagedetector` to `package.json` | P0 | S | None | `package.json` | — | No | No |
| I-02 | Create `src/i18n/index.ts` — configure i18next: `en`/`es` locales, fallback `en`, namespace list, browser locale detection, `languageOnly` mode for regional variants | P0 | M | I-01 | `src/main.tsx` | `src/i18n/index.ts` | No | Unit |
| I-03 | Create all 12 namespace JSON stubs for `en` and `es` under `src/i18n/locales/` | P0 | M | I-02 | — | 24 JSON files | No | No |
| I-04 | Create `useLocale()` hook + `LocaleContext` — `changeLocale()`, localStorage persistence, `document.documentElement.lang` update | P0 | M | I-02 | `src/main.tsx` | `src/hooks/useLocale.ts`, `src/contexts/LocaleContext.tsx` | No | Unit |
| I-05 | Create `src/lib/formatting.ts` — `formatDate`, `formatRelativeDate`, `formatCurrency`, `formatNumber`, `formatMeetingTime` using `Intl` APIs | P0 | M | I-04 | — | `src/lib/formatting.ts` | No | Unit |
| I-06 | `LanguageSelector` component — `EN \| ES` toggle for public nav and Settings | P0 | S | I-04 | `src/components/Sidebar.tsx` | `src/components/LanguageSelector.tsx` | No | Unit |
| I-07 | Update `apiClient.ts` to attach `Accept-Language: <locale>` header on all requests | P0 | S | I-04, F-02 | `src/lib/apiClient.ts` | — | No | Unit |
| I-08 | Convert existing prototype components to use `useTranslation()` — `Sidebar`, `OffersPage`, `FeaturedOfferCard`, `OfferListItem`, `StatCard` | P0 | M | I-02, I-03 | All 5 existing components | — | No | No |

**Acceptance criteria Phase 0b:** `npm run dev` loads in English by default. Switching to Spanish via `LanguageSelector` immediately updates all translated strings and persists across reload. `<html lang>` reflects active locale. All API requests include `Accept-Language`.

---

### Phase 1 — Authentication + Onboarding (P0)

| ID | Description | Priority | Complexity | Dependencies | Files Affected | New Files | Backend Dep | Tests |
|----|-------------|----------|------------|-------------|----------------|-----------|-------------|-------|
| A-01 | `LandingPage` — "Your inbox knows things you don't" + "Investigate my inbox" CTA | P0 | M | F-06 | `src/App.tsx` | `src/pages/LandingPage.tsx` | GET /auth/google | E2E |
| A-02 | `AuthCallbackPage` — exchange code, set auth state, redirect to onboarding | P0 | M | F-03 | `src/App.tsx` | `src/pages/AuthCallbackPage.tsx` | GET /auth/callback | Unit |
| A-03 | `ConnectGmailPage` (onboarding step 1) — explain + CTA | P0 | S | F-03 | — | `src/pages/onboarding/ConnectGmailPage.tsx` | GET /gmail/connect | No |
| A-04 | `InvestigationProgressPage` — real status polling, honest async states | P0 | L | F-02 | — | `src/pages/onboarding/InvestigationProgressPage.tsx`, `src/hooks/useInvestigation.ts` | POST /investigations, GET /investigations/:id | Unit + E2E |
| A-05 | `InvestigationResultsPage` — show first real discoveries + locked count | P0 | M | A-04 | — | `src/pages/onboarding/InvestigationResultsPage.tsx` | GET /discoveries | Unit |
| A-06 | Update `Sidebar` — show real Gmail connection status, wire "Scan Inbox" to investigation | P0 | M | F-02, F-03 | `src/components/Sidebar.tsx` | — | GET /gmail/status | Unit |

---

### Phase 2 — Discovery Core (P0)

| ID | Description | Priority | Complexity | Dependencies | Files Affected | New Files | Backend Dep | Tests |
|----|-------------|----------|------------|-------------|----------------|-----------|-------------|-------|
| D-01 | Extend `Offer` type → `Discovery` union type | P0 | M | None | `src/types/index.ts` | — | No | No |
| D-02 | Extend `FeaturedOfferCard` → `DiscoveryCard` with Discovery type support + actions | P0 | M | D-01 | `src/components/FeaturedOfferCard.tsx` | — | No | Unit |
| D-03 | Extend `OfferListItem` → `DiscoveryListItem` with type icons, amount, locked state | P0 | M | D-01 | `src/components/OfferListItem.tsx` | — | No | Unit |
| D-04 | `LockedDiscoveryCard` — locked discovery with category + upgrade CTA | P0 | S | D-01 | — | `src/components/LockedDiscoveryCard.tsx` | No | Unit |
| D-05 | `DiscoveriesPage` — wire to real API, real filters, real search | P0 | L | D-02, D-03, D-04, F-02 | `src/pages/OffersPage.tsx` | `src/pages/discoveries/DiscoveriesPage.tsx`, `src/hooks/useDiscoveries.ts` | GET /discoveries | E2E |
| D-06 | `DiscoveryDetailPage` — full detail, why flagged, source evidence, actions | P0 | L | D-01, F-02 | — | `src/pages/discoveries/DiscoveryDetailPage.tsx` | GET /discoveries/:id, GET /discoveries/:id/source | E2E |
| D-07 | `EmailDrawer` — safe email excerpt display + link to Gmail | P0 | M | D-06 | — | `src/components/EmailDrawer.tsx` | GET /discoveries/:id/source | Unit |
| D-08 | Discovery dismiss action — optimistic update | P0 | S | D-05, D-06 | — | — | PATCH /discoveries/:id | Unit |
| D-09 | Discovery feedback (useful/not useful) — lightweight | P0 | S | D-05 | — | — | POST /discoveries/:id/feedback | Unit |

---

### Phase 3 — Dashboard (P0)

| ID | Description | Priority | Complexity | Dependencies | Files Affected | New Files | Backend Dep | Tests |
|----|-------------|----------|------------|-------------|----------------|-----------|-------------|-------|
| DB-01 | `DashboardPage` — agent status, key discoveries, stat cards | P0 | L | D-02, F-05, F-02 | — | `src/pages/DashboardPage.tsx` | GET /discoveries, GET /gmail/status | E2E |
| DB-02 | `AgentStatusBadge` — detective active/investigating/needs attention | P0 | S | — | `src/components/Sidebar.tsx` | `src/components/AgentStatusBadge.tsx` | GET /gmail/status | Unit |

---

### Phase 4 — Billing + Entitlements (P0)

| ID | Description | Priority | Complexity | Dependencies | Files Affected | New Files | Backend Dep | Tests |
|----|-------------|----------|------------|-------------|----------------|-----------|-------------|-------|
| B-01 | `RequiresPro` wrapper component + `UpgradePrompt` | P0 | M | F-05 | — | `src/components/RequiresPro.tsx` | No | Unit |
| B-02 | `UpgradePage` — contextual paywall + plan card + Stripe redirect | P0 | M | F-02 | — | `src/pages/UpgradePage.tsx` | POST /billing/checkout-session | E2E |
| B-03 | `UpgradeSuccessPage` — poll entitlements, redirect with context restored | P0 | M | F-05, B-02 | — | `src/pages/UpgradeSuccessPage.tsx` | GET /user/entitlements | E2E |
| B-04 | `BillingPage` in settings — plan, renewal, Customer Portal CTA | P0 | M | F-02 | — | `src/pages/settings/BillingPage.tsx` | GET /billing/status, POST /billing/portal-session | Unit |

---

### Phase 5 — Settings (P0 launch minimum)

| ID | Description | Priority | Complexity | Dependencies | Files Affected | New Files | Backend Dep | Tests |
|----|-------------|----------|------------|-------------|----------------|-----------|-------------|-------|
| S-01 | `SettingsPage` — account, Gmail, Calendar, Billing tabs | P0 | L | F-03, F-02 | `src/App.tsx` | `src/pages/settings/SettingsPage.tsx` | GET /gmail/status, GET /calendar/status | E2E |
| S-02 | Gmail disconnect flow with ConfirmModal | P0 | M | S-01 | — | `src/components/ConfirmModal.tsx` | DELETE /gmail/connection | Unit |
| S-03 | Account deletion flow — typed confirmation | P1 | M | S-01, S-02 | — | — | DELETE /account | Unit |
| S-04 | Logout | P0 | S | F-03 | — | — | POST /auth/logout | Unit |
| S-05 | Privacy Policy page — static or linked, accessible from settings and landing | P0 | S | None | — | `src/pages/PrivacyPolicyPage.tsx` | No | No |
| S-06 | Terms of Service page — static or linked, accessible from settings and landing | P0 | S | None | — | `src/pages/TermsPage.tsx` | No | No |

---

### Phase 6 — Agent Actions, Reminders + Chat (P0)

> **PRD §47 alignment:** Chat (#29), Reminders (#24), Calendar OAuth/availability/event/email draft (#25–28) are all listed as P0 launch requirements and appear in the PRD launch demo (§50) and Definition of Done (§49).

| ID | Description | Priority | Complexity | Dependencies | Files Affected | New Files | Backend Dep | Tests |
|----|-------------|----------|------------|-------------|----------------|-----------|-------------|-------|
| AG-01 | `AgentActionPanel` — reusable state machine component | P0 | L | None | — | `src/components/AgentActionPanel.tsx` | No | Unit |
| AG-02 | `ReminderModal` — options, Free paywall, create/edit/cancel | P0 | M | B-01, AG-01 | — | `src/components/ReminderModal.tsx` | POST/DELETE /reminders | Unit |
| AG-03 | Calendar connection prompt — contextual inline | P0 | M | F-02 | — | `src/components/CalendarConnectPrompt.tsx` | GET /calendar/connect | Unit |
| AG-04 | Meeting discovery → availability → selection → confirmation → event creation | P0 | L | AG-01, AG-03 | `src/pages/discoveries/DiscoveryDetailPage.tsx` | — | POST/approve agent actions | E2E |
| AG-05 | Email draft review → [Send] confirmation (Level 3) | P0 | M | AG-01 | — | — | POST /agent-actions/:id/send | Unit |
| CH-01 | `ChatPage` — message list, input, loading, limits, Discovery refs | P0 | L | F-02, F-05 | — | `src/pages/ChatPage.tsx` | POST /chat/messages | E2E |

---

### Phase 7 — Subscriptions (P1)

| ID | Description | Priority | Complexity | Dependencies | Files Affected | New Files | Backend Dep | Tests |
|----|-------------|----------|------------|-------------|----------------|-----------|-------------|-------|
| SU-01 | `SubscriptionsPage` — list detected subscriptions | P1 | M | F-02 | — | `src/pages/SubscriptionsPage.tsx` | GET /subscriptions | Unit |

---

### Phase 8 — Polish + Production Readiness (P1–P2)

| ID | Description | Priority | Complexity | Notes |
|----|-------------|----------|------------|-------|
| PR-01 | Add Sentry error monitoring | P1 | S | — |
| PR-02 | Add analytics (PostHog or Segment) with `lib/analytics.ts` | P1 | M | No PII |
| PR-03 | Toast system (ToastContext) | P1 | S | Used throughout |
| PR-04 | Loading skeleton components | P1 | M | Used for lists, cards |
| PR-05 | Responsive audit + P0 fixes (sidebar collapse, grid wrapping) | P1 | M | — |
| PR-06 | Accessibility audit + P0 fixes (labels, focus, ARIA) | P1 | M | — |
| PR-07 | Email content sanitization (DOMPurify) | P0 | S | Security |
| PR-08 | `index.html` — title, meta, OG tags, favicon | P1 | S | — |
| PR-09 | Environment variable audit (no hardcoded localhost in extension) | P1 | S | — |
| PR-10 | CSP headers in nginx.conf | P1 | S | Security |

---

## SECTION 38 — Parallelization Plan

After plan approval, the following workstreams can be executed in parallel. Shared files are identified to prevent merge conflicts.

### Workstream F: i18n Foundation (runs in parallel with Workstream A, must complete before any page work begins)
**Scope:** I-01 through I-08  
**Owned files:** `src/i18n/`, `src/hooks/useLocale.ts`, `src/contexts/LocaleContext.tsx`, `src/lib/formatting.ts`, `src/components/LanguageSelector.tsx`  
**Shared files (coordinate):** `src/main.tsx` (add i18n init + LocaleProvider), `src/lib/apiClient.ts` (add Accept-Language header — coordinate with Workstream A), `src/components/Sidebar.tsx` (add LanguageSelector — coordinate with Workstream A which also extends Sidebar)  
**Backend deps:** None (Accept-Language header is additive; `user.locale` persistence is a P1 backend dep)  
**Prerequisite:** None — can start immediately  
**Blocks:** All other workstreams should not build pages/components until I-02 and I-03 are complete (i18n config + locale file stubs must exist)

### Workstream A: Foundation + Auth
**Scope:** F-01 through F-07, A-01 through A-06  
**Owned files:** `src/App.tsx`, `src/lib/`, `src/contexts/AuthContext.tsx`, `src/pages/LandingPage.tsx`, `src/pages/AuthCallbackPage.tsx`, `src/pages/onboarding/`  
**Shared files (coordinate):** `src/App.tsx` (route config — merge carefully), `src/types/index.ts`  
**Backend deps:** GET /auth/me, GET /auth/google, GET /auth/callback, GET /gmail/connect, GET /gmail/status, POST /investigations, GET /investigations/:id  

### Workstream B: Discovery Core + Dashboard
**Scope:** D-01 through D-09 (all P0), DB-01, DB-02  
**Owned files:** `src/types/index.ts`, `src/components/FeaturedOfferCard.tsx`, `src/components/OfferListItem.tsx`, `src/components/LockedDiscoveryCard.tsx`, `src/pages/discoveries/`, `src/pages/DashboardPage.tsx`, `src/hooks/useDiscoveries.ts`  
**Shared files (coordinate):** `src/types/index.ts` (Discovery type — Workstream A also touches this), `src/components/Sidebar.tsx` (Workstream A updates Sidebar too)  
**Backend deps:** GET /discoveries, GET /discoveries/:id, GET /discoveries/:id/source, PATCH /discoveries/:id  
**Prerequisite:** F-01, F-02 must be complete (TanStack Query and apiClient) before implementing hooks

### Workstream C: Billing + Entitlements
**Scope:** F-05, B-01 through B-04  
**Owned files:** `src/contexts/EntitlementContext.tsx`, `src/hooks/useEntitlements.ts`, `src/components/RequiresPro.tsx`, `src/pages/UpgradePage.tsx`, `src/pages/UpgradeSuccessPage.tsx`, `src/pages/settings/BillingPage.tsx`  
**Shared files (coordinate):** `src/App.tsx` (new routes), `src/contexts/` (imported in `main.tsx`)  
**Backend deps:** GET /user/entitlements, POST /billing/checkout-session, POST /billing/portal-session, GET /billing/status  
**Prerequisite:** F-02 (apiClient), F-03 (AuthContext) must be complete

### Workstream D: Settings + Account Management
**Scope:** S-01 through S-04  
**Owned files:** `src/pages/settings/SettingsPage.tsx`, `src/components/ConfirmModal.tsx`  
**Shared files (coordinate):** `src/App.tsx` (route updates)  
**Backend deps:** DELETE /gmail/connection, GET /calendar/status, DELETE /calendar/connection, DELETE /account, POST /auth/logout  
**Prerequisite:** F-03 (AuthContext)

### Workstream E: Agent Actions, Reminders + Chat (starts after Workstream B completes D-06)
**Scope:** AG-01 through AG-05, CH-01 (all P0), SU-01 (P1)  
**Owned files:** `src/components/AgentActionPanel.tsx`, `src/components/ReminderModal.tsx`, `src/components/CalendarConnectPrompt.tsx`, `src/pages/ChatPage.tsx`, `src/pages/SubscriptionsPage.tsx`  
**Shared files (coordinate):** `src/pages/discoveries/DiscoveryDetailPage.tsx` (Workstream B owns this — coordinate on agent action integration)  
**Backend deps:** POST/GET /agent-actions, POST /reminders, GET /calendar/connect, POST /chat/messages  
**Prerequisite:** B-01 (RequiresPro), D-06 (DiscoveryDetailPage frame)

---

## SECTION 39 — Backend Dependency Contract

| Feature | Backend Capability | Method | Request | Response (shape) | Auth | Entitlement | Blocking? |
|---------|-------------------|--------|---------|-----------------|------|-------------|----------|
| Google Sign-In | Google OAuth redirect | GET | — | Redirect to Google | None | None | Yes |
| Auth callback | Exchange OAuth code | GET | `?code=&state=` | `Set-Cookie: session` + `{ user }` | None | None | Yes |
| Get current user | Return session user | GET /auth/me | — | `{ id, name, email, googleId }` | Session | None | Yes |
| Logout | Clear session | POST /auth/logout | — | `{ ok }` | Session | None | No |
| Get entitlements | Plan + features | GET /user/entitlements | — | `{ plan, entitlements: { ... } }` | Session | None | Yes |
| Gmail OAuth start | Start Gmail OAuth | GET /gmail/connect | — | Redirect to Google | Session | None | Yes |
| Gmail status | Connection state | GET /gmail/status | — | `{ connected, email, lastSync }` | Session | None | No |
| Disconnect Gmail | Remove Gmail token | DELETE /gmail/connection | — | `{ ok }` | Session | None | No |
| Start investigation | Trigger inbox scan | POST /investigations | `{ preferences? }` | `{ id, status: 'starting' }` | Session | Free (1x) | No |
| Investigation status | Poll for progress | GET /investigations/:id | — | `{ status, emailsReviewed, categoriesSeen, completedAt? }` | Session | None | Yes (poll) |
| List discoveries | Paginated discoveries | GET /discoveries | `?type=&status=&page=&limit=` | `{ items: Discovery[], locked: number, total }` | Session | Free (count) | No |
| Get discovery | Full discovery | GET /discoveries/:id | — | `Discovery` (full detail) | Session | Pro for locked | No |
| Source evidence | Email evidence | GET /discoveries/:id/source | — | `{ emails: [{ id, subject, sender, date, excerpt, gmailUrl }] }` | Session | None | No |
| Dismiss discovery | Update status | PATCH /discoveries/:id | `{ status: 'dismissed' }` | `Discovery` | Session | None | No |
| Discovery feedback | User signal | POST /discoveries/:id/feedback | `{ signal: 'useful'\|'not_useful'\|'never_show' }` | `{ ok }` | Session | None | No |
| List subscriptions | Subscription objects | GET /subscriptions | — | `Subscription[]` | Session | None | No |
| Create reminder | Schedule reminder | POST /reminders | `{ discoveryId, remindAt: ISO8601 }` | `Reminder` | Session | Pro | No |
| List reminders | User's reminders | GET /reminders | `?discoveryId=` | `Reminder[]` | Session | Pro | No |
| Delete reminder | Cancel reminder | DELETE /reminders/:id | — | `{ ok }` | Session | Pro | No |
| Calendar status | Connection state | GET /calendar/status | — | `{ connected }` | Session | None | No |
| Calendar connect | Start Calendar OAuth | GET /calendar/connect | — | Redirect | Session | Pro | Yes |
| Disconnect calendar | Remove token | DELETE /calendar/connection | — | `{ ok }` | Session | None | No |
| Find availability | Agent: check calendar | POST /agent-actions/availability | `{ discoveryId }` | `AgentAction { id, state, proposal: { slots } }` | Session | Pro | No |
| Approve action | Execute action | POST /agent-actions/:id/approve | `{ selection? }` | `AgentAction { id, state, result? }` | Session | Pro | No |
| Send email | Send drafted email | POST /agent-actions/:id/send | — | `AgentAction { id, state: 'done' }` | Session | Pro | No |
| Chat message | Answer question | POST /chat/messages | `{ message }` | `{ answer, sources: [{ discoveryId?, emailId? }] }` | Session | Free (limit) | No |
| Chat history | Previous messages | GET /chat/messages | — | `ChatMessage[]` | Session | None | No |
| Stripe checkout | Create session | POST /billing/checkout-session | `{ returnPath }` | `{ url }` | Session | None | No |
| Stripe portal | Customer portal | POST /billing/portal-session | `{ returnUrl }` | `{ url }` | Session | Pro | No |
| Billing status | Plan + renewal | GET /billing/status | — | `{ plan, status, renewalDate?, cancelAt? }` | Session | None | No |
| Delete account | Remove all data | DELETE /account | `{ confirmation: 'delete' }` | `{ ok }` | Session | None | No |

---

## SECTION 40 — Production Launch Checklist

### MUST HAVE (First paying customer)

- [ ] `LandingPage` with product message and Google Sign-In CTA
- [ ] Google OAuth (Sign-In) flow working end-to-end
- [ ] `AuthContext` protecting all `/app/*` routes
- [ ] Gmail OAuth connection flow in onboarding
- [ ] Investigation trigger + real status polling screen
- [ ] Real discoveries rendered from backend API
- [ ] `DiscoveryCard` supporting all V1 Discovery types
- [ ] `LockedDiscoveryCard` for Free discovery limit
- [ ] `DiscoveryDetailPage` with source evidence
- [ ] `EmailDrawer` with safe email content display (sanitized, no raw HTML)
- [ ] `DashboardPage` showing key discoveries and agent status
- [ ] `EntitlementContext` centralizing all Free/Pro checks
- [ ] `RequiresPro` component for paywall gates
- [ ] Stripe Checkout flow (upgrade CTA → backend → Stripe → return → entitlement refresh)
- [ ] `UpgradeSuccessPage` with context restoration
- [ ] `SettingsPage` (account, Gmail status, billing)
- [ ] Gmail disconnect with confirmation
- [ ] Logout
- [ ] Toast system for action feedback
- [ ] Loading states on all data-fetching pages (skeleton or spinner)
- [ ] Empty states on Discovery list and Dashboard
- [ ] Error states with retry on all critical API calls
- [ ] Email content sanitization (DOMPurify before any email HTML render)
- [ ] No OAuth tokens in localStorage
- [ ] Auth expiration → redirect to landing (401 handling in apiClient)
- [ ] `index.html` title and meta description updated
- [ ] Favicon present
- [ ] P0 responsive fixes (sidebar collapse, content width on mobile)
- [ ] P0 accessibility fixes (visible focus, input labels, active filter ARIA)
- [ ] i18n foundation: `react-i18next` installed and configured
- [ ] English locale files populated (all 12 namespaces)
- [ ] Spanish locale files populated (all 12 namespaces)
- [ ] `useLocale()` hook with localStorage persistence and `<html lang>` update
- [ ] `LanguageSelector` component in public nav and Settings
- [ ] All new V1 components use `useTranslation()` — no hardcoded strings
- [ ] `src/lib/formatting.ts` — date, currency, number via `Intl` APIs
- [ ] `apiClient.ts` sends `Accept-Language` header
- [ ] Backend enum values (discovery types, action names) mapped to translation keys — never rendered raw
- [ ] `ReminderModal` with Free paywall + Pro creation flow
- [ ] `AgentActionPanel` (thinking → proposing → approval → executing → done)
- [ ] Calendar connection prompt (contextual on meeting discovery)
- [ ] Meeting availability → selection → event creation flow
- [ ] Email draft review → Level 3 send confirmation
- [ ] `ChatPage` with Detective Chat, limits, Discovery refs
- [ ] `BillingPage` with Stripe Customer Portal
- [ ] Discovery dismiss (optimistic update)
- [ ] Discovery feedback (useful / not useful / never show)
- [ ] Privacy Policy page
- [ ] Terms of Service page

### SHOULD HAVE (Important but not blocking day one)

- [ ] `SubscriptionsPage` with subscription list
- [ ] Account deletion flow
- [ ] Calendar disconnect
- [ ] Sentry error monitoring
- [ ] Analytics (funnel events, no PII)
- [ ] P1 responsive improvements (sidebar mobile collapse)
- [ ] P1 accessibility improvements
- [ ] CSP headers in nginx
- [ ] Component unit tests for DiscoveryCard, RequiresPro, AgentActionPanel
- [ ] E2E tests for sign-in → investigation → discovery and upgrade flows
- [ ] OG meta tags for sharing
- [ ] i18n: `user.locale` backend persistence (Pro users retain locale across devices)
- [ ] i18n: Stripe Checkout `locale` parameter passed from backend
- [ ] i18n: Responsive audit for Spanish string lengths (buttons, nav, cards)
- [ ] i18n: E2E Flow A–G in both languages (see Section 45)
- [ ] i18n: translated `<title>` and meta description per locale

### POST-LAUNCH

- [ ] Chrome extension connected to real backend API
- [ ] Daily Detective Briefing (Pro dashboard section)
- [ ] Discovery feedback learning/personalization
- [ ] Investigation preferences fine-tuning
- [ ] PWA manifest
- [ ] Full accessibility audit (WCAG AA)
- [ ] Full mobile experience polish
- [ ] Help / documentation page
- [ ] Notification email preferences
- [ ] `CompaniesPage` replacement or removal
- [ ] `SavedPage` → Saved filter on Discoveries
- [ ] Advanced chat: history, context, follow-up actions
- [ ] Data export
- [ ] Full E2E test suite coverage
- [ ] i18n: locale-prefixed public URL (`/es`) for SEO / hreflang
- [ ] i18n: regional Spanish variants (es-MX, es-CL separate catalogs)
- [ ] i18n: translation management platform integration
- [ ] i18n: additional language support

---

## SECTION 41 — i18n Current State Assessment

### Existing Localization Capabilities
None. The repository has no i18n library, no locale detection, no translation files, no date/number/currency utilities. All user-facing strings are hardcoded in JSX.

**`package.json` confirms:** only `lucide-react`, `react`, `react-dom`, `react-router-dom` — no i18n dependency.

### Hardcoded String Inventory (Existing Files)

The existing prototype has a small surface area. The larger i18n investment is ensuring every new V1 component is built translation-ready from day one.

| File | Hardcoded Strings |
|------|-------------------|
| `src/components/Sidebar.tsx` | "Inbox Detective", "Connected", "Offers", "Companies", "Saved", "Settings", "Help", "Scan Inbox" |
| `src/pages/OffersPage.tsx` | "Your Offers", "Offers found in your inbox...", "All", "Ending Soon", "New", "Saved", "Don't miss these", "All Offers", "Offers found", "Ending soon", "New this week" |
| `src/pages/CompaniesPage.tsx` | "Companies", "Manage companies you're tracking.", "Companies page coming soon..." |
| `src/pages/SavedPage.tsx` | "Saved Offers", "Your bookmarked offers.", "No saved offers yet..." |
| `src/components/FeaturedOfferCard.tsx` | "Copy Code & Shop" |
| `chrome-extension/popup/App.tsx` | "Inbox Detective", "Offers hiding in your inbox", "Gmail connected", "new offers", "ending soon", "Don't miss", "Other Offers", "View all offers", "Last checked 4 min ago" |

---

## SECTION 42 — i18n Architecture & Library Recommendation

### Library: react-i18next

**Why react-i18next:**
- Industry standard for React (10M+ weekly downloads)
- Full React 19 support via `useTranslation()` hook and `<Trans>` component
- Namespace support matches the existing feature module structure exactly
- Interpolation: `"Your Detective found {{count}} discoveries"`
- Pluralization: `"{{count}} discovery"` / `"{{count}} discoveries"`
- `i18next-browser-languagedetector` for `navigator.language` + `localStorage` detection
- Strong TypeScript support with typed translation keys
- Vite-compatible with no adapter required
- No backend translation service needed — JSON files in repo are sufficient for V1 with 2 languages

**Dependencies to add:**
```
i18next                           # core engine
react-i18next                     # React hooks + components
i18next-browser-languagedetector  # navigator.language + localStorage detection
```

### Locale Strategy

**Supported:** `en`, `es` | **Default/fallback:** `en`

**Browser locale mapping** (via i18next `load: 'languageOnly'`):
```
en, en-US, en-GB → en
es, es-US, es-MX, es-CL, es-ES, es-AR → es
```

**Detection priority** (via `i18next-browser-languagedetector` order config):
1. `localStorage` key `inbox-detective-locale` (persisted user selection)
2. `navigator.language` (browser preference)
3. `en` fallback

`user.locale` from the backend is a **P1 backend dependency** — not currently in the API contract. Once added, read it after auth and call `i18n.changeLanguage(user.locale)` to sync.

### Translation File Structure

```
src/
  i18n/
    index.ts
    locales/
      en/
        common.json       # nav, buttons, actions, status labels
        public.json       # landing page, hero, pricing, FAQ, footer
        onboarding.json   # welcome, Gmail connect, interests
        investigation.json # progress states, results summary
        discoveries.json  # types, titles, actions, evidence labels
        subscriptions.json # overview, detail, price history
        detective.json    # chat, briefing, agent states
        calendar.json     # connection, availability, meeting flow
        reminders.json    # selector, confirmation, error states
        billing.json      # plans, upgrade copy, checkout states
        settings.json     # account, connections, preferences, privacy
        errors.json       # error codes → user-facing messages
      es/
        (mirrors en/ — all 12 files)
```

### Translation Key Convention

Semantic dot-notation keys. English text is NEVER the key.

```json
// common.json
{ "nav.dashboard": "Dashboard", "nav.discoveries": "Discoveries",
  "actions.cancel": "Cancel", "actions.remindMe": "Remind me",
  "status.connected": "Connected" }

// discoveries.json
{ "types.subscription": "Subscription", "types.priceChange": "Price change",
  "types.expiration": "Expiration", "types.money": "Money",
  "types.meeting": "Meeting request",
  "locked.title": "{{count}} more discoveries", "locked.cta": "Unlock with Pro" }

// errors.json
{ "gmailConnectionExpired": "Your Gmail connection has expired.",
  "investigationFailed": "Investigation stopped. Please try again." }
```

### `useLocale()` Hook

Thin wrapper over i18next that:
- Exposes `locale`, `changeLocale(locale: 'en' | 'es')`
- Persists to `localStorage('inbox-detective-locale')`
- Updates `document.documentElement.lang` on change
- Is consumed by `apiClient.ts` to set `Accept-Language` header
- Can later sync with `user.locale` from backend after auth

### Formatting Utilities (`src/lib/formatting.ts`)

All date/number/currency formatting goes through this module. Never format inline in components.

```typescript
formatDate(date, locale)         // "September 30, 2026" / "30 de septiembre de 2026"
formatRelativeDate(date, locale) // "5 days remaining" / "Quedan 5 días"
formatCurrency(amount, currency, locale) // uses Intl.NumberFormat — currency ≠ locale
formatNumber(value, locale)      // Intl.NumberFormat
formatMeetingTime(date, locale, tz) // "2:00 PM" (en) / "14:00" (es)
```

All functions use browser-native `Intl` APIs. No additional dependency.

**Currency principle:** A Spanish-speaking user may use USD. Currency symbol/format follows the locale but the currency code comes from structured data (`{ amount: 59.99, currency: "USD" }`). Never change currency based solely on locale.

### URL Strategy

Production V1: **no locale-prefixed routes**. Locale is persisted state. This avoids router duplication and route complexity.

Future (post-launch): `/es` prefix on public landing page for SEO and hreflang support — additive, does not break existing routes.

### Stripe Locale

Pass `locale` in the checkout-session request body. Backend forwards to `Checkout.Session.create({ locale })`. Stripe supports `es` natively. Minor backend change — P1 priority.

### Email Draft Language Rule

Email drafts should follow the language of the email conversation being replied to, not the UI locale. Backend agent rule:
1. Detect source email/thread language
2. Use detected language for draft
3. Fall back to `Accept-Language` if undetectable
4. Final fallback: English

This means `UI language ≠ email reply language` by design.

### Detective Chat Language Rule

Detective Chat responds in the user's UI locale by default. If the user writes in a different language, the agent should follow the explicit language the user used. Backend rule:
1. Explicit language used in the user's message
2. `Accept-Language` from request headers
3. English fallback

---

## SECTION 43 — Hardcoded String Audit by Feature Area

All user-facing copy that needs migration to translation keys — existing files plus all planned new V1 components.

### Backend Enum → Translation Key Mapping (Critical)

Backend enum values must NEVER be rendered as UI copy. Every enum that reaches a UI label must go through a translation key lookup.

| Backend value | Translation key | English | Spanish |
|--------------|----------------|---------|---------|
| `SUBSCRIPTION` | `discoveries.types.subscription` | Subscription | Suscripción |
| `PRICE_CHANGE` | `discoveries.types.priceChange` | Price change | Cambio de precio |
| `EXPIRATION` | `discoveries.types.expiration` | Expiration | Vencimiento |
| `MONEY` | `discoveries.types.money` | Money | Dinero |
| `REFUND` | `discoveries.types.refund` | Refund | Reembolso |
| `CREDIT` | `discoveries.types.credit` | Credit | Crédito |
| `MEETING` | `discoveries.types.meeting` | Meeting request | Solicitud de reunión |
| `ACTION_REQUIRED` | `discoveries.types.actionRequired` | Action required | Acción requerida |
| `monthly` | `billing.frequency.monthly` | /month | /mes |
| `annual` | `billing.frequency.annual` | /year | /año |

### Feature Areas

| Area | Namespace | Key Examples |
|------|-----------|-------------|
| Navigation | `common` | `nav.dashboard`, `nav.discoveries`, `nav.chat`, `nav.settings` |
| Landing hero | `public` | `hero.title`, `hero.subtitle`, `hero.investigateCta` |
| Onboarding | `onboarding` | `welcome.title`, `connectGmail.explanation`, `interests.*` |
| Investigation progress | `investigation` | `states.starting`, `states.running`, `stats.emailsReviewed` |
| Discovery types/actions | `discoveries` | `types.*`, `actions.*`, `locked.*`, `empty.*`, `filters.*` |
| Subscription detail | `subscriptions` | `overview.*`, `priceHistory.*`, `actions.*` |
| Agent states | `detective` | `agentStates.thinking`, `agentStates.proposing`, `agentStates.done` |
| Chat | `detective` | `chat.placeholder`, `chat.suggestions.*`, `chat.limits.*` |
| Calendar | `calendar` | `connection.*`, `availability.*`, `meeting.*`, `success.*` |
| Reminders | `reminders` | `options.*`, `confirmation.*`, `status.*` |
| Billing / upgrade | `billing` | `plans.*`, `upgrade.*`, `checkout.*`, `paywalls.*` |
| Settings | `settings` | `sections.*`, `account.*`, `connections.*`, `deleteAccount.*` |
| Errors | `errors` | error code keys matching backend `{ code }` values |
| Form validation | `errors` | `validation.required`, `validation.invalidEmail` |

---

## SECTION 44 — i18n Backend Dependencies

### Frontend-Only (no backend change needed)
- i18n library install and configuration
- All static UI strings (nav, buttons, labels, headings)
- Locale detection, persistence, `<html lang>` updates
- Language selector UI
- Date/number/currency formatting via `Intl`
- Error code → translated message mapping (requires backend to return structured codes)
- `Accept-Language` header (additive, no backend change required to send it)

### Requires Backend Changes

| Dependency | Description | Priority | Impact if deferred |
|-----------|-------------|----------|--------------------|
| Structured error codes | Return `{ code: "GMAIL_CONNECTION_EXPIRED" }` instead of English error strings | **P0** | Frontend cannot correctly translate error messages |
| `Accept-Language` header handling | Backend reads header to determine AI output language | **P0** | AI-generated content always appears in English |
| AI Discovery content in user locale | Investigation generates `title`, `summary` in `user.locale` / `Accept-Language` | **P0** | Discovery titles/summaries in English for Spanish users |
| Detective Chat in user locale | Chat endpoint produces responses in `Accept-Language` | **P0** | Chat always responds in English |
| `user.locale` on user profile | Store and return preferred locale for cross-device persistence | P1 | Single-device localStorage covers this for V1 |
| Daily Briefing in user locale | Briefing text generated in `Accept-Language` | P1 | Briefing appears in English for Spanish users |
| Email draft language inference | Agent detects source email language, uses that for draft | P1 | Drafts may be in wrong language |
| Stripe `locale` parameter | Backend passes `locale` to `Checkout.Session.create()` | P1 | Stripe Checkout always appears in English |

### AI-Generated Content Classification

| Discovery field | Source | Frontend can translate? |
|----------------|--------|------------------------|
| `type` (enum) | Backend | ✓ Via enum → key mapping |
| `title` | AI-generated | ✗ Backend must generate in locale |
| `summary` | AI-generated | ✗ Backend must generate in locale |
| `company` | Extracted proper noun | N/A — not translated |
| `amount` | Structured `number` | ✓ Via `formatCurrency()` |
| `date` | Structured ISO string | ✓ Via `formatDate()` |
| `frequency` | Enum | ✓ Via `billing.frequency.*` key |
| `availableActions` | Enum array | ✓ Via `discoveries.actions.*` keys |
| Chat `answer` | AI-generated | ✗ Backend must respond in locale |
| Source email body | Raw email content | ✗ Never auto-translated — displayed as-is in original language |

**Rule:** The source email should always be displayed in its original language when shown as evidence. Do not translate raw email content.

---

## SECTION 45 — i18n Test Plan

### Unit Tests (Vitest)
- `formatting.ts` — `formatDate`, `formatCurrency`, `formatNumber`, `formatRelativeDate` return correct output for `en` and `es`
- `useLocale()` — `changeLocale()` updates i18next, localStorage, `document.documentElement.lang`
- Discovery type enum mapping — `PRICE_CHANGE` → `discoveries.types.priceChange` resolves in both locales
- Error code mapping — `GMAIL_CONNECTION_EXPIRED` → `errors.gmailConnectionExpired` resolves in both locales
- `DiscoveryCard` renders without missing translation keys in `en` and `es`
- `LandingPage` renders correctly in both locales
- `BillingPage` / `UpgradePage` renders plan copy in both locales
- `AgentActionPanel` all states render correctly in `es`

### Integration Tests (React Testing Library)
- Language selector changes locale: UI updates immediately, no re-login required
- Locale persists across page reload (localStorage)
- `<html lang>` attribute matches active locale
- `DiscoveryCard` all variants render without missing keys in `es`
- `ReminderModal` renders correctly in `es`, including Pro paywall copy
- Form validation messages appear in active locale
- `Accept-Language` header is present on API requests after locale change

### E2E Tests (Playwright)

| Flow | Scenario |
|------|---------|
| **Flow A** | Public Home → switch to ES → "Investigar mi bandeja" CTA → Auth → Gmail → Investigation → Results (all in ES) |
| **Flow B** | ES Free user → Locked Discovery → Upgrade → Stripe → Return → Pro activated (ES success copy) |
| **Flow C** | ES user → Discovery with date → Reminder → Confirmation shows ES-formatted date |
| **Flow D** | ES user → Meeting Discovery → Calendar → Availability → Create meeting (draft follows email language, not UI locale) |
| **Flow E** | ES user → Ask Detective → ES response → Open linked Discovery → Return to Chat |
| **Flow F** | EN user → Settings → Change language to ES → Entire UI updates without logout or page reload |
| **Flow G** | ES user → Sign out → Public landing remains ES (localStorage persisted) |

### Responsive Tests (ES-specific)
- Navigation labels do not overflow at tablet/mobile widths
- Discovery card action labels do not overflow (Spanish is longer)
- Pricing card copy does not break layout
- `AgentActionPanel` confirmation copy fits correctly in Spanish
- Settings row labels do not truncate unreadably in Spanish
- Dialog/modal copy in Spanish does not overflow containers

### Accessibility Tests
- `LanguageSelector` has accessible label in both languages (`aria-label`)
- `<html lang>` is correct for each locale
- ARIA labels on icon-only buttons are translated
- Screen reader focus management works after language change
- Translated error messages are announced by `aria-live` regions

---

*End of plan. Awaiting approval before implementation begins.*
