import Link from "next/link";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

function cash(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0); }
function pretty(value: string) { return String(value || "").replaceAll("_", " "); }

export const dynamic = "force-dynamic";

export default async function AdvancedOrdersPage({ searchParams }: { searchParams: Promise<{ type?: string; status?: string }> }) {
  const filters = await searchParams;
  const { db, shop } = await getAdvancedAdminContext();
  let query = db.from("orders").select("id,display_id,channel,status,payment_status,total,customer_name_snapshot,customer_email_snapshot,created_at,metadata").eq("shop_id", shop.id).order("created_at", { ascending: false });

  if (filters.type === "custom") query = query.eq("channel", "custom");
  if (filters.type === "school") query = query.eq("channel", "storefront");
  if (filters.status) query = query.eq("status", filters.status);

  const { data: orders } = await query;
  const items = orders || [];
  const active = (type?: string, status?: string) => filters.type === type && filters.status === status;

  return <>
    <header className="ae-page-head">
      <div className="copy"><p className="ae-kicker">ORDERS</p><h1>Everything in one queue.</h1><p>Custom apparel and Espirito Santo orders use the same payment and production workflow.</p></div>
    </header>

    <nav className="ae-filters">
      <Link className={!filters.type && !filters.status ? "active" : ""} href="/advanced-admin/orders">All</Link>
      <Link className={filters.type === "custom" ? "active" : ""} href="/advanced-admin/orders?type=custom">Custom Apparel</Link>
      <Link className={filters.type === "school" ? "active" : ""} href="/advanced-admin/orders?type=school">Espirito Santo</Link>
      <Link className={filters.status === "artwork_review" ? "active" : ""} href="/advanced-admin/orders?status=artwork_review">Artwork Review</Link>
      <Link className={filters.status === "ready_for_production" ? "active" : ""} href="/advanced-admin/orders?status=ready_for_production">Ready</Link>
      <Link className={filters.status === "in_production" ? "active" : ""} href="/advanced-admin/orders?status=in_production">In Production</Link>
      <Link className={filters.status === "completed" ? "active" : ""} href="/advanced-admin/orders?status=completed">Completed</Link>
    </nav>

    <section className="ae-card">
      <div className="ae-card-head"><div><h2>Orders</h2><small>{items.length} matching records</small></div></div>
      {items.length ? <div className="ae-table">
        <div className="ae-table-head"><span>Order</span><span>Customer</span><span>Type</span><span>Value</span><span>Status</span><span>Date</span></div>
        {items.map((o: any) => <Link href={`/advanced-admin/orders/${o.id}`} className="ae-table-row" key={o.id}>
          <span><strong>{o.display_id}</strong><small>{o.payment_status}</small></span>
          <span><strong>{o.customer_name_snapshot || "Customer"}</strong><small>{o.customer_email_snapshot}</small></span>
          <span>{o.channel === "storefront" ? "Espirito Santo" : "Custom Apparel"}</span>
          <span>{cash(Number(o.total || 0))}</span>
          <span><em className={`ae-status ${o.status}`}>{pretty(o.status)}</em></span>
          <span>{new Date(o.created_at).toLocaleDateString()}</span>
        </Link>)}
      </div> : <div className="ae-empty"><span>00</span><h3>No matching orders</h3><p>Try another filter.</p></div>}
    </section>
  </>;
}
