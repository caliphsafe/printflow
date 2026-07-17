# PrintFlow Component Pricing + Visual Print Zones v5

This is a complete **43 Build** release.

## What changed

- Pricing is calculated per shirt from three admin-controlled components:
  - Blank garment cost
  - Heart Size print cost per printed side
  - Full Size print cost per printed side
- Quantity tiers can independently change all three component prices.
- Customers choose Heart Size or Full Size separately for the front and back.
- Heart Size defaults to 4 × 4 inches and Full Size defaults to 14 × 18 inches.
- Admins configure four visual zones on the real uploaded garment image:
  - Front Heart
  - Front Full
  - Back Heart
  - Back Full
- Each visual zone contains:
  - A dashed movement boundary
  - A solid maximum print box
  - A default artwork position
- Customer artwork can move anywhere inside the allowed zone but cannot resize beyond the configured maximum print.
- Order details store the selected print size and complete unit-price breakdown.

## Pricing example

At a 12+ tier:

- Blank shirt: $3
- Heart Size print: $3 per side
- Full Size print: $5 per side

A Heart Size front and Full Size back costs:

`$3 blank + $3 front + $5 back = $11 per shirt`

For 12 shirts:

`12 × $11 = $132`

## GitHub

Replace the current repository contents with the contents of this folder. Keep `package.json` at the repository root.

Do not upload:

- `.env.local`
- `node_modules`
- `.next`
- `package-lock.json`
- `tsconfig.tsbuildinfo`

## Supabase

No new migration is required. Product pricing and print zones are stored in the existing `catalog_products.configuration` JSONB field. Existing products normalize safely and receive the new configuration when an admin saves them.

Do not rerun `schema.sql` or any previous migration.

## Vercel

No new environment variables or build settings are required. Keep:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `PRINTFLOW_ENCRYPTION_KEY`

Commit to GitHub and allow Vercel to deploy automatically.

## Required admin setup per product

1. Open Dashboard → Products.
2. Open Colors and confirm front/back garment images.
3. Open Print zones.
4. Select a reference color.
5. Configure Front Heart, Front Full, Back Heart, and Back Full.
6. Open Pricing.
7. Set blank, Heart Size, and Full Size unit costs in each quantity tier.
8. Save the product.

## Recommended first test

1. Set a 12+ tier to blank $3, Heart $3, Full $5.
2. Choose Front Heart and Back Full as a customer.
3. Enter a total quantity of 12.
4. Confirm $11 per shirt and $132 total.
5. Upload separate front/back art.
6. Confirm Heart art can move center-to-left-chest but cannot exceed 4 × 4 inches.
7. Confirm Full art can move and resize within the configured full zone but cannot exceed 14 × 18 inches.
8. Submit and verify the pricing breakdown in Dashboard → Orders.
