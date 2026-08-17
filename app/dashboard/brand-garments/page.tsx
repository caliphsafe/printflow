import { redirect } from "next/navigation";
import BrandGarmentManager from "@/components/BrandGarmentManager";
import BrandGarmentSourcePicker from "@/components/BrandGarmentSourcePicker";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { platformShopAccess } from "@/lib/shop-mode";
import type { CatalogProduct } from "@/lib/types";
import type { BrandGarmentSetup } from "@/lib/brand-commerce";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";

export const dynamic = "force-dynamic";

export default async function BrandGarmentsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const [{ data: productRows }, { data: brandRows }] = await Promise.all([
    supabase
      .from("catalog_products")
      .select("id,slug,name,description,active,configuration")
      .eq("shop_id", shop.id)
      .order("created_at"),
    supabase
      .from("brand_garments")
      .select("id,source_catalog_product_id,active,configuration")
      .eq("shop_id", shop.id)
      .order("created_at")
  ]);

  const sourceProducts: CatalogProduct[] = (productRows || [])
    .map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) }))
    .filter((item) => item.configuration.supplier?.sourceMode !== "demo");

  const selectedIds = new Set((brandRows || []).map((row: any) => row.source_catalog_product_id));
  const brandProducts = sourceProducts.filter((item) => selectedIds.has(item.id));
  const availableSourceProducts = sourceProducts.filter((item) => !selectedIds.has(item.id));

  const initialGarments = Object.fromEntries(
    (brandRows || []).map((row: any) => [
      row.source_catalog_product_id,
      { ...(row.configuration || {}), active: row.active === true } as BrandGarmentSetup
    ])
  );

  return (
    <>
      <BrandWorkflowRail active="source" />
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND MERCHANDISE</p>
          <h1>Garments</h1>
          <p>Build the Brand's garment library from connected suppliers. Brand choices are independent from the Print Shop catalog.</p>
        </div>
        <BrandGarmentSourcePicker products={availableSourceProducts} />
      </header>

      {brandProducts.length
        ? <BrandGarmentManager products={brandProducts} initialGarments={initialGarments} />
        : (
          <section className="admin-card brand-first-garment">
            <span>01</span>
            <h2>Choose the Brand's first garment</h2>
            <p>The supplier/source library is shared infrastructure. Once a blank is added here, its Brand colors, sizes, print zones, and availability are managed independently.</p>
            <BrandGarmentSourcePicker products={availableSourceProducts} />
            <style>{`.brand-first-garment{display:grid;justify-items:center;max-width:720px;margin:45px auto;padding:40px;text-align:center}.brand-first-garment>span{display:grid;place-items:center;width:40px;height:40px;border-radius:99px;background:#171717;color:#fff;font-size:10px;font-weight:800}.brand-first-garment h2{margin:14px 0 5px}.brand-first-garment p{max-width:540px;margin:0 0 18px;color:#777;line-height:1.55}`}</style>
          </section>
        )}
    </>
  );
}
