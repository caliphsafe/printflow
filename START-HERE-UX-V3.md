# PrintFlow Product Experience UX v3

This release is a UX and pricing-model upgrade over Product Studio v2.

## Major changes
- Cleaner tabbed product editor
- Responsive print-area cards with no horizontal overflow
- Print dimensions entered in inches
- Product color images retain independent front and back uploads
- Customer product-first catalog redesign
- Radio-card design-side selection
- Color swatches and a simpler decoration dropdown
- Quantity steppers by size
- Any order quantity at or above the product minimum (minimum cannot be below 12)
- Automatic quantity-tier pricing
- Server-side price recalculation

## Database
No new Supabase migration is required. The new inch measurements and pricing settings are stored in the existing catalog product configuration JSON.

## Vercel
No new environment variables are required.
