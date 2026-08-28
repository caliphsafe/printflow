import Link from "next/link";
import SanMarCatalogImporter from "@/components/SanMarCatalogImporter";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

export const dynamic = "force-dynamic";

export default async function AdvancedSanMarCatalog() {
  const { db, shop } = await getAdvancedAdminContext();
  const { data: connection } = await db.from("supplier_connections").select("status,account_hint").eq("shop_id",shop.id).eq("provider","sanmar").maybeSingle();

  return <>
    <header className="ae-page-head">
      <div className="copy"><p className="ae-kicker">SANMAR PRODUCTS</p><h1>Pick the three garments customers should see.</h1><p>Search by the SanMar style number, preview live supplier data, then import it with a simple customer-facing name.</p></div>
      <div className="ae-page-actions"><Link className="ae-button" href="/advanced-admin/products">← Products</Link></div>
    </header>
    {connection?.status==="connected" ? <SanMarCatalogImporter/> : <section className="ae-card ae-empty"><span>!</span><h3>Connect SanMar first</h3><p>Go to Settings and connect Advanced's SanMar account.</p><Link className="ae-button primary" href="/advanced-admin/settings">Open Settings</Link></section>}
  </>;
}
