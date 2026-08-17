import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { normalizeBrandRetailProfile, supplierUnitCost } from "@/lib/brand-retail";
import { platformShopAccess } from "@/lib/shop-mode";
import BrandRetailManager from "@/components/BrandRetailManager";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";

export const dynamic = "force-dynamic";

export default async function BrandRetailPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const [{ data: profileRow }, { data: garmentRows }, { data: productRows }] = await Promise.all([
    supabase.from("brand_retail_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("brand_garments").select("source_catalog_product_id").eq("shop_id", shop.id).eq("active", true),
    supabase.from("catalog_products").select("id,name,configuration").eq("shop_id", shop.id)
  ]);

  const enabled = new Set((garmentRows || []).map((row: any) => row.source_catalog_product_id));
  let sampleCost = 5;
  let sampleName = "Sample Brand Tee";

  for (const row of productRows || []) {
    if (!enabled.has((row as any).id)) continue;
    const product: any = { ...row, configuration: normalizeConfiguration((row as any).configuration) };
    sampleCost = supplierUnitCost(product) || sampleCost;
    sampleName = (row as any).name;
    break;
  }

  return (
    <>
      <BrandWorkflowRail active="price" />
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND COMMERCE</p>
          <h1>Retail Economics</h1>
          <p>Build the Brand's cost model and target margins. This is not the Print Shop production-pricing screen.</p>
        </div>
      </header>
      <BrandRetailManager initial={normalizeBrandRetailProfile(profileRow?.configuration)} sampleGarmentCost={sampleCost} sampleGarmentName={sampleName} />
    </>
  );
}
