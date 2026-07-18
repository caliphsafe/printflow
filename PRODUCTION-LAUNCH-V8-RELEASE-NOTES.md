# PrintFlow Production Launch v8

## Production checkout

- Replaced external/fallback checkout handoff with native server-created Stripe Checkout Sessions and Square Payment Links.
- Stores payment provider, hosted checkout URL, payment reference, payment state, paid amount, and paid timestamp.
- Registers Stripe or Square webhooks during connection.
- Older Stripe connections receive a missing/corrected webhook before checkout is created.
- Added branded payment retry and success pages.
- Server recalculates the customer quote before an order is created.

## Public account creation and onboarding

- New industry-facing marketing home page.
- Public owner signup through Supabase Auth.
- Guided onboarding for shop identity, branding, live payments, S&S, and launch.
- New shops receive an organization, owner membership, shop, subscription foundation, and production pricing profile.
- Existing shops bypass onboarding after migration.

## Production pricing engine

- Exact supplier cost by selected color and size.
- Default global garment markup of 10%.
- No customer pricing packages or per-product pricing matrices.
- Screen Printing: print size, number of colors/screens, optional underbase, setup per screen, location discounts, and quantity thresholds.
- DTF: actual artwork square inches, press fee, per-location minimum, setup, and quantity thresholds.
- Embroidery: estimated stitches, minimum per location, digitizing, location setup, and quantity thresholds.
- Global order setup, optional design optimization, and reusable add-ons.
- Product administration now contains cost basis and production compatibility only.

## Storefront UX

- Restored and expanded shop branding with primary, text, accent, and surface colors.
- Added hero badge and trust message.
- Improved product-first catalog, live pricing explanation, method inputs, upload guidance, and payment-readiness states.
- Demo supplier products are excluded from the live customer storefront.

## Supplier production mode

- Removed the Demo Catalog tab from Supplier Catalog.
- Suppliers → Catalog is live S&S only.
- Supplier Hub presents S&S, manual products, and honest roadmap providers.
- S&S imports default to Screen Print, DTF, and Embroidery availability and preserve live supplier cost, images, inventory, and SKUs.

## Dashboard and order operations

- Launch-readiness checklist.
- Paid revenue and payment status metrics.
- Order details show supplier cost, garment markup, print method/tier details, setup, services, add-ons, payment provider/reference, amount received, original files, and mockups.
