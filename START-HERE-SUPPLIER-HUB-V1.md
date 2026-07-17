# PrintFlow Supplier Hub v1 — Start Here

This release adds a supplier-neutral catalog and order-draft workflow before Phase 2.

## 1. GitHub
Upload everything inside this `printflow-platform` folder to the existing repository and replace matching files.

## 2. Supabase
Run only:

`supabase/migrations/20260717_supplier_hub_v1.sql`

Run the earlier S&S Phase 1 migration first if it has not already been run. Do not rerun the original full schema.

The new migration creates:
- `supplier_catalog_styles`
- `supplier_catalog_variants`
- `supplier_order_drafts`
- two safe demo T-shirt styles with front/back images, colors, sizes and simulated SKUs

## 3. Vercel
No new environment variables are required for demo mode.

Keep the existing variables, including `PRINTFLOW_ENCRYPTION_KEY` if you already added it. It will be required when S&S credentials become available.

Push to GitHub and let Vercel redeploy.

## 4. Test
1. Open `/dashboard/suppliers`.
2. Open **Browse demo catalog**.
3. Choose a demo shirt.
4. Select colors and import it.
5. Open `/dashboard/products` and configure customer pricing.
6. Open the public designer and submit a test design.
7. Once its status is paid, open the order and click **Prepare blank order draft**.

Demo mode never calls a live supplier and cannot buy garments.
