# Component Pricing v5 Release Notes

## Live

- Component-based per-shirt pricing
- Blank + Heart print + Full print formula
- Separate front and back print-size choices
- Quantity-specific component costs
- Visual print-zone calibration using uploaded garment images
- Independent Heart and Full zones on front and back
- Customer movement boundaries and maximum resize limits
- Server-side price verification
- Order-detail print-size and cost breakdown
- Existing flexible quantities with a 12-item minimum
- 100 MB original artwork uploads
- Customer mockup downloads

## Compatibility

Existing products remain readable. Legacy quantity pricing becomes the blank-garment component with print costs initially set to zero. Open and save each product after configuring its Heart and Full print costs and visual zones.

## Supabase

No schema change is required. All new product configuration is stored in existing JSONB fields.

## Verification

- `npx tsc --noEmit` passed
- `npm run build` passed on Next.js 16.2.10
