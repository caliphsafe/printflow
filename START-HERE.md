# PrintFlow — Continue From Your Current Step

You are currently at the point where the Supabase project exists, but the
`shops` table does not. Use this file as the exact continuation order.

## 1. Replace the old GitHub files

Upload this entire project to the GitHub repository. The repository root must
contain `package.json`, `app`, `components`, `supabase`, and `integrations`.

If the repository already contains the earlier pilot, delete/replace its files
with this version rather than mixing the two packages.

## 2. Create the database tables

In Supabase:

1. Open **SQL Editor**.
2. Click **New query**.
3. Open `supabase/schema.sql` from this project.
4. Copy the entire file.
5. Paste it into the Supabase query.
6. Click **Run**.

A successful run creates and seeds the `shops` table. It also creates the
future SaaS foundation without enabling paid subscriptions yet.

### Confirm the installation

1. Create another SQL query.
2. Paste the contents of `supabase/verify-install.sql`.
3. Click **Run**.

You should see:

- `organizations_exists = true`
- `shops_exists = true`
- `designs_exists = true`
- `catalog_products_exists = true`
- `embed_keys_exists = true`
- At least one seeded shop named `demo-print-shop`

Then open **Table Editor**. You should now see `shops`.

### Only if schema.sql fails

Copy the exact Supabase error before changing anything. If this is still an
empty test project and a partial schema needs to be removed, run
`supabase/reset-pilot.sql`, then run `schema.sql` again. Never run the reset
file after real customer orders exist.

## 3. Create the first admin user

1. Open **Authentication → Users**.
2. Click **Add user → Create new user**.
3. Enter your admin email and a temporary password.
4. Turn on **Auto Confirm User** if Supabase shows that option.
5. Save the user.
6. Open `supabase/connect-pilot-owner.sql`.
7. Replace `OWNER@EXAMPLE.COM` with the exact admin email.
8. Run the edited SQL in the SQL Editor.

## 4. Configure the first printing company

Open **Table Editor → shops → demo-print-shop**.

Edit the `name`, `slug`, and `settings` JSON. Keep the JSON structure intact.
Update:

- Brand colors
- Logo URL, if available
- Product name and description
- Shirt colors
- Sizes
- Package prices and quantities
- Squarespace package product URLs
- Maximum file size

The slug becomes the installation identifier. Example:

`your-print-shop`

The public designer will then be:

`https://YOUR-APP-DOMAIN.com/s/your-print-shop`

## 5. Deploy through Vercel

Import the GitHub repository into Vercel and add:

- `NEXT_PUBLIC_SUPABASE_URL` = Supabase Data API URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase publishable key
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase secret key
- `NEXT_PUBLIC_APP_URL` = final Vercel URL

The Supabase secret key belongs only in Vercel. Never put it in GitHub,
Squarespace, or browser code.

Deploy once. After Vercel provides the exact domain, update
`NEXT_PUBLIC_APP_URL` and redeploy.

Test:

- `/`
- `/login`
- `/dashboard`
- `/dashboard/products`
- `/dashboard/integrations`
- `/s/YOUR-SHOP-SLUG`
- `/embed.js`

## 6. Create Squarespace package products

Create one Squarespace product for every package in the shop settings. Each
product represents a fixed checkout total, such as 12, 24, 50, or 100 shirts.

On every product, add a required Add-to-cart form text field named exactly:

`Design ID`

Paste each Squarespace product URL into the matching `checkoutUrl` in the
Supabase shop settings.

## 7. Install the Squarespace handoff

Paste `integrations/squarespace/product-page-injection.js` into Squarespace
Footer Code Injection.

On the custom-order Squarespace page, add a Code Block containing:

```html
<script
  src="https://YOUR-VERCEL-DOMAIN.com/embed.js"
  data-shop="YOUR-SHOP-SLUG"
></script>
```

## 8. Install Google Drive and Sheets delivery

Follow `integrations/google-apps-script/SETUP.md` while signed into the printing
company's Google account. Save the generated:

- Apps Script web-app URL
- Webhook secret

## 9. Connect the private pilot integration

Insert the Squarespace API key, Google web-app URL and Google secret into
`shop_integrations`. The full SQL example is in the main `README.md`.

## 10. Deploy the Squarespace paid-order sync

Deploy `supabase/functions/sync-squarespace-orders/index.ts`, then schedule it
using `supabase/cron.sql`.

## 11. Test one complete order

1. Open the embedded designer.
2. Upload artwork.
3. Complete the size quantities.
4. Continue to Squarespace.
5. Confirm the Design ID is filled.
6. Complete a test payment.
7. Confirm the order appears in `/dashboard/orders`.
8. Confirm the original file and preview reach Google Drive.
9. Confirm the order row reaches Google Sheets.


## Catalog editor upgrade

After deploying this version, run `supabase/migrations/20260716_catalog_v1.sql` once in Supabase SQL Editor. Then log in and open `/dashboard/products`. Product, color, size, package and checkout-link changes appear in `/s/YOUR-SHOP-SLUG` after saving.
