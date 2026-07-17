# Start Here — PrintFlow Global Pricing + Unified UX v6

This is a complete **43 Build** release. Replace the existing GitHub project with the contents of this folder, run the single additive Supabase migration, and allow Vercel to redeploy.

## Required migration

Run only:

`supabase/migrations/20260720_global_pricing_integrations_ux_v6.sql`

Do not rerun `supabase/schema.sql` or earlier migrations on an existing project.

## New admin route

`/dashboard/pricing`

Defaults installed for every existing shop:

- Order setup: $60 per order
- Design optimization: $100 when requested
- Screen Print adjustment: 0%
- DTF adjustment: 0%
- Embroidery adjustment: 0%
- Heat Transfer adjustment: 0%

## New pricing order

1. Blank garment cost
2. Front and back print components
3. Decoration-method percentage adjustment on print components
4. Setup fee
5. Optional design optimization
6. Optional order or per-item add-ons

## Product overrides

Open Dashboard → Products → Pricing. Each product can:

- Inherit the global setup fee
- Use a custom setup fee
- Disable setup
- Inherit/customize/disable design optimization
- Override a decoration percentage
- Inherit, force-enable, or hide global add-ons

## Customer experience

The selected shop color and text color now visibly brand:

- Header
- Progress indicator
- Product card accents
- Selected controls
- Mockup controls
- Primary checkout button

Customers can request Design Optimization and choose active add-ons. The verified total is recalculated by the server.

## Order files

Dashboard → Orders → Order detail includes, for every active side:

- View original design
- Download original design
- View customer mockup
- Download customer mockup

Signed file links expire after one hour.
