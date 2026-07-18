# S&S Activewear — Production Setup

S&S REST authentication uses the shop’s account number and API key. PrintFlow encrypts both values with `PRINTFLOW_ENCRYPTION_KEY`.

## Connect

1. Open Dashboard → Integrations → S&S Activewear.
2. Choose Manage live connection.
3. Enter the S&S account number and API key.
4. PrintFlow verifies the credentials before storing them.
5. Open Dashboard → Suppliers → Catalog to browse real products.

## Import

A live import preserves:

- style, brand, category, and part number
- selected colors
- front and back garment images
- size-specific SKUs and GTINs
- account wholesale cost
- inventory snapshot

Imported products start with Screen Print, DTF, and Embroidery enabled. Review their images, sizes, print zones, and availability before publishing.

## Ordering mode

The supplier connection retains a test/live order switch:

- Test mode validates the order payload without purchasing blanks.
- Live mode can create a real wholesale S&S order from a paid PrintFlow job.

Keep test mode on during validation. Turn it off only after the shop has verified its shipping address, payment profile, warehouse settings, and a complete paid-order test.
