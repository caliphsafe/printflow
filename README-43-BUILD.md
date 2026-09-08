# PrintFlow SanMar FTP Catalog + One-Click Order — 43 Build

Affected-files-only patch for `caliphsafe/printflow`.

## Scope
This patch changes only the SanMar supplier catalog/product import path and supplier-cart ordering path needed to make SanMar behave like the existing S&S workflow. It does not redesign or change unrelated PrintFlow pages, pricing, storefront logic, Square, S&S catalog behavior, or other integrations.

## Why the old SanMar browse failed
SanMar's current integration guides explicitly recommend FTP flat files for a full-catalog load. Large product/category data may be exported rather than returned as one immediate SOAP response. The prior PrintFlow code called `getProductInfoByCategory`, so SanMar returned an export message and PrintFlow could only fall back to exact style-number lookup.

This build changes the architecture to:

1. **SanMar SFTP / EPDD** -> persistent visual catalog index for fast browsing/search/filter.
2. **SanMar Web Services** -> live exact-style product data, pricing, inventory and media when a style is selected/imported.
3. **SanMar PO Web Service** -> pre-submit inventory check + SubmitPO from the supplier cart when SanMar has separately approved production PO integration.

## One-time install

### 1. Replace/add only the files in this ZIP
Keep their folder paths exactly as provided.

### 2. Run the one SQL migration in Supabase
Run:
`supabase/migrations/20260908_sanmar_catalog_cache.sql`

This creates only the SanMar visual catalog cache table and its RLS policy.

### 3. Deploy to Vercel
`package.json` adds two server-only dependencies:
- `ssh2-sftp-client`
- `csv-parse`

There is intentionally **no package-lock.json** in this patch.

### 4. In PrintFlow -> Suppliers -> SanMar
Your existing Web Services connection remains the same. Add the **separate SanMar FTP/SFTP password** issued by SanMar and confirm:
- Host: `ftp.sanmar.com`
- Port: `2200`
- SFTP username: your SanMar customer number
- Catalog file: `SanMarPDD/SanMar_EPDD.csv`

Then click **Save + sync SanMar catalog**.

After the first sync, SanMar product pages can browse/search/filter the cached full catalog instead of using the category SOAP request that caused the export warning.

## Product image fix
The EPDD feed is used as the image fallback/source for real SanMar garment imagery, including front/back flat/model fields. When a style is opened or imported, PrintFlow still requests the live exact SanMar style and merges the nightly catalog imagery into it. Imported product colors therefore persist real `frontImageUrl` / `backImageUrl` values so the designer/storefront can use the real garment instead of the SVG fallback.

The SanMar settings save also corrects the PromoStandards Media Content endpoint default to:
`https://ws.sanmar.com:8080/promostandards/MediaContentServiceBinding`

## One-click SanMar blank ordering
The Supplier Cart now supports SanMar alongside S&S.

SanMar ordering uses:
1. `getPreSubmitInfo` to verify inventory.
2. `submitPO` to submit the wholesale PO.
3. The EPDD `inventoryKey`, `sizeIndex`, and `SANMAR_MAINFRAME_COLOR` values to reduce order errors.

### Important
SanMar product-data/Web Services activation does **not automatically mean production PO submission is approved**. SanMar's PO guide documents a separate PO onboarding/testing step. Leave **SanMar production PO submission is approved** OFF until SanMar confirms that production PO ordering has been enabled for your account.

Once approved, enable it in Suppliers and complete the SanMar ship-to address/shipping method. The Supplier Cart will then show **Order from SanMar** for SanMar jobs just as it shows the S&S order action for S&S jobs.

## Existing S&S behavior
The S&S catalog and S&S order submission branch are preserved. This patch does not alter S&S credentials, catalog calls, test/live order setting, or `/orders/` payload behavior.

## Security
- Never put SanMar passwords in source code or Vercel environment variables for this flow.
- PrintFlow encrypts the SanMar.com password and the separate SFTP password in the existing supplier connection record.
- The server never sends the encrypted SFTP secret to the browser.

## Verification performed
- All TypeScript/TSX files in this patch passed TypeScript `transpileModule` syntax validation.
- No `package-lock.json` is included.
- A full Next production build was not run against the entire repository in this isolated patch workspace.
