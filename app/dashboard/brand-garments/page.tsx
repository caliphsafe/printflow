import { redirect } from "next/navigation";
import BrandGarmentManager from "@/components/BrandGarmentManager";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { platformShopAccess } from "@/lib/shop-mode";
import type { CatalogProduct } from "@/lib/types";
import type { BrandGarmentSetup } from "@/lib/brand-commerce";

export const dynamic = "force-dynamic";

export default async function BrandGarmentsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const [{ data: rows }, { data: brandRows }] = await Promise.all([
    supabase
      .from("catalog_products")
      .select("id,slug,name,description,active,configuration")
      .eq("shop_id", shop.id)
      .order("created_at"),
    supabase
      .from("brand_garments")
      .select("source_catalog_product_id,active,configuration")
      .eq("shop_id", shop.id)
  ]);

  const products: CatalogProduct[] = (rows || [])
    .map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) }))
    .filter((item) => item.configuration.supplier?.sourceMode !== "demo");

  const initialGarments = Object.fromEntries(
    (brandRows || []).map((row: any) => [
      row.source_catalog_product_id,
      { ...(row.configuration || {}), active: row.active === true } as BrandGarmentSetup
    ])
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND / MERCH</p>
          <h1>Brand garments</h1>
          <p>Choose supplier blanks for Brand commerce, then configure Brand-only colors, sizes, methods, front/back availability, and visual print zones.</p>
        </div>
      </header>
      <BrandGarmentManager products={products} initialGarments={initialGarments} />
    </>
  );
}
