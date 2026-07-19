# PrintFlow Aesthetic Refinement v10.1

## GitHub
Replace the current PrintFlow project with the contents of this `printflow-platform` folder. Do not upload `node_modules`, `.next`, `.env.local`, or `tsconfig.tsbuildinfo`.

## Supabase
No migration is required for this release. Do not rerun `schema.sql` or any previous migration.

## Vercel
No environment variables or project settings change. Commit the files to the branch connected to Vercel and wait for the deployment to show Ready.

## Test checklist
1. Scroll a long dashboard page and confirm the black sidebar remains full-height and fixed.
2. Confirm the sidebar menu scrolls internally while the email, Platform admin, and Sign out controls remain visible.
3. Test the mobile Menu and confirm account details and Sign out remain inside the black menu.
4. Edit a product or pricing setting and confirm Save and Setup help share the same bottom baseline.
5. On Overview, confirm Refresh and Catalog are equal-height and aligned.
6. Confirm Keep moving uses the same icons as the sidebar.
7. Open an order and test Back to orders, Previous, and Next.
8. Review Integrations on desktop, tablet, and mobile; logos must remain compact and copy must not overlap them.
9. In Shop setup, scroll the settings form and confirm the preview remains visible.
10. In the customer customizer, confirm the garment remains visible while the configuration column scrolls on desktop.
11. On mobile, confirm the compact garment workspace remains available while working through the order form.
