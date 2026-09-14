SANMAR INTEGRATION AUDIT — PRINTFLOW
====================================

Reviewed against:
- SanMar Web Services Integration Guide v24.6
- SanMar FTP Integration Guide v23.6
- SanMar Purchase Order Integration Guide v24.5
- Current caliphsafe/printflow main branch

ROOT FINDINGS
=============

1. PRODUCT COLORS HAD TOO MANY COMPETING SOURCES
------------------------------------------------
The repository had multiple independent SanMar normalizers/sync implementations.
The exact-style route ultimately depended on lib/sanmar-normalized-fixed.ts,
which itself could silently fall back to lib/sanmar.ts.

That meant a failed new parser did not fail visibly. It could quietly return to
the older parser and reproduce the same one-color result.

FIX:
The active style path now uses lib/sanmar-canonical.ts and
lib/sanmar-complete-style.ts. There is no silent fallback to the old normalizer.

2. CACHE WAS BEING USED AS A REPAIR LAYER INSTEAD OF THE FIRST SOURCE
----------------------------------------------------------------------
SanMar's own guidance recommends FTP SDL/EPDD data for complete/full-catalog
data and Web Services for live style/product enrichment.

The previous style flow started with live SOAP and only merged the SFTP cache
after a live normalizer returned.

FIX:
The SFTP cache is now read first. The final variant list is the union of:
- SFTP cache
- Standard Product Information style-only response
- PromoStandards Product Data ProductPartArray

Pricing/inventory/media can enrich that union but cannot remove variants.

3. DISPLAY COLOR AND ORDER COLOR WERE BEING TREATED AS THE SAME FIELD
----------------------------------------------------------------------
SanMar exposes separate color concepts.

STANDARD PRODUCT INFORMATION:
  color        = Full Color Name, customer/website-facing
  catalogColor = SanMar mainframe/order color

PROMOSTANDARDS PRODUCT DATA:
  ColorArray.Color.standardColorName = customer-facing color
  ColorArray.Color.colorName         = backend/API color

SFTP:
  COLOR_NAME              = customer-facing color
  SANMAR_MAINFRAME_COLOR  = ordering/API color

The old PromoStandards path could read a generic colorName without guaranteeing
it came from ColorArray. SanMar specifically documents primaryColor separately
and notes it is not the field to use for this purpose.

FIX:
The new canonical parser explicitly reads ColorArray and preserves both the
display color and catalog/mainframe color.

4. UNIQUE PRODUCT IDENTIFIERS WERE NOT PRESERVED AS FIRST-CLASS DATA
--------------------------------------------------------------------
SanMar identifies one exact style/color/size item with:

  UNIQUE_KEY = INVENTORY_KEY + SIZE_INDEX

PromoStandards uses that same value as:
  partId

The older generic PrintFlow model mainly kept:
  sku
  colorName
  sizeName

FIX:
The rebuilt path treats Unique_Key / partId as the canonical SKU and preserves:
- uniqueKey
- inventoryKey
- sizeIndex
- catalogColor
- mainframeColor
- colorName
- sizeName

The import route stores those identifiers in the raw catalog product JSON.

5. INVENTORY ENDPOINT DID NOT MATCH THE CURRENT SANMAR GUIDE
------------------------------------------------------------
Old default:
  /promostandards/InventoryServiceBindingV2

SanMar Web Services Guide v24.6:
  /promostandards/InventoryServiceBindingV2final

FIX:
Both lib/sanmar-canonical.ts and the rebuilt lib/sanmar.ts use:
  InventoryServiceBindingV2final

The new inventory code also respects SanMar's 200-partId maximum per PartArray
request.

6. MEDIA DEFAULT DID NOT MATCH THE CURRENT SANMAR GUIDE
-------------------------------------------------------
Old default in lib/sanmar.ts:
  /promostandards/MediaServiceBinding

Current SanMar Media Content endpoint:
  /promostandards/MediaContentServiceBinding

FIX:
The rebuilt clients use MediaContentServiceBinding and map:
  1004 = Swatch
  1006 = Primary
  1007 = Front
  1008 = Rear
  2001 = High

7. THE LOWER-ENVIRONMENT HOST WAS OUTDATED
------------------------------------------
Old code used:
  https://test-ws.sanmar.com:8080

SanMar v24.6 uses:
  https://edev-ws.sanmar.com:8080

FIX:
Both rebuilt clients map PrintFlow's existing "test" setting to EDEV.

8. CATEGORY PRODUCT INFORMATION WAS TREATED LIKE A SYNCHRONOUS BROWSER CALL
----------------------------------------------------------------------------
SanMar v24.6 documents getProductInfoByCategory as asynchronous. It returns an
acknowledgement and writes the generated CSV to SanMarPI on FTP.

FIX:
The rebuilt lib/sanmar.ts no longer treats that API as the primary browse
mechanism. The current Advanced catalog browser remains correctly backed by
the SFTP cache.

9. SOURCE FAILURES WERE HIDDEN
------------------------------
The previous failed-patch normalizer could catch a new Product Information error
and fall back to the older parser, so the UI could still "work" while returning
only the same incomplete data.

FIX:
The new style response includes diagnostics:
- cacheVariantCount
- cacheColorCount
- standardVariantCount
- standardColorCount
- promoVariantCount
- promoColorCount
- finalVariantCount
- finalColorCount
- pricingRows
- inventoryRows
- mediaColors
- warnings

This lets the result prove which source supplied each breadth of data.

10. EXISTING BAD CACHE ROWS CAN SELF-HEAL
-----------------------------------------
If a cached style currently contains fewer colors than the union returned by
SanMar's two exact-style services, opening that style now updates the existing
sanmar_catalog_styles row with the fuller variant set.

No SQL migration is required.

CANONICAL DATA FLOW AFTER THIS BUILD
====================================

SFTP SDL_N / EPDD cache
       |
       +------------------------------+
                                      |
Standard Product Information          |
getProductInfoByStyleColorSize(style) |
       |                              |
       +--------------+               |
                      |               |
PromoStandards Product Data           |
GetProduct(style) -> ProductPartArray |
       |              |               |
       +--------------+---------------+
                      |
               UNION BY UNIQUE_KEY
                      |
              COMPLETE COLOR LIST
                      |
       +--------------+--------------+
       |              |              |
    Pricing        Inventory        Media
inventoryKey +    uniqueKey /      productId +
 sizeIndex        partId           partId
       |              |              |
       +--------------+--------------+
                      |
               ENRICH ONLY
                      |
                 Import route
                      |
            configuration.colors
                      |
             Advanced storefront

A pricing, inventory, or media failure can no longer reduce the number of
colors returned for a style.

VALIDATION PERFORMED
====================
A TypeScript no-emit compile check was run against the rebuilt modules/routes.

A fixture modeled on SanMar's documented XML was executed with:
- two Standard Product Information colors
- two PromoStandards ProductPart colors
- separate inventoryKey/sizeIndex values
- account-specific pricing
- PromoStandards inventory
- Media Content front images

Validated output:
- White / 118032 / inventoryKey 11803 / sizeIndex 2
- Red / 220012 / inventoryKey 22001 / sizeIndex 2
- customer pricing mapped by inventoryKey + sizeIndex
- inventory mapped by Unique_Key / partId
- MediaContent 1007 mapped to front image
- ProductData primaryColor deliberately set to a wrong value in the fixture;
  parser correctly ignored it and used ColorArray.
- Current InventoryServiceBindingV2final endpoint used.
- Current MediaContentServiceBinding endpoint used.
