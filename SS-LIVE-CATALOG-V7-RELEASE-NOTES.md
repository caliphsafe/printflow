# S&S Live Catalog v7 — Release Notes

## Live catalog architecture

The supplier catalog screen is now source-aware:

- **S&S live catalog** uses the connected shop's encrypted S&S credentials.
- **Demo catalog** reads only local simulated records.

The live screen no longer reads demo rows or calls the demo import endpoint.

## Live style index

`GET /api/admin/suppliers/ss/styles`

- Loads the S&S style index.
- Supports `q`, `brand`, `category`, `offset`, `limit`, and `refresh`.
- Returns brand/category facets and pagination metadata.
- Caches normalized public style metadata for 15 minutes per shop/server instance.

## Live product details

`GET /api/admin/suppliers/ss/style/[id]`

Returns exact S&S SKU-level data:

- color
- size
- customer wholesale price
- combined inventory
- front image
- back image
- side image
- swatch
- warehouse records

## Import

`POST /api/admin/suppliers/ss/import`

Now receives both the selected live style metadata and selected SKU rows so imported products preserve:

- correct title and description
- category
- style ID
- part number
- supplier name
- live source mode
- front/back images per color
- exact size SKUs
- wholesale prices
- inventory snapshots

## Reliability

- Better S&S error messages.
- 30-second request timeout.
- Large S&S garment images are requested where available.
- Demo API is explicitly limited to `source_mode = demo`.
