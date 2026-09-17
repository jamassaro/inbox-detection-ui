---
name: local-dev
---

# Local Dev — inbox-detection-ui

How to stand up and verify this repo locally. Recorded during onboarding (2026-09-17); re-verify if the stack changes.

## Bring-up

1. `npm ci` — Node 20 / npm is canonical (`package-lock.json`).
   - If Vite fails with `EACCES ... node_modules/.vite/deps_temp_*`, the bootstrap `node_modules` is root-owned. One-time fix: `sudo rm -rf node_modules && npm ci`.
2. `npm run dev` — Vite on http://localhost:5173 (port pinned in `vite.config.ts`).
3. No services, migrations, seeds, or env vars — all data is mock (`src/data/mockOffers.ts`).

## Quick verification

- `curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/` -> `200`
- `npm run lint` -> 0 warnings, 0 errors
- `npm run build` -> `tsc -b && vite build` succeeds and emits `dist/`

## Primary flows to exercise

1. `/` redirects to `/offers`; "Your Offers" dashboard renders.
2. Search box (placeholder `Search companies or offers`) filters by company.
3. Filter buttons: All / Ending Soon / New / Saved.
4. Sidebar navigation: Offers, Companies, Saved.

Playwright + headless Chromium works in this sandbox. Install it outside the repo (e.g. `/tmp/pw`) so `package.json` is untouched. Onboarding run: all flows above passed with 0 console errors / 0 page errors; 5 screenshots in `/tmp/evidence/`.

## Facts

- `docker-compose.yml` exists (`dev` on 5173, `prod` on 8080 with nginx `/health`) but there is no docker binary in the sandbox.
- No test framework is configured (no `test` script). Lint + build are the quality gates.
- The sandbox bootstrap leaves a root-owned untracked `bun.lock`; npm is the manager of record.
