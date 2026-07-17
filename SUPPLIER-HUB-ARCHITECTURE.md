# PrintFlow Supplier Hub Architecture

PrintFlow uses one supplier-neutral product format for manual products, demo products, and approved wholesale connectors.

## Current providers

- **S&S Activewear** — live connector foundation for catalog search, product import, inventory, and blank ordering. AlphaBroder is represented through S&S Activewear rather than as a separate provider.
- **SanMar** — credential-ready connection awaiting approved live API mapping.
- **PrintFlow Demo** — safe local catalog for testing.
- **Manual products** — products from any unconnected or specialty source.

## Shared normalized fields

- Provider
- Supplier name
- Brand
- Style
- Part number
- Color
- Size
- SKU
- GTIN
- Wholesale cost snapshot
- Inventory snapshot
- Front garment image
- Back garment image

Supplier-specific connection settings remain in Supplier Hub. Every available account also appears in Integrations so admins can see their full connection status in one place.
