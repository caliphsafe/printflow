# PrintFlow S&S Live Catalog v7

This release connects the existing S&S API integration directly to Dashboard → Suppliers → Catalog.

## What was wrong

The Supplier Catalog page only queried PrintFlow's local demo catalog table. Live S&S routes existed elsewhere, so connecting S&S did not change the catalog screen.

## What is fixed

- Connected shops open in **S&S live catalog** mode by default.
- The catalog loads real S&S styles.
- Search supports brand, style name, product title, and part number.
- Brand and category filters are generated from the live catalog.
- Selecting a style loads real color images, front/back images, exact SKUs, sizes, wholesale cost, and inventory.
- Admins choose colors and import them directly into PrintFlow Products.
- Demo products remain in a clearly separated Demo catalog tab.
- The live style index is cached for 15 minutes to reduce S&S API usage.
- Refresh Catalog forces a new S&S style-index request.

## GitHub

Replace the existing repository files with the contents of the `printflow-platform` folder in the ZIP.

## Supabase

No migration is required for v7. Do not run schema.sql or any previous migration.

## Vercel

No new environment variables are required. Keep the existing Supabase and encryption variables, commit to GitHub, and allow Vercel to redeploy.

## Test

1. Open Dashboard → Suppliers → Catalog.
2. Confirm `S&S live catalog` is selected.
3. Search `Gildan 5000`.
4. Select the style.
5. Confirm live colors, prices, sizes, SKU count, and inventory appear.
6. Choose colors and click Import selected colors.
7. Open Dashboard → Products and configure customer pricing and print zones.
