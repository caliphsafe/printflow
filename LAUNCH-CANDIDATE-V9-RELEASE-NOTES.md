# PrintFlow Launch Candidate v9

## Platform-wide save experience

Products, production pricing, storefront settings, and connected S&S settings now use a consistent floating Save bar. The bar is muted when saved and turns black when changes need attention. Unsaved navigation warnings reduce accidental loss of work.

## Stable quantity price breaks

Quantity threshold rows now use permanent row identifiers. Adding, editing, sorting, and deleting a row no longer causes other rows to reopen or disappear. Duplicate thresholds are reported before saving.

## Real blank-cost basis

Imported products use the exact S&S `customerPrice` for the selected size and color. The shop-wide garment markup is calculated from that cost. New manual products no longer assume a $3 blank.

## S&S wholesale ordering

Admins can submit the exact supplier SKUs directly from an order. Ordering can occur before or after customer payment. Unpaid ordering requires an explicit risk confirmation. Test mode remains available before enabling real wholesale orders.

## Customer storefront redesign

The customize experience uses a modern glass layout with the garment workspace on the left and order choices on the right. It adapts into a single-column mobile flow while keeping selection, artwork, quantity, and price controls readable.

## Production pricing

The shop-wide pricing model supports supplier markup, Screen Printing, DTF, Embroidery, setup, design optimization, add-ons, and stable volume discounts. Product-specific customer price tables are not required.

## SaaS plans

Starter, Growth, and Scale now have persistent account records, a 14-day trial, Stripe subscription checkout, billing management, and monthly order-capacity enforcement.

## Public launch site and signup

The homepage now explains the connected workflow, feature set, customer experience, and three subscription plans. Signup captures the selected plan and business information before guided onboarding.

## Platform owner controls

`caliph.safe@gmail.com` receives platform-level access after the migration. The control center provides account search, owner information, plans, statuses, storefront availability, order totals, and paid volume.

## Integration states

- Stripe shop checkout: live when connected with valid credentials
- Square shop checkout: live when connected with valid credentials
- S&S Activewear: live catalog and ordering when connected
- PrintFlow subscription billing: live when the platform Stripe key is configured
- Other provider cards remain clearly marked until their complete business workflow is available
