# PrintFlow Admin Experience v10 — 43 Build

## 1. GitHub

Replace the current repository contents with everything inside this `printflow-platform` folder.

Do not upload:

- `node_modules`
- `.next`
- `.env.local`
- `tsconfig.tsbuildinfo`

Keep `.npmrc` at the repository root.

## 2. Supabase

Run only:

`supabase/migrations/20260725_admin_experience_v10.sql`

This creates private platform support notes and platform-admin audit history. It does not replace or remove existing shop, order, pricing, supplier, payment, or subscription data.

Do not rerun `schema.sql` or older migrations.

## 3. Vercel

No new environment variables are required. Keep the existing variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `PRINTFLOW_ENCRYPTION_KEY`
- `PRINTFLOW_BILLING_STRIPE_SECRET_KEY`

Commit the replacement files and wait for the Vercel deployment to reach **Ready**.

## 4. Recommended test order

1. Open Dashboard and verify the black navigation fills the entire left side.
2. Test the mobile Menu from a narrow browser window.
3. Review Pricing Model, Supplier Intelligence, Latest Activity, and Keep Moving on Overview.
4. Open an order and use Back to orders.
5. Add blanks to Supplier Cart and confirm the garment thumbnail appears.
6. Review Integrations and Suppliers brand cards.
7. Edit Shop Setup while watching the fixed live preview.
8. Open Account & billing and update the business profile.
9. Sign in as `caliph.safe@gmail.com` and test Platform admin support actions.
10. Create a new account and complete or skip each onboarding section.
11. Open the customer storefront, test the product catalog, Full Size Front default, Order Help, mobile layout, and simple pricing summary.
