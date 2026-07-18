import Link from "next/link";
import ProductCatalogManager, { type ProductEditorTab } from "@/components/ProductCatalogManager";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import type { CatalogProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ product?: string; tab?: string }> };
const PRODUCT_TABS: ProductEditorTab[] = ["Basics", "Options", "Colors", "Print zones", "Cost basis"];

export default async function ProductsPage({ searchParams }: Props) {
  const query = await searchParams;
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const [{ data }, { data: pricingRow }] = await Promise.all([
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id).order("created_at", { ascending: true }),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle()
  ]);
  const products: CatalogProduct[] = (data || []).map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) }));
  const initialTab = PRODUCT_TABS.includes(query.tab as ProductEditorTab) ? (query.tab as ProductEditorTab) : undefined;

  return <>
    <header className="admin-header"><div><p className="eyebrow">CATALOG</p><h1>Products & production setup</h1><p>Manage manual and supplier products, real garment imagery, customer options, visual print zones, and cost basis.</p></div><div className="admin-header-actions"><Link className="secondary-button" href="/dashboard/pricing?returnTo=%2Fdashboard%2Fproducts">Global pricing</Link><Link className="secondary-button" href="/dashboard/suppliers/catalog">Import supplier product</Link></div></header>
    <ProductCatalogManager
      initialProducts={products}
      pricingProfile={normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE)}
      initialSelectedId={query.product}
      initialTab={initialTab}
    />
  </>;
}
