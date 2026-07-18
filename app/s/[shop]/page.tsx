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
  const { data, error } = await supabase.from("shops").select("id,slug,name,settings").eq("slug", slug).eq("active", true).single();
  if (error || !data) notFound();
  const [{ data: rows }, { data: pricingRow }, { count: paymentCount }] = await Promise.all([
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", data.id).eq("active", true).order("created_at", { ascending: true }),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", data.id).maybeSingle(),
    supabase.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", data.id).eq("category", "payment").eq("status", "connected")
  ]);
  const settings = normalizeShopSettings(data.settings as ShopSettings);
  const products: CatalogProduct[] = (rows || []).map((row) => ({ ...row, configuration: normalizeConfiguration(row.configuration) })).filter((item) => item.configuration.supplier?.sourceMode !== "demo");
  const shop: PublicShop = { ...data, settings, pricing: normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE), products, paymentReady: Number(paymentCount || 0) > 0 };
  return <DesignerApp shop={shop} />;
}
