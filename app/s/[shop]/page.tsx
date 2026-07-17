import { notFound } from "next/navigation";
import DesignerApp from "@/components/DesignerApp";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { legacyProductFromSettings, normalizeConfiguration } from "@/lib/catalog";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import type { CatalogProduct, PublicShop, ShopSettings } from "@/lib/types";
import { normalizeShopSettings } from "@/lib/shop-settings";

type Props = { params: Promise<{ shop: string }> };

export const dynamic = "force-dynamic";

export default async function ShopDesignerPage({ params }: Props) {
  const { shop: slug } = await params;
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("shops")
    .select("id, slug, name, settings")
    .eq("slug", slug)
    .eq("active", true)
    .single();

  if (error || !data) notFound();

  const [{ data: rows }, { data: pricingRow }] = await Promise.all([
    supabase
      .from("catalog_products")
      .select("id, slug, name, description, active, configuration")
      .eq("shop_id", data.id)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", data.id).maybeSingle()
  ]);

  const settings = normalizeShopSettings(data.settings as ShopSettings);
  const products: CatalogProduct[] = rows?.length
    ? rows.map((row) => ({ ...row, configuration: normalizeConfiguration(row.configuration) }))
    : [legacyProductFromSettings(settings)];

  const shop: PublicShop = {
    ...data,
    settings,
    pricing: normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE),
    products
  };
  return <DesignerApp shop={shop} />;
}
