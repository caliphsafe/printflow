import SupplierHub from "@/components/SupplierHub";
import { getAdminContext } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const [{ data: ssSupplier }, { data: sanmarConnection }, { data: products }, { count: draftCount }] = await Promise.all([
    supabase.from("supplier_connections").select("status,account_hint,settings,last_tested_at").eq("shop_id", shop.id).eq("provider", "ss-activewear").maybeSingle(),
    supabase.from("integration_connections").select("status,account_label,last_tested_at").eq("shop_id", shop.id).eq("provider", "sanmar").maybeSingle(),
    supabase.from("catalog_products").select("configuration").eq("shop_id", shop.id),
    supabase.from("supplier_order_drafts").select("*", { count: "exact", head: true }).eq("shop_id", shop.id).in("status", ["draft", "ready"])
  ]);
  return <>
    <header className="admin-header"><div><p className="eyebrow">SUPPLIERS</p><h1>Supplier Hub</h1><p>Every supplier uses the same product, SKU, image, and order-preparation structure.</p></div></header>
    <SupplierHub ssSupplier={ssSupplier} sanmarConnection={sanmarConnection} productCount={(products || []).filter((product: any) => product.configuration?.supplier).length} draftCount={draftCount || 0}/>
  </>;
}
