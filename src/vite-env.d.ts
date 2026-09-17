/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API base URL — required. Never hardcoded; see .env.example. */
  readonly VITE_API_BASE_URL?: string
  /** Stripe price ID for the Pro Monthly plan — POST /billing/checkout (BE-030, FE-016). */
  readonly VITE_STRIPE_PRICE_MONTHLY_ID?: string
  /** Stripe price ID for the Pro Annual plan — POST /billing/checkout (BE-030, FE-016). */
  readonly VITE_STRIPE_PRICE_ANNUAL_ID?: string
}
