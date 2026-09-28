import SupplierCatalogBrowser from "@/components/SupplierCatalogBrowser";
import { getAdminContext } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function SupplierCatalogPage() {
  const { supabase, shop } = await getAdminContext();

  if (!shop) return <p>No shop configured.</p>;

  const { data: connections } = await supabase
    .from("supplier_connections")
    .select("provider,status,account_hint,last_tested_at")
    .eq("shop_id", shop.id)
    .in("provider", ["ss-activewear", "sanmar"]);

  const byProvider = new Map<string, any>(
    (connections || []).map((connection) => [connection.provider, connection])
  );

  const suppliers = {
    ss: {
      connected: byProvider.get("ss-activewear")?.status === "connected",
      accountHint: byProvider.get("ss-activewear")?.account_hint || null,
      lastTestedAt: byProvider.get("ss-activewear")?.last_tested_at || null
    },
    sanmar: {
      connected: byProvider.get("sanmar")?.status === "connected",
      accountHint: byProvider.get("sanmar")?.account_hint || null,
      lastTestedAt: byProvider.get("sanmar")?.last_tested_at || null
    }
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">SUPPLIERS / CATALOG</p>
          <h1>Source supplier products</h1>
          <p>
            Browse and import products from every connected supplier. SanMar
            now exposes the full cached catalog, including apparel, outerwear,
            bags, accessories and every other product category in the feed.
          </p>
        </div>
      </header>

      <SupplierCatalogBrowser suppliers={suppliers} />
    </>
  );
}
