# inbox-detection-ui — Agent Guide

**Repo:** jamassaro/inbox-detection-ui (default branch: `main`)
**What it is:** "Inbox Detective" — a React SPA for viewing and managing offers detected in an inbox (offers dashboard, featured deals, filters, search, saved items). Frontend-only: all data is mock data in `src/data/mockOffers.ts`. No backend, no database, no required env vars.

## Stack

| Layer | Choice |
|---|---|
| UI framework | React 19 |
| Language | TypeScript 6 (app config: `tsconfig.app.json`) |
| Build/dev tool | Vite 8 (`@vitejs/plugin-react`) |
| Styling | Tailwind CSS 3 + PostCSS/Autoprefixer |
| Routing | React Router 7 (client-side) |
| Icons | lucide-react |
| Linting | oxlint (`.oxlintrc.json`) |
| Package manager | npm (`package-lock.json`; Node 20 per Dockerfile) |
| Containers | Docker multi-stage (dev: Vite on 5173; prod: nginx on 8080) |

## Commands

| Task | Command | Result (verified 2026-09-17) |
|---|---|---|
| Install | `npm ci` | 108 packages, ~3 s |
| Dev server | `npm run dev` | VITE v8.2.2 ready; **http://localhost:5173** |
| Lint | `npm run lint` | oxlint: 0 warnings, 0 errors |
| Typecheck + prod build | `npm run build` | `tsc -b && vite build`; emits `dist/` |
| Preview build | `npm run preview` | serves `dist/` |
| Docker dev | `docker-compose up dev` | maps 5173 (docker not available in sandbox) |
| Docker prod | `docker-compose up prod` | nginx on 8080; `GET /health` returns 200 |

No env vars required (no `.env.example`; none documented). No test framework is configured — there is no `test` script; `lint` + `build` are the quality gates.

## Codebase Map

Full folder table: `.obvious/codebase-map.md`. Summary:

| Path | Purpose |
|---|---|
| `src/` | React app source (components, pages, data, types, assets) |
| `src/pages/` | Route pages: OffersPage, CompaniesPage, SavedPage |
| `src/components/` | Sidebar, StatCard, FeaturedOfferCard, OfferListItem |
| `src/data/mockOffers.ts` | All app data (mock inbox offers) |
| `public/` | Static assets served at root |
| `vite.config.ts` | Dev server: port 5173 pinned, `host: true`, polling watch |
| `Dockerfile` / `docker-compose.yml` / `nginx.conf` | Containers: dev (5173), prod (8080, `/health`) |

## Local Verification (Validation Summary)

Verified end-to-end on 2026-09-17 in the repo sandbox:

- `npm ci` — clean install (bootstrap `node_modules` had been root-owned; see Gotchas).
- `npm run dev` — ready in 206 ms, listening on 5173 (parsed from startup output), `GET /` returns HTTP 200.
- Primary flows via Playwright + headless Chromium (1280x800), **zero console errors and zero page errors**:
  - `/` redirects to `/offers`; "Your Offers" dashboard renders ("Don't miss these" + "All Offers").
  - Search `Uber` filters the list to Uber Eats.
  - Filter `Ending Soon` shows the "Ends Tomorrow" offer.
  - Sidebar navigation to `/companies` and `/saved` works.
  - 5 screenshots captured (sandbox `/tmp/evidence/`).
- `npm run lint` — 0 warnings, 0 errors. `npm run build` — success (241.95 kB JS / 77.02 kB gzip).

## Sandbox Snapshot

| Field | Value |
|---|---|
| Snapshot ID | `ig2nlwl1y7t2qmrgk80bv` |
| Built at | 2026-09-17T15:22:16.285Z |
| State | Dev server running on port 5173 (tmux session `dev`), deps installed, `dist/` built |

## Gotchas

- **Root-owned `node_modules`:** the sandbox bootstrap installs dependencies as root via bun, which makes Vite fail with `EACCES ... node_modules/.vite/deps_temp_*`. One-time fix: `sudo rm -rf node_modules && npm ci`.
- A stray untracked `bun.lock` may exist from bootstrap; npm is the repo's manager of record — do not stage it.
- Port 5173 is explicitly pinned in `vite.config.ts` (with `host: true` and polling watch for Docker).
