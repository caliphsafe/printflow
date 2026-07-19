# PrintFlow Launch Candidate v9 — Start Here

This is a complete 43 Build replacement release. Upload the complete project, run the single v9 migration, update the Vercel variables, and complete the ordered tests below.

## 1. GitHub

Unzip `printflow-launch-candidate-v9.zip` and open the `printflow-platform` folder.

Upload everything inside that folder to the root of the existing PrintFlow repository and replace matching files.

Do not upload:

- `node_modules`
- `.next`
- `package-lock.json`
- `tsconfig.tsbuildinfo`
- `.env.local`

Keep `.npmrc` at the repository root.

## 2. Supabase

Run only:

`supabase/migrations/20260723_launch_candidate_v9.sql`

The migration creates:

- platform-owner access for `caliph.safe@gmail.com`
- Starter, Growth, and Scale plan records
- monthly plan capacity data
- private platform billing settings
- a 14-day trial end date for trialing accounts that do not already have one

Do not rerun `schema.sql` or earlier migrations.

## 3. Vercel

Keep the existing variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_URL`
- `PRINTFLOW_ENCRYPTION_KEY`

Add:

- `PRINTFLOW_BILLING_STRIPE_SECRET_KEY`

This must be a Stripe secret key belonging to the PrintFlow platform business. It is separate from the Stripe accounts connected by individual print shops for customer orders.

Use a Stripe test key while validating subscriptions, then replace it with the platform live key before launch.

No Stripe price IDs or manually created webhook are required. PrintFlow creates the recurring price, billing webhook, and customer billing portal configuration when the first subscription checkout is started.

## 4. Deploy

Commit the GitHub replacement. Vercel should deploy automatically.

Confirm the deployment reaches `Ready` before testing.

## 5. Test saving

Review these dashboard sections:

- Products
- Pricing
- Shop setup
- S&S supplier settings

A floating Save bar should remain muted when everything is saved and turn black when changes are pending. Navigating away with unsaved changes should trigger a warning.

## 6. Test quantity price breaks

In Pricing, test Screen Printing, DTF, and Embroidery:

1. Add several price breaks.
2. Edit starting quantities.
3. Delete the middle row.
4. Delete the last row.
5. Add another row.
6. Save.
7. Reload the page.

Rows should remain stable. Duplicate starting quantities should show a validation message instead of silently deleting or reopening rows.

## 7. Confirm supplier cost pricing

Import a live S&S product and view its Cost basis tab.

The displayed blank cost should reflect the imported S&S variant prices. Customer quotes use the exact selected color and size cost plus the shop-wide garment markup. Manual products begin with no assumed blank cost and require the shop to enter one.

## 8. Test the customer storefront

Use Storefront preview first.

On desktop, the garment and artwork workspace should remain on the left while product and production choices appear in a clean panel on the right. The pricing summary follows the options. On tablet and mobile, the sections should stack without horizontal overflow.

Test:

- product and color selection
- front, back, and two-sided orders
- Heart Size and Full Size
- Screen Printing, DTF, and Embroidery
- quantities of 12 and above
- 100 MB artwork limit
- saved front and back mockups
- live Stripe or Square checkout

## 9. Test S&S ordering

Open an order created from an imported S&S product.

The supplier section should show exact SKUs and quantities, followed by:

- Blank-order preparation
- Order blanks

In S&S Test mode, use `Create S&S test order` first.

In Live mode, `Order blanks` submits a real wholesale order to the connected S&S account. The admin may order before customer payment, but PrintFlow shows a risk confirmation first. A confirmed S&S order number is stored on the PrintFlow order.

## 10. Test plans and subscriptions

Visit Dashboard → Account.

Confirm:

- selected signup plan is shown
- trial status and date are visible
- Starter, Growth, and Scale are displayed
- paid subscription checkout opens in the platform Stripe account
- returning from checkout updates the plan and status
- Billing settings opens the Stripe customer portal

Monthly order capacity is enforced at 75 orders for Starter, 300 for Growth, and unlimited for Scale.

## 11. Test platform administration

Sign in as `caliph.safe@gmail.com`.

A `Platform admin` link should appear in the dashboard sidebar.

The platform control center can:

- search by shop, owner, or email
- review account, order, and paid-volume totals
- see owner information
- change plan assignment
- change subscription status
- pause or activate storefront access

## 12. Production switch

Before accepting real business:

- use live platform Stripe credentials for PrintFlow subscriptions
- connect each shop’s live Stripe or Square account
- switch S&S from Test orders to Live wholesale orders
- confirm S&S delivery information
- complete one small real customer payment
- complete one small real S&S order
