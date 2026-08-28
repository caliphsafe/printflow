import Link from "next/link";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

function cash(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}
function pretty(value: string) {
  return String(value || "").replaceAll("_", " ");
}

export const dynamic = "force-dynamic";

export default async function AdvancedDashboard() {
  const { db, shop } = await getAdvancedAdminContext();
  const start = new Date();
  start.setDate(start.getDate() - 7);

  const [{ data: orders }, { data: products }, { data: connections }, { data: suppliers }] = await Promise.all([
    db.from("orders").select("id,display_id,channel,status,payment_status,total,customer_name_snapshot,customer_email_snapshot,created_at,paid_at,metadata").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(100),
    db.from("catalog_products").select("id,active").eq("shop_id", shop.id),
    db.from("integration_connections").select("provider,status,account_label,configuration").eq("shop_id", shop.id),
    db.from("supplier_connections").select("provider,status,account_hint").eq("shop_id", shop.id)
  ]);

  const all = orders || [];
  const newOrders = all.filter((o: any) => ["paid", "draft", "awaiting_payment"].includes(o.status)).length;
  const artwork = all.filter((o: any) => ["artwork_review", "awaiting_approval"].includes(o.status)).length;
  const ready = all.filter((o: any) => ["approved", "ready_for_production"].includes(o.status)).length;
  const school = all.filter((o: any) => o.channel === "storefront").length;
  const paidWeek = all.filter((o: any) => o.payment_status === "paid" && o.paid_at && new Date(o.paid_at) >= start).reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
  const square = (connections || []).find((x: any) => x.provider === "square");
  const sanmar = (suppliers || []).find((x: any) => x.provider === "sanmar");
  const recent = all.slice(0, 6);

  return <>
    <header className="ae-page-head">
      <div className="copy">
        <p className="ae-kicker">GOOD MORNING · ADVANCED</p>
        <h1>What needs attention?</h1>
        <p>A simple view of incoming jobs, production readiness, payments and the systems powering customer orders.</p>
      </div>
      <div className="ae-page-actions">
        <a className="ae-button" href="https://adv-emb-sp.vercel.app/order/" target="_blank" rel="noreferrer">Customer order page ↗</a>
        <Link className="ae-button primary" href="/advanced-admin/orders">View all orders</Link>
      </div>
    </header>

    <section className="ae-stat-grid">
      <article className="ae-stat"><span>New / unprocessed</span><strong>{newOrders}</strong><small>Paid or recently submitted jobs</small></article>
      <article className="ae-stat"><span>Artwork attention</span><strong>{artwork}</strong><small>Review or approval needed</small></article>
      <article className="ae-stat"><span>Ready for production</span><strong>{ready}</strong><small>Approved jobs waiting to run</small></article>
      <article className="ae-stat"><span>Paid this week</span><strong>{cash(paidWeek)}</strong><small>Square-confirmed order value</small></article>
    </section>

    <section className="ae-grid-2">
      <article className="ae-card">
        <div className="ae-card-head"><div><p className="ae-kicker">RECENT ORDERS</p><h2>Production queue</h2></div><Link className="ae-text-link" href="/advanced-admin/orders">See all →</Link></div>
        {recent.length ? <div className="ae-table">
          <div className="ae-table-head"><span>Order</span><span>Customer</span><span>Type</span><span>Value</span><span>Status</span><span>Date</span></div>
          {recent.map((o: any) => <Link href={`/advanced-admin/orders/${o.id}`} className="ae-table-row" key={o.id}>
            <span><strong>{o.display_id}</strong><small>{o.payment_status}</small></span>
            <span><strong>{o.customer_name_snapshot || "Customer"}</strong><small>{o.customer_email_snapshot}</small></span>
            <span>{o.channel === "storefront" ? "Espirito Santo" : "Custom"}</span>
            <span>{cash(Number(o.total || 0))}</span>
            <span><em className={`ae-status ${o.status}`}>{pretty(o.status)}</em></span>
            <span>{new Date(o.created_at).toLocaleDateString()}</span>
          </Link>)}
        </div> : <div className="ae-empty"><span>01</span><h3>No orders yet</h3><p>New Advanced customer orders will appear here.</p></div>}
      </article>

      <aside className="ae-card">
        <div className="ae-card-head"><div><p className="ae-kicker">SHOP HEALTH</p><h2>Connections</h2></div></div>
        <div className="ae-history">
          <article><span style={{background: square?.status === "connected" ? "#20835a" : "#d83d49"}}/><div><b>Square · {square?.status === "connected" ? "Connected" : "Needs setup"}</b><small>{square?.account_label || "Payment account not connected"}</small></div></article>
          <article><span style={{background: sanmar?.status === "connected" ? "#20835a" : "#d83d49"}}/><div><b>SanMar · {sanmar?.status === "connected" ? "Connected" : "Needs setup"}</b><small>{sanmar?.account_hint || "Supplier account not connected"}</small></div></article>
          <article><span/><div><b>{(products || []).filter((p: any) => p.active).length} live products</b><small>{(products || []).length} products in the Advanced catalog</small></div></article>
          <article><span/><div><b>{school} school orders</b><small>Espirito Santo orders stay in the same production queue</small></div></article>
        </div>
        <div style={{marginTop:16}}><Link className="ae-button primary" href="/advanced-admin/settings">Manage connections</Link></div>
      </aside>
    </section>
  </>;
}
