# PrintFlow Product Studio v2

This release replaces the one-sided incremental designer with a product-first, two-sided customization system.

## Required migration
Run `supabase/migrations/20260718_product_studio_phase2.sql` once after all previous migrations.

## Required Vercel variables
Keep:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SITE_URL
- PRINTFLOW_ENCRYPTION_KEY

No additional variable is required.

## Product setup
Dashboard → Products:
1. Create or open a product.
2. Add sizes and decoration methods.
3. Enable Front only, Back only and/or Front + back.
4. Set side surcharges.
5. Add every color variation.
6. Upload a front and back garment image for each color.
7. Adjust front and back print-area coordinates if needed.
8. Add package prices and checkout URLs.
9. Save and open the customer designer.

## Customer flow
1. Customer chooses a product from the full active product list.
2. Customer chooses front, back or both, according to product settings.
3. Customer chooses garment color and decoration method.
4. Customer uploads one or two artwork files.
5. Each side has independent drag/resize state and preview output.
6. Customer assigns sizes, enters contact information and continues to checkout.

## Integration Center
Dashboard → Integrations can encrypt and test:
- Stripe
- Square
- Squarespace Commerce
- Shopify custom-app token
- Google Drive service-account configuration
- SanMar credentials
- AlphaBroder credentials

S&S remains managed through Supplier Hub because it has catalog import and blank-order functionality.

SanMar and AlphaBroder credentials can be stored now, but their live catalog/order endpoints still require approved provider access and provider-specific implementation.
