PRINTFLOW — SANMAR INTEGRATION REBUILD 43 BUILD
==================================================

Repository:
https://github.com/caliphsafe/printflow

WHY THIS IS A REBUILD INSTEAD OF ANOTHER PARSER PATCH
-----------------------------------------------------
The existing repository had accumulated several overlapping SanMar paths:

- lib/sanmar.ts
- lib/sanmar-normalized-fixed.ts
- lib/sanmar-complete-style.ts
- lib/sanmar-catalog.ts
- lib/sanmar-catalog-fast.ts
- lib/sanmar-catalog-chunked.ts

The previous fixes still made one live parser responsible for the product
detail result and then tried to repair missing colors afterward.

This build changes the architectural rule:

THE COLOR LIST IS NEVER ALLOWED TO COME FROM ONLY ONE SANMAR RESPONSE.

A style is now the UNION of three independent SanMar sources:

1. Existing SFTP SDL_N / EPDD cache
2. SanMar Standard Product Information:
   getProductInfoByStyleColorSize(style only)
3. PromoStandards Product Data V2:
   GetProductRequest / ProductPartArray

Only after the union is complete do pricing, inventory and media enrich those
variants. A failed live service cannot collapse the product back to one color.

SANMAR FIELD MAPPING USED BY THIS BUILD
---------------------------------------
Customer-facing color:
  Standard Product Info: color
  PromoStandards Product Data:
    ProductPart > ColorArray > Color > standardColorName
  SFTP: COLOR_NAME

SanMar ordering/mainframe color:
  Standard Product Info: catalogColor
  PromoStandards Product Data:
    ProductPart > ColorArray > Color > colorName
  SFTP: SANMAR_MAINFRAME_COLOR

Exact style/color/size identifier:
  Standard Product Info: uniqueKey
  PromoStandards: ProductPart.partId
  SFTP: UNIQUE_KEY

Order identifiers:
  inventoryKey = INVENTORY_KEY
  sizeIndex    = SIZE_INDEX

Inventory:
  PromoStandards Inventory V2 final endpoint:
  /promostandards/InventoryServiceBindingV2final
  Uses up to 200 uniqueKey/partId values per request.

Pricing:
  Standard Pricing getPricing(style only)
  Matches inventoryKey + sizeIndex first.
  Falls back to catalogColor + size.

Media:
  /promostandards/MediaContentServiceBinding
  1004 = Swatch
  1006 = Primary
  1007 = Front
  1008 = Rear
  2001 = High

IMPORTANT IMPLEMENTATION DIFFERENCE
-----------------------------------
The old lib/sanmar-normalized-fixed.ts is no longer imported by the product
detail path in this build. Its silent fallback to the older one-color-prone
normalizer is removed from the active flow.

The SFTP cache is read FIRST, not after a live parser succeeds.

If a live source discovers more colors/variants than the cached style, the
existing sanmar_catalog_styles row is self-healed automatically. No SQL is
required.

FILES IN THIS BUILD
-------------------
ADD:
  lib/sanmar-canonical.ts

REPLACE:
  lib/sanmar.ts
  lib/sanmar-complete-style.ts
  app/api/admin/suppliers/sanmar/style/route.ts
  app/api/admin/suppliers/sanmar/import/route.ts

DO NOT CHANGE:
  Supabase migrations
  SanMar credentials
  SFTP password
  Square
  Advanced website repo
  package.json
  package-lock.json

DEPLOY — GITHUB WEB
-------------------
1. Open caliphsafe/printflow on GitHub.

2. Add:
   lib/sanmar-canonical.ts

3. Replace:
   lib/sanmar.ts
   lib/sanmar-complete-style.ts

4. Replace:
   app/api/admin/suppliers/sanmar/style/route.ts

5. Replace:
   app/api/admin/suppliers/sanmar/import/route.ts

6. Commit the files.

7. Let Vercel deploy PrintFlow.

VERIFY THE FIX
--------------
1. Open Advanced Admin -> SanMar Products.

2. Pick a style that you KNOW has several SanMar colors.

3. The existing inspector still groups from style.variants. This rebuilt
   backend now returns the union of cache + Standard Product Info +
   PromoStandards Product Data.

4. Optional direct verification:
   while logged in to Advanced Admin, open:

   /api/admin/suppliers/sanmar/style?style=PC61

   The JSON now includes:
   diagnostics.cacheColorCount
   diagnostics.standardColorCount
   diagnostics.promoColorCount
   diagnostics.finalColorCount

   finalColorCount is the count the importer actually receives.

5. Select all colors and click Add product to Advanced.

6. Re-import any previously imported SanMar style that was saved with only one
   color. The import route repairs the existing product rather than creating a
   duplicate.

7. Open the Advanced custom-order storefront and verify all imported colors.

NO SQL / NO CREDENTIAL RESET
----------------------------
Do NOT rerun the commerce migration.
Do NOT rerun the SanMar cache migration.
Do NOT reconnect SanMar.
Do NOT change the SFTP password.
No new Vercel environment variables are required.

ABOUT THE OLD FILES
-------------------
lib/sanmar-normalized-fixed.ts is no longer used by this rebuilt style/import
path. You can leave it in the repository for now; it is intentionally inert.
This avoids deleting a file before the new deployment is verified.

WHY THE DIAGNOSTICS MATTER
--------------------------
The old code could silently fall back from a failed Standard Product
Information call to the older parser. That made it impossible to tell whether
SanMar returned many colors and PrintFlow lost them, or whether a particular
source call itself failed.

This build does not hide source failures. The response reports each source
count and warnings while still returning the complete union from whichever
sources succeeded.
