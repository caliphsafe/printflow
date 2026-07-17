import Link from "next/link";
import ProductCatalogManager from "@/components/ProductCatalogManager";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import type { CatalogProduct } from "@/lib/types";
export const dynamic="force-dynamic";
export default async function ProductsPage(){const {supabase,shop}=await getAdminContext();if(!shop)return <p>No shop configured.</p>;const {data}=await supabase.from('catalog_products').select('id,slug,name,description,active,configuration').eq('shop_id',shop.id).order('created_at',{ascending:true});const products:CatalogProduct[]=(data||[]).map((row:any)=>({...row,configuration:normalizeConfiguration(row.configuration)}));return <><header className="admin-header"><div><p className="eyebrow">CATALOG</p><h1>Products & pricing</h1><p>Manage imported supplier blanks and manual products, then set the customer-facing pricing.</p></div><div className="admin-header-actions"><Link className="secondary-button" href="/dashboard/suppliers/catalog">Import supplier product</Link></div></header><ProductCatalogManager initialProducts={products}/></>}
