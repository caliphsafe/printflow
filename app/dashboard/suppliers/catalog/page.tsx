import PageBackLink from "@/components/PageBackLink";
import SupplierCatalogBrowser from "@/components/SupplierCatalogBrowser";
import { getAdminContext } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function SupplierCatalogPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const { data: connection } = await supabase
    .from("supplier_connections")
    .select("status,account_hint,last_tested_at")
    .eq("shop_id", shop.id)
    .eq("provider", "ss-activewear")
    .maybeSingle();
  const connected = connection?.status === "connected";
  return <>
    <header className="admin-header">
      <div>
        <p className="eyebrow">SUPPLIERS / CATALOG</p>
        <h1>Source blank garments</h1>
        <p>Search the live S&amp;S Activewear catalog, choose exact colors and sizes, then import the supplier SKUs, images, pricing, and inventory into PrintFlow.</p>
      </div>
    </header>
    <SupplierCatalogBrowser connected={connected} accountHint={connection?.account_hint || null} />
  </>;
}
