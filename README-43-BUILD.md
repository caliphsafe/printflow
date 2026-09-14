PRINTFLOW — SANMAR DEFINITIVE CATALOG SYNC 43 BUILD
================================================

This patch is based on the SanMar FTP Integration Guide v23.6,
SanMar Web Services Integration Guide v24.6, and SanMar Purchase
Order Integration Guide v24.5.

ROOT CAUSE ADDRESSED
--------------------
The old implementation attempted to stream/parse the entire SanMar
catalog and then write the cache only after the whole remote file had
finished. In a serverless Vercel request, a long SFTP transfer could
hit the function limit before the first catalog rows were committed.
That leaves sanmar_catalog_styles empty even though SFTP credentials
are valid.

THIS BUILD CHANGES THE SYNC MODEL
---------------------------------
1. Connect to ftp.sanmar.com:2200 using the separate SFTP password.
2. Prefer the configured SanMar_SDL_N.csv browse file.
3. If the configured path is wrong, list SanMarPDD and discover
   SanMar_SDL_N.csv / SanMar_EPDD.csv case-insensitively.
4. Read only a bounded byte range per request.
5. Parse that CSV chunk.
6. Merge partial style variants with already-cached style data.
7. UPSERT that chunk immediately into sanmar_catalog_styles.
8. Return progress/cursor to the browser.
9. Browser automatically calls the next chunk.
10. Only after the final chunk succeeds are stale rows removed.

This means a Vercel request no longer needs to download, parse, and
write the entire SanMar catalog before any products become visible.

FILES
-----
ADD:
lib/sanmar-catalog-chunked.ts

REPLACE:
app/api/admin/suppliers/sanmar/catalog-sync/route.ts
components/SanMarIntegration.tsx

SQL
---
Requires the existing migration:
supabase/migrations/20260908_sanmar_catalog_cache.sql

Run that migration once in the production Supabase project if it has
not already been run. Do not rerun the older Advanced commerce migration.

NO ENV CHANGES
--------------
No new Vercel environment variables.
No credential changes.
No package changes.
No package-lock.json.

AFTER DEPLOY
------------
1. Open Suppliers -> SanMar.
2. Confirm:
   Host: ftp.sanmar.com
   Port: 2200
   SFTP username: your SanMar customer number
   Catalog file: SanMarPDD/SanMar_SDL_N.csv
3. Click "Save + sync SanMar catalog".
4. Keep the page open while progress advances.
5. The UI should show increasing percentage and cached style count.
6. When it reaches 100%, open the SanMar catalog.

The sync is safe to rerun. Existing cached rows are retained until a
full new sync completes successfully.
