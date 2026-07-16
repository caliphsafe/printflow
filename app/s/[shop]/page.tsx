import { notFound } from "next/navigation";
import DesignerApp from "@/components/DesignerApp";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { legacyProductFromSettings, normalizeConfiguration } from "@/lib/catalog";
import type { CatalogProduct, PublicShop, ShopSettings } from "@/lib/types";

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

  const { data: rows } = await supabase
    .from("catalog_products")
    .select("id, slug, name, description, active, configuration")
    .eq("shop_id", data.id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  const settings = data.settings as ShopSettings;
  const products: CatalogProduct[] = rows?.length
    ? rows.map((row) => ({ ...row, configuration: normalizeConfiguration(row.configuration) }))
    : [legacyProductFromSettings(settings)];

  const shop: PublicShop = { ...data, settings, products };
  return <DesignerApp shop={shop} />;
}
