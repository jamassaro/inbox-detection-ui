/** Scoped Tailwind config for the Gmail extension: scans only what it renders. */
export default {
  content: ['./chrome-extension/**/*.{ts,tsx}', './src/lib/discoveryHelpers.ts'],
  theme: { extend: {} },
  plugins: [],
}
