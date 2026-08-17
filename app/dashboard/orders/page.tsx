import Link from "next/link";
import { getAdminContext } from "@/lib/admin-data";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default async function OrdersPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;

  const { data: orders } = await supabase
    .from("designs")
    .select("id,display_id,customer_name,customer_email,package_label,package_quantity,package_price,shirt_color_name,status,payment_status,created_at")
    .eq("shop_id", shop.id)
    .eq("order_source", "custom")
    .order("created_at", { ascending: false });

  const items = orders || [];

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">PRINT SHOP ORDERS</p>
          <h1>Custom production</h1>
          <p>Customer-uploaded Print Shop orders only. Brand retail sales are managed in Brand / Merch → Sales.</p>
        </div>
        <a className="secondary-button" href="/preview/storefront" target="_blank" rel="noreferrer">Preview Print order flow ↗</a>
      </header>

      <section className="order-summary-strip">
        <div><strong>{items.length}</strong><span>Total Print orders</span></div>
        <div><strong>{items.filter((item: any) => item.status === "awaiting_payment").length}</strong><span>Awaiting payment</span></div>
        <div><strong>{items.filter((item: any) => item.payment_status === "paid" || item.status === "paid").length}</strong><span>Paid</span></div>
        <div><strong>{items.reduce((sum: number, item: any) => sum + Number(item.package_quantity || 0), 0)}</strong><span>Pieces ordered</span></div>
      </section>

      <section className="admin-card orders-page-card">
        <div className="card-heading"><div><p className="section-kicker">PRINT ORDERS</p><h2>Customer designs</h2></div><span className="table-count">{items.length} records</span></div>
        {items.length ? (
          <div className="dashboard-table order-full-table">
            <div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Product</span><span>Value</span><span>Status</span><span>Date</span></div>
            {items.map((item: any) => (
              <Link key={item.id} href={`/dashboard/orders/${item.id}`} className="dashboard-table-row">
                <span><strong>{item.display_id}</strong><small>{item.shirt_color_name}</small></span>
                <span><strong>{item.customer_name}</strong><small>{item.customer_email}</small></span>
                <span>{item.package_label}</span>
                <span>${Number(item.package_price || 0).toFixed(2)}</span>
                <span><em className={`status-badge status-${item.status}`}>{String(item.payment_status === "paid" ? "paid" : item.status).replaceAll("_", " ")}</em></span>
                <span>{formatDate(item.created_at)}</span>
              </Link>
            ))}
          </div>
        ) : <div className="dashboard-empty"><span>01</span><h3>No Print orders yet</h3><p>The first custom production order will appear here with artwork, quantities, and payment status.</p></div>}
      </section>
    </>
  );
}
