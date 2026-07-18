import { notFound } from "next/navigation";
import DesignerApp from "@/components/DesignerApp";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeConfiguration } from "@/lib/catalog";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import type { CatalogProduct, PublicShop, ShopSettings } from "@/lib/types";
import { normalizeShopSettings } from "@/lib/shop-settings";

 type Props = { params: Promise<{ shop: string }> };
export const dynamic = "force-dynamic";

export default async function ShopDesignerPage({ params }: Props) {
  const { shop: slug } = await params;
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase.from("shops").select("id,slug,name,settings,active").eq("slug", slug).maybeSingle();
  if (error || !data) notFound();

  const settings = normalizeShopSettings(data.settings as ShopSettings);
  if (!data.active) {
    return (
      <main className="storefront-offline-shell" style={{ "--brand": settings.brand.primaryColor, "--brand-text": settings.brand.textColor, "--brand-surface": settings.brand.surfaceColor || "#f4f4ef" } as React.CSSProperties}>
        <section className="storefront-offline-card">
          {settings.brand.logoUrl ? <img src={settings.brand.logoUrl} alt={data.name} /> : <span>{data.name.slice(0, 1).toUpperCase()}</span>}
          <p className="eyebrow">STOREFRONT PREPARATION</p>
          <h1>{data.name} is getting ready to take orders.</h1>
          <p>This custom apparel storefront has not been published yet. Please check back soon or contact the shop directly.</p>
        </section>
      </main>
    );
  }

  const [{ data: rows }, { data: pricingRow }, { count: paymentCount }] = await Promise.all([
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", data.id).eq("active", true).order("created_at", { ascending: true }),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", data.id).maybeSingle(),
    supabase.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", data.id).eq("category", "payment").eq("status", "connected")
  ]);

  const products: CatalogProduct[] = (rows || []).map((row) => ({ ...row, configuration: normalizeConfiguration(row.configuration) })).filter((item) => item.configuration.supplier?.sourceMode !== "demo");
  const shop: PublicShop = { ...data, settings, pricing: normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE), products, paymentReady: Number(paymentCount || 0) > 0 };
  return <DesignerApp shop={shop} />;
}
