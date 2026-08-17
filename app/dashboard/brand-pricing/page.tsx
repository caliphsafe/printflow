import { redirect } from "next/navigation";
import BrandPricingManager from "@/components/BrandPricingManager";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import { platformShopAccess } from "@/lib/shop-mode";

export const dynamic = "force-dynamic";

export default async function BrandPricingPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const [{ data: pricingRow }, { data: garmentRows }, { data: productRows }] = await Promise.all([
    supabase.from("brand_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("brand_garments").select("source_catalog_product_id").eq("shop_id", shop.id).eq("active", true),
    supabase.from("catalog_products").select("id,name,configuration").eq("shop_id", shop.id).limit(100)
  ]);

  const enabled = new Set((garmentRows || []).map((row: any) => row.source_catalog_product_id));
  let sampleCost = 0;
  let sampleLabel = "Brand garment";

  for (const row of productRows || []) {
    if (!enabled.has((row as any).id)) continue;
    const configuration = normalizeConfiguration((row as any).configuration);
    const variant = configuration.supplier?.variants.find((item) => item.active !== false && Number(item.customerPrice) > 0);
    const cost = Number(variant?.customerPrice || configuration.manualUnitCost || 0);
    if (cost > 0) {
      sampleCost = cost;
      sampleLabel = (row as any).name;
      break;
    }
  }

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND / MERCH</p>
          <h1>Brand pricing</h1>
          <p>Set Brand-only retail economics and production rates. Changes here never modify Print Shop pricing.</p>
        </div>
      </header>
      <BrandPricingManager
        initialPricing={normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE)}
        sampleCost={sampleCost}
        sampleLabel={sampleLabel}
      />
    </>
  );
}
