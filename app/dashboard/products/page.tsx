import ProductCatalogManager from "@/components/ProductCatalogManager";
import SSCatalogImporter from "@/components/SSCatalogImporter";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import type { CatalogProduct } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function ProductsPage() {
 const { supabase, shop } = await getAdminContext(); if (!shop) return <p>No shop configured.</p>;
 const [{data},{data:supplier}] = await Promise.all([
  supabase.from("catalog_products").select("id, slug, name, description, active, configuration").eq("shop_id",shop.id).order("created_at",{ascending:true}),
  supabase.from("supplier_connections").select("status").eq("shop_id",shop.id).eq("provider","ss-activewear").maybeSingle()
 ]);
 const products: CatalogProduct[]=(data||[]).map((row:any)=>({...row,configuration:normalizeConfiguration(row.configuration)}));
 return <><header className="admin-header"><div><p className="eyebrow">CATALOG</p><h1>Products & pricing</h1><p>Import real wholesale blanks or create products manually, then control customer pricing and availability.</p></div><div className="admin-header-actions"><SSCatalogImporter connected={supplier?.status==='connected'}/></div></header><ProductCatalogManager initialProducts={products}/></>;
}
