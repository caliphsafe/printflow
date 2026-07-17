import Link from "next/link";
import ProductCatalogManager from "@/components/ProductCatalogManager";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import type { CatalogProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const [{ data }, { data: pricingRow }] = await Promise.all([
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id).order("created_at", { ascending: true }),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle()
  ]);
  const products: CatalogProduct[] = (data || []).map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) }));
  return <>
    <header className="admin-header"><div><p className="eyebrow">CATALOG</p><h1>Products & pricing</h1><p>Manage manual and supplier products, visual print zones, per-shirt components, and product-level pricing overrides.</p></div><div className="admin-header-actions"><Link className="secondary-button" href="/dashboard/pricing">Global pricing</Link><Link className="secondary-button" href="/dashboard/suppliers/catalog">Import supplier product</Link></div></header>
    <ProductCatalogManager initialProducts={products} pricingProfile={normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE)} />
  </>;
}
