PRINTFLOW — FULL DASHBOARD → STOREFRONT PRODUCT SYNC 43 BUILD

This build replaces the earlier incomplete color fixes.

ROOT CAUSE
The product configuration had no explicit persisted default color.
Several parts of the app inferred the default from colors[0], while other parts used the selected/active color.
That allowed the catalog editor to show Black while the storefront could still use a legacy white mockupImageUrl.

WHAT THIS BUILD DOES
1. Adds configuration.defaultColorId to the shared ProductConfiguration model.
2. normalizeConfiguration() now guarantees defaultColorId always points to an active saved color.
3. normalizeConfiguration() synchronizes mockupImageUrl with the saved default color so old white/default images cannot drift from the selected color.
4. S&S imports persist defaultColorId explicitly.
5. Storefront DesignerApp opens the exact persisted default color.
6. Products → Colors gets a real "Default storefront color" control.
7. If the default color is hidden/deleted, the next active color becomes the default automatically.
8. Existing single-green-print-zone behavior remains intact.

DATABASE
No table/column migration is required because product configuration lives inside catalog_products.configuration JSON/JSONB.

BUT EXISTING DATA DOES NEED A ONE-TIME REPAIR.
Run SUPABASE-DATA-REPAIR.sql in Supabase SQL Editor after deploying this code.
It backfills defaultColorId and re-synchronizes mockupImageUrl for existing products.

FOR YOUR CURRENT BLACK HAT
After deploying + running the SQL:
- Open Products → the hat → Colors.
- Confirm Black is the only visible color.
- Set "Default storefront color" to Black.
- Confirm the Black front image field itself shows the black hat.
- Save once.
The live store will then use that exact persisted color and image.

FILES
lib/types.ts
lib/catalog.ts
components/DesignerApp.tsx
components/ProductCatalogManager.tsx
app/api/admin/suppliers/ss/import/route.ts
SUPABASE-DATA-REPAIR.sql

No package-lock.json is included.
