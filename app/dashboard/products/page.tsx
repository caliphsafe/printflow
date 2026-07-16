import ProductCatalogManager from "@/components/ProductCatalogManager";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import type { CatalogProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;

  const { data } = await supabase
    .from("catalog_products")
    .select("id, slug, name, description, active, configuration")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: true });

  const products: CatalogProduct[] = (data || []).map((row: { id: string; slug: string; name: string; description: string | null; active: boolean; configuration: unknown }) => ({
    ...row,
    configuration: normalizeConfiguration(row.configuration)
  }));

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">CATALOG</p>
          <h1>Products & pricing</h1>
          <p>Create the products customers can customize, then control their colors, sizes, quantities, prices and checkout destinations.</p>
        </div>
      </header>
      <ProductCatalogManager initialProducts={products} />
    </>
  );
}
