import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Backend route mounts proxied in dev so the session cookie stays first-party
// (mirrors the Firebase Hosting rewrites in firebase.json). `/auth/callback`
// is a SPA route and is deliberately excluded.
const BACKEND_PREFIXES = [
  'auth', 'account', 'billing', 'calendar', 'gmail', 'scan', 'events', 'stats',
  'preferences', 'jobs', 'insights', 'subscriptions', 'discoveries', 'chat',
  'briefing', 'reminders', 'actions', 'investigation', 'promo-codes',
]

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Only proxy when the app is configured for same-origin API calls
  // (VITE_API_BASE_URL empty). A non-empty base URL talks to that host directly.
  const sameOrigin = env.VITE_API_BASE_URL === ''
  const target = env.VITE_DEV_PROXY_TARGET || 'https://inbox-api-232545026192.us-central1.run.app'

  const proxy = sameOrigin
    ? Object.fromEntries(
        BACKEND_PREFIXES.map((prefix) => [
          // `^/auth/(?!callback)` style: keep /auth/callback on the SPA.
          prefix === 'auth' ? '^/auth/(?!callback)' : `^/${prefix}/`,
          { target, changeOrigin: true, secure: true },
        ]),
      )
    : undefined

  return {
    plugins: [react()],
    server: {
      host: true, // Listen on all addresses, including LAN and public addresses
      port: 5173,
      watch: {
        usePolling: true, // Enable polling for file changes (useful in Docker)
      },
      proxy,
    },
  }
})
