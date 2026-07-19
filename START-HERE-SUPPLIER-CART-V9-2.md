# PrintFlow Supplier Cart + Overview UX v9.2

## What this release changes

- Replaces blank-order draft language with a provider-specific Supplier Cart.
- Adds `/dashboard/suppliers/cart`.
- Groups purchasing jobs by the supplier attached to each item.
- Sends S&S items to the connected S&S account through the official Orders API.
- Keeps S&S test/live order controls.
- Allows removal from the cart before purchasing.
- Marks cart jobs submitted after the supplier order is confirmed.
- Adds Supplier Cart to dashboard navigation, Supplier Hub, and Overview quick actions.
- Adds spacing above Latest customer activity.
- Restyles Keep moving actions as separated responsive cards.

## Important S&S behavior

The public S&S REST API does not provide access to the shopping cart on ssactivewear.com. PrintFlow therefore maintains the cart inside PrintFlow and submits the final exact SKU quantities through the supported S&S Orders API.

## GitHub

Replace the repository with the contents of this project folder. Do not upload node_modules, .next, package-lock.json, tsconfig.tsbuildinfo, or .env.local.

## Supabase

Run only:

`supabase/migrations/20260724_supplier_cart_overview_v9_2.sql`

This migration updates the existing supplier_order_drafts status constraint and converts old draft/ready rows into cart rows.

## Vercel

No new environment variables are required. Commit to GitHub and allow Vercel to redeploy.

## Test

1. Open a customer order containing imported S&S SKUs.
2. Click Add blanks to supplier cart.
3. Open Dashboard → Supplier cart.
4. Confirm the product, color, size, SKU, quantity, and cost.
5. With S&S test mode enabled, click Create S&S test order.
6. Confirm the returned S&S order reference.
7. Switch to live wholesale orders only after the test succeeds.
