# PrintFlow Platform — SaaS-Ready Pilot

Start with `START-HERE.md` if your Supabase project exists but the tables have not been created yet.

This repository is the first production pilot for a future white-label custom
apparel platform. It is ready to deploy for one Squarespace print-shop client,
but its data model and application structure already support multiple
organizations and shops.

## Included now

- Public shirt designer at `/s/[shop-slug]`
- Shirt color, package and size selection
- Original artwork upload
- Drag and resize live shirt preview
- Private original and preview storage in Supabase
- Unique Design ID for every submission
- Squarespace checkout handoff
- Paid-order polling through Squarespace Orders API
- Google Drive + Google Sheet delivery
- Supabase email/password admin authentication
- Tenant-aware protected dashboard
- Order list and individual order/file pages
- Shop-specific settings and generated one-line embed code

## Future-ready decisions already included

- `organizations` and `organization_members`
- Every shop belongs to an organization
- Every design carries both `organization_id` and `shop_id`
- Row Level Security isolates authenticated organization members
- Checkout is treated as an adapter, not part of the designer
- Google delivery is treated as an integration, not the order database
- One hosted `embed.js` can serve every shop using `data-shop`

---

# PART 1 — Upload to GitHub

1. Download and unzip the project.
2. Create a new empty GitHub repository, for example:
   `printflow-pilot`
3. In GitHub, click **Add file → Upload files**.
4. Upload everything inside the `printflow-customizer` folder.
5. Commit the files to the `main` branch.

The folder containing `package.json` must be the repository root.

---

# PART 2 — Create Supabase

## A. Create the project

1. Create a new Supabase project.
2. Save the database password somewhere secure.
3. Open **Project Settings → API**.
4. Copy:
   - Project URL
   - Publishable/anon key
   - Service-role key

Never place the service-role key in Squarespace or browser code.

## B. Run the schema

1. Open **SQL Editor**.
2. Open `supabase/schema.sql` from this repository.
3. Copy the entire file into the SQL Editor.
4. Click **Run**.

This creates:

- Organizations
- Organization memberships
- Shops
- Private integrations
- Designs/orders
- Sync-event foundation
- Private artwork and preview buckets
- RLS policies
- Demo tenant and demo shop

## C. Create the pilot admin user

1. Open **Authentication → Users**.
2. Click **Add user**.
3. Create the printing-company owner's email and password.
4. Open `supabase/connect-pilot-owner.sql`.
5. Replace `OWNER@EXAMPLE.COM` with the exact email you created.
6. Run the file in SQL Editor.

That user can now access the demo organization through `/login`.

## D. Configure the shop

Open **Table Editor → shops** and edit the `settings` JSON for
`demo-print-shop`.

Update:

- Brand colors
- Optional logo URL
- Product name
- Available shirt colors
- Available sizes
- Package quantities
- Package prices
- Squarespace checkout URLs
- Upload limit

Do not change the overall JSON structure.

---

# PART 3 — Deploy to Vercel

1. In Vercel, click **Add New → Project**.
2. Import the GitHub repository.
3. Framework preset should resolve to **Next.js**.
4. Add these environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=your publishable/anon key
SUPABASE_SERVICE_ROLE_KEY=your service-role key
NEXT_PUBLIC_APP_URL=https://your-final-vercel-domain.vercel.app
```

5. Deploy.
6. After Vercel gives you the real domain, confirm `NEXT_PUBLIC_APP_URL` uses
   that exact HTTPS URL.
7. Redeploy after changing the environment variable.

Test these routes:

```text
https://YOUR-DOMAIN.com/
https://YOUR-DOMAIN.com/s/demo-print-shop
https://YOUR-DOMAIN.com/login
https://YOUR-DOMAIN.com/dashboard
https://YOUR-DOMAIN.com/embed.js
```

---

# PART 4 — Prepare Squarespace checkout

Squarespace remains responsible for payment, taxes, shipping, discounts and
receipts in this pilot.

## A. Create package products

Create one Squarespace product for each package configured in Supabase, such
as:

- 12 custom shirts
- 24 custom shirts
- 50 custom shirts
- 100 custom shirts

Copy each real product URL into its matching `checkoutUrl` in the shop settings.

## B. Add the Design ID field

For each package product:

1. Edit the product.
2. Open the product's Add-to-cart form settings.
3. Add a required text field.
4. Name it exactly:

```text
Design ID
```

## C. Add the Design ID injection

Copy the contents of:

```text
integrations/squarespace/product-page-injection.js
```

into Squarespace footer Code Injection.

This reads the Design ID from the product URL and fills the required field.

## D. Embed the designer

The future-facing one-line installation is:

```html
<script
  src="https://YOUR-VERCEL-DOMAIN.com/embed.js"
  data-shop="demo-print-shop"
></script>
```

Place it in a Squarespace Code Block on the custom-order page.

The script creates and automatically resizes the secure designer iframe.

---

# PART 5 — Connect Google Drive and Sheets

The Google receiver is deployed by the printing company while signed into its
own Google account. This keeps the files and spreadsheet under that company's
email.

Follow:

```text
integrations/google-apps-script/SETUP.md
```

It creates:

- `PrintFlow Orders` Drive folder
- `PrintFlow Orders` Google Sheet
- A private webhook secret
- One order folder per paid order

Save the Apps Script web-app URL and webhook secret.

---

# PART 6 — Add private Squarespace and Google credentials

Generate a Squarespace Commerce API credential with read access to Orders.

Then run this in Supabase SQL Editor after replacing all placeholder values:

```sql
insert into public.shop_integrations (
  shop_id,
  checkout_provider,
  squarespace_api_key,
  google_web_app_url,
  google_webhook_secret,
  active
)
select
  id,
  'squarespace',
  'YOUR_SQUARESPACE_API_KEY',
  'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
  'YOUR_GOOGLE_WEBHOOK_SECRET',
  true
from public.shops
where slug='demo-print-shop'
on conflict (shop_id) do update set
  squarespace_api_key=excluded.squarespace_api_key,
  google_web_app_url=excluded.google_web_app_url,
  google_webhook_secret=excluded.google_webhook_secret,
  active=true,
  updated_at=now();
```

Do not place these credentials inside the `shops.settings` JSON.

---

# PART 7 — Deploy the paid-order sync

The included Supabase Edge Function checks Squarespace for paid orders, matches
the Design ID and sends the files and information to Google.

The function lives at:

```text
supabase/functions/sync-squarespace-orders/index.ts
```

Deploy it through the Supabase CLI or Supabase's supported Edge Function
workflow. The function needs these secrets:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Then edit and run:

```text
supabase/cron.sql
```

The included schedule checks every five minutes.

## No-terminal alternative

The visual designer and admin dashboard can be deployed without a terminal.
The scheduled paid-order function is the one area where the Supabase CLI is the
most reliable setup route. A later version can move this worker to a Vercel
Cron route so the entire project is deployable through GitHub and dashboards.

---

# PART 8 — Full live test

1. Open the embedded designer.
2. Select a package and shirt color.
3. Upload artwork.
4. Position and resize it.
5. Assign the exact package quantity across sizes.
6. Enter customer information.
7. Save the design.
8. Continue to Squarespace.
9. Confirm the Design ID appears on the product.
10. Complete a low-cost test order.
11. Confirm the order is marked paid in Squarespace.
12. Allow the scheduled sync to run.
13. Confirm the Google Drive folder and Sheet row were created.
14. Sign into `/dashboard` and confirm the order and private files appear.

---

# Transition into the future SaaS

The next product phase can add these without replacing the pilot designer:

1. Self-service account registration
2. Stripe Billing subscriptions
3. Onboarding wizard
4. Product and pricing editor
5. Staff invitations
6. Stripe Connect merchant payments
7. Square OAuth merchant payments
8. Native Google OAuth instead of Apps Script
9. Custom domains and allowed-domain settings
10. Shopify app/theme extension
11. Usage limits and plan enforcement
12. Built-in production statuses and proof approvals

The pilot client remains the first organization and first shop in that system.
