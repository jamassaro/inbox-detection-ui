# Codebase Map — inbox-detection-ui

Frontend-only React SPA. 33 tracked files. Depth capped at 2 levels.

| Path | Purpose |
|---|---|
| `src/` | Application source (React 19 + TypeScript) |
| `src/components/` | Reusable UI: `Sidebar`, `StatCard`, `FeaturedOfferCard`, `OfferListItem` |
| `src/pages/` | Route pages: `OffersPage` (dashboard, search, filters), `CompaniesPage`, `SavedPage` |
| `src/data/` | `mockOffers.ts` — all app data (mock inbox offers) |
| `src/types/` | `index.ts` — `Offer` type |
| `src/assets/` | Static images (`hero.png`, template logos) |
| `src/App.tsx` | Router: `/` -> `/offers`; routes for `/companies`, `/saved`, `/settings`, `/help` |
| `src/main.tsx` | Entry point mounting `App` |
| `public/` | Static assets served at root (`favicon.svg`, `icons.svg`) |
| `index.html` | Vite HTML shell |
| `vite.config.ts` | Dev server config (port 5173, `host: true`, polling watch) |
| `tailwind.config.js`, `postcss.config.js` | Styling pipeline |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | TypeScript project references |
| `.oxlintrc.json` | oxlint rules (react/typescript/oxc plugins) |
| `Dockerfile` | Multi-stage: node:20-alpine build -> nginx:alpine prod; `development` target for dev |
| `docker-compose.yml` | `dev` (5173) and `prod` (8080) services |
| `nginx.conf` | Prod server: gzip, SPA fallback, `/health` endpoint |
| `README.md` | Project overview and quick start |
