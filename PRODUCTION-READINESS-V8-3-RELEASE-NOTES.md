# Production Readiness v8.3 Release Notes

## Storefront preview

- Adds `/preview/storefront`, an authenticated, full-screen customer-experience preview.
- Preview works for unpublished shops.
- Checkout is intentionally disabled in preview mode.
- Admin preview links now use the private preview route.
- Public inactive shop URLs show a branded preparation page instead of a 404/load failure.

## Product and pricing navigation

- `Save & open production pricing` saves the current product before navigating.
- The selected product ID and Cost basis tab are preserved in the return URL.
- Pricing has a persistent Back to product action.
- Pricing can Publish & return or return without saving.

## Guided setup

- Adds a context-sensitive Setup help control throughout the dashboard.
- Provides concise instructions and direct links for Overview, Orders, Products, Pricing, Suppliers, Integrations, and Shop setup.
- Adds publication guidance to Shop setup so users understand private preview versus public activation.

## Verification

- TypeScript: passed
- Next.js production build: passed
- Internal static dashboard link audit: passed
