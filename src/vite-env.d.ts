/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API base URL — required. Never hardcoded; see .env.example. */
  readonly VITE_API_BASE_URL?: string
}
