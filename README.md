# PrintFlow

PrintFlow is a multi-tenant custom apparel ordering, product-customization, supplier, and production platform built with Next.js and Supabase.

## Current platform areas

- Public branded product-first designer at `/s/[shop-slug]`
- Front, back, and two-sided artwork workflows
- Heart Size and Full Size visual print zones
- Flexible size runs with a minimum quantity of 12
- Component pricing for garments and each printed side
- Global setup, design optimization, decoration adjustments, and add-ons
- Manual and supplier-imported products
- S&S Activewear catalog and wholesale-order foundation
- Supplier Hub and unified Integration Center
- Private original artwork and mockup storage
- Admin order detail with file viewing and downloads
- Shop branding, messaging, and 100 MB artwork uploads

## Latest existing-project upgrade

Read:

`START-HERE-GLOBAL-PRICING-UX-V6.md`

Run only this new migration on an existing project:

`supabase/migrations/20260720_global_pricing_integrations_ux_v6.sql`

## Required Vercel variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `PRINTFLOW_ENCRYPTION_KEY`

Never commit secret values to GitHub.

## Verification

This release was verified with:

- `npx tsc --noEmit`
- `npm run build`
