# Supplier Cart + Overview UX v9.2

## Purchasing architecture

Supplier items are now grouped by the `provider` stored on each order line. This allows one customer job to prepare separate purchasing records when future products come from different suppliers.

S&S purchases use the existing connected account and POST the exact SKU and quantity lines to `/v2/orders/`. The S&S website cart is not exposed through the documented public API.

## Dashboard updates

- New Supplier cart navigation item.
- New provider tabs and cart summaries.
- Per-job supplier line review.
- Remove from cart action.
- Test/live S&S order submission.
- Payment-risk warning remains available for ordering before payment.
- Overview spacing and quick-action card cleanup.
