/**
 * Presentational Pro pricing (AGENTS.md business model): $5.99/month or
 * $49/year. Shared by the upgrade and billing pages so both render the same
 * numbers. NEVER derive entitlement logic from these constants — Stripe and
 * the backend are the source of truth (FE-016 agent notes).
 */
export const PLAN_CURRENCY = 'USD';

/**
 * Prices render with en-US number formatting in both locales so EN shows
 * "$5.99/month" and ES shows the same amount with its own period word
 * (FE-016 acceptance).
 */
export const PRICE_LOCALE = 'en-US';

export const MONTHLY_PRICE = 5.99;
export const ANNUAL_PRICE = 49;
