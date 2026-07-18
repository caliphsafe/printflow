import DesignerApp from "@/components/DesignerApp";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import { normalizeShopSettings } from "@/lib/shop-settings";
import type { CatalogProduct, PublicShop, ShopSettings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function StorefrontPreviewPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <main className="designer-empty production-empty"><span>PF</span><h1>No shop is available to preview.</h1><p>Finish onboarding, then return to Shop setup.</p></main>;

  const [{ data: rows }, { data: pricingRow }, { count: paymentCount }] = await Promise.all([
    supabase
      .from("catalog_products")
      .select("id,slug,name,description,active,configuration")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase
      .from("integration_connections")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .eq("category", "payment")
      .eq("status", "connected")
  ]);

  const products: CatalogProduct[] = (rows || [])
    .map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) }))
    .filter((item) => item.configuration.supplier?.sourceMode !== "demo");

  const previewShop: PublicShop = {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    settings: normalizeShopSettings(shop.settings as ShopSettings),
    pricing: normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE),
    products,
    paymentReady: Number(paymentCount || 0) > 0,
    previewMode: true
  };

  return <DesignerApp shop={previewShop} />;
}
