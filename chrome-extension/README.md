# Inbox Detective — Gmail extension (V1)

A launcher + floating panel inside Gmail showing the user's recent Discoveries.

## Architecture
- `content/gmail.tsx` → `content/mount.tsx`: mounts one closed Shadow DOM host on `mail.google.com`, re-attaches it if Gmail removes it (observer on `<html>` children only). Tailwind CSS (`tailwind.extension.config.js`) is inlined into the shadow root.
- `components/`: `DetectiveButton`, `DetectivePanel`, `ExtensionHeader`, `RecentDiscovery`, `ExtensionApp`.
- `background/`: service worker. The **only** place that calls the API (`credentials: 'include'`, one 401 → `/auth/refresh` → retry). It returns display data only; cookies/tokens never reach Gmail's page.
- `services/`: typed message protocol (`messages.ts`) + content-side client (`api.ts`).
- `i18n.ts`: own i18next instance (browser locale only; never touches Gmail's localStorage).
- `manifest.ts`: manifest generated at build time; host permission follows the web origin.

## Build & install
```bash
npm run build:extension          # → dist-extension/
# local dev web app instead of production:
VITE_EXTENSION_WEB_ORIGIN=http://localhost:5173 npm run build:extension
```
1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `dist-extension/`.
3. Sign in to the web app once in the same Chrome profile, then open Gmail and click the launcher (bottom-right).

## Testing
`npm test` (extension tests live in `chrome-extension/__tests__/`). Manually: navigate Gmail (inbox/thread/search) and confirm one launcher; Esc closes; signed-out shows the sign-in state.

## Known limitations / backend needs
- Requires the `__session` cookie to be sent from an extension service worker (cross-site → needs `SameSite=None; Secure`); otherwise add a backend extension-token endpoint. Verify against staging first.
- `/discoveries` has no `sort` param; results are sorted client-side within the 5-row window.
- No company logos (initials only), no Gmail message id on the list wire (no "Open email"), no read/unread state (no launcher badge).
