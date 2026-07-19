# Build Verification — Launch Candidate v9

Verified on July 18, 2026.

- Package version: `0.9.0`
- TypeScript: `npx tsc --noEmit` passed
- Production build: `npm run build` passed
- Production dependency audit: 0 known vulnerabilities
- Next.js: `16.2.10`
- Generated application pages: 31
- Production routes include:
  - public landing, signup, login, onboarding, and storefront
  - private storefront preview
  - dashboard products, pricing, orders, suppliers, integrations, shop setup, and account billing
  - platform administration
  - Stripe and Square customer checkout
  - Stripe platform subscription checkout and billing portal
  - Stripe, Square, and platform billing webhooks
  - S&S live catalog, imports, and wholesale ordering

The final ZIP excludes dependencies, build cache, local environment files, and generated TypeScript cache files.
