# Squarespace checkout setup

## Important limitation

Squarespace does not provide a supported public storefront cart API that lets
this external designer create an arbitrary-priced cart item. The reliable
integration is therefore:

1. The designer saves the artwork and creates a unique `Design ID`.
2. The customer is redirected to a real Squarespace product page.
3. Squarespace collects payment through its normal checkout.
4. The product order carries the `Design ID`.
5. The scheduled Supabase function finds the paid order and delivers its files
   to the print shop's Google Drive and Sheet.

This keeps checkout, taxes, shipping, discounts, receipts, and payment security
inside Squarespace.

## 1. Create package products

Create one Squarespace product for each price/package offered by the designer,
for example:

- 12 custom shirts
- 24 custom shirts
- 50 custom shirts
- 100 custom shirts

The total shirt size breakdown is stored in PrintFlow. It does not need to be
represented by Squarespace variants unless the shop wants it displayed there.

Copy each product URL into the matching `checkoutUrl` value in the shop's
Supabase `settings.packages` JSON.

## 2. Add the Design ID product form

For every package product:

1. Edit the product.
2. Open **Forms**.
3. Add or connect an Add-to-cart form.
4. Add a required text field.
5. Name the field exactly `Design ID`.

Do not use Squarespace for the artwork upload. Squarespace file-upload fields
are not available in Add-to-cart or checkout forms.

## 3. Install the product-page injection

Add the included `product-page-injection.js` in Squarespace Code Injection,
preferably in the footer.

It reads `?designId=...` from the redirect URL and fills the required
`Design ID` field automatically.

Because Squarespace can change storefront markup, test this script after major
template or platform changes. Even without the script, the required Design ID
field remains a safe manual fallback.

## 4. Embed the customizer

Create a Squarespace page such as `/custom-shirts`, add a Code Block, and paste
the included `embed.html`. Replace:

- `YOUR-VERCEL-DOMAIN`
- `YOUR-SHOP-SLUG`

## 5. Generate a Squarespace API key

The paid-order polling integration requires access to the Squarespace Orders
API. Generate a Commerce API key with read permission for Orders and store it
only in the private `shop_integrations` table.

The printing company may need a Squarespace plan that supports custom Commerce
API applications.
