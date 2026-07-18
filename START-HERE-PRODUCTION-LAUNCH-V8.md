# PrintFlow Production Launch v8 — Start Here

This is a full 43 Build release. Replace the GitHub project, run the additive Supabase migration, confirm the production Vercel origin, and then test checkout in the ordered sequence below.

## 1. GitHub

Upload everything inside `printflow-platform` to the root of the existing repository and replace matching files. Do not upload `.next`, `node_modules`, `.env.local`, or `package-lock.json`.

## 2. Supabase

Run only:

`supabase/migrations/20260721_production_launch_v8.sql`

The migration adds onboarding state and native payment tracking fields. It marks existing shops as already onboarded, so the current owner is not redirected into account setup.

In Supabase Authentication settings:

- Set Site URL to the exact production PrintFlow domain.
- Add `https://YOUR-DOMAIN.com/onboarding` to Redirect URLs.
- Keep email/password authentication enabled.

## 3. Vercel

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` — exact production origin, no trailing slash
- `NEXT_PUBLIC_APP_URL` — same origin
- `PRINTFLOW_ENCRYPTION_KEY`

Deploy after the migration is complete.

## 4. Existing Stripe connection

Open Dashboard → Integrations → Stripe.

Reconnect once after deploying v8. This verifies the live account and registers the correct production webhook URL. Checkout also self-heals an older Stripe connection by creating a missing webhook before the first payment session.

## 5. Live launch test

1. Open Dashboard → Integrations and verify Stripe or Square is Live.
2. Open Dashboard → Suppliers and switch S&S Test mode off only when ready for real wholesale orders.
3. Open Dashboard → Suppliers → Catalog and import a live S&S product.
4. Review Dashboard → Pricing.
5. Review product colors, images, sizes, methods, and print zones.
6. Open Dashboard → Shop setup and activate the storefront.
7. Open the public storefront in a private browser window.
8. Submit an order using a payment test environment first.
9. Confirm the hosted checkout opens instead of the PrintFlow home page.
10. Complete payment and confirm the order changes to Paid.
11. Download original artwork and mockups from the order detail view.
12. Repeat with production credentials and a small real transaction.

## Operational integration policy

Only integrations with a completed live workflow are connectable:

- Stripe — hosted checkout and payment webhooks
- Square — hosted payment links and payment webhooks
- S&S Activewear — live catalog, imports, inventory/SKUs, and wholesale ordering

Other cards remain visible as roadmap and do not accept credentials until their complete operational workflow exists.
