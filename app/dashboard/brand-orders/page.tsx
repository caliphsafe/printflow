import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { platformShopAccess } from "@/lib/shop-mode";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export const dynamic = "force-dynamic";

export default async function BrandOrdersPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const { data } = await supabase
    .from("designs")
    .select("id,display_id,customer_name,customer_email,product_name,package_label,package_quantity,package_price,paid_amount,status,payment_status,created_at")
    .eq("shop_id", shop.id)
    .eq("order_source", "brand")
    .order("created_at", { ascending: false });

  const items = data || [];
  const paid = items.filter((item: any) => item.payment_status === "paid" || item.status === "paid" || item.status === "in_production" || item.status === "delivered");
  const revenue = paid.reduce((sum: number, item: any) => sum + Number(item.paid_amount ?? item.package_price ?? 0), 0);

  return (
    <>
      <BrandWorkflowRail active="sell" />
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND SALES</p>
          <h1>Orders</h1>
          <p>Brand retail orders only. Custom Print submissions stay in the Print Shop workspace.</p>
        </div>
        <a className="secondary-button" href={`/b/${shop.slug}`} target="_blank" rel="noreferrer">Brand store ↗</a>
      </header>

      <section className="order-summary-strip">
        <div><strong>{items.length}</strong><span>Total Brand orders</span></div>
        <div><strong>{paid.length}</strong><span>Paid</span></div>
        <div><strong>${revenue.toFixed(2)}</strong><span>Paid revenue</span></div>
        <div><strong>{items.reduce((sum: number, item: any) => sum + Number(item.package_quantity || 0), 0)}</strong><span>Units ordered</span></div>
      </section>

      <section className="admin-card orders-page-card">
        <div className="card-heading"><div><p className="section-kicker">BRAND ORDERS</p><h2>Retail sales</h2></div><span className="table-count">{items.length} records</span></div>
        {items.length ? (
          <div className="dashboard-table order-full-table">
            <div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Product</span><span>Units</span><span>Value</span><span>Status</span><span>Date</span></div>
            {items.map((item: any) => (
              <Link key={item.id} href={`/dashboard/orders/${item.id}`} className="dashboard-table-row">
                <span><strong>{item.display_id}</strong><small>Brand / Merch</small></span>
                <span><strong>{item.customer_name}</strong><small>{item.customer_email}</small></span>
                <span>{item.product_name || item.package_label}</span>
                <span>{item.package_quantity}</span>
                <span>${Number(item.paid_amount ?? item.package_price ?? 0).toFixed(2)}</span>
                <span><em className={`status-badge status-${item.status}`}>{String(item.payment_status === "paid" ? "paid" : item.status).replaceAll("_", " ")}</em></span>
                <span>{formatDate(item.created_at)}</span>
              </Link>
            ))}
          </div>
        ) : <div className="dashboard-empty"><span>01</span><h3>No Brand orders yet</h3><p>Brand retail sales will appear here without mixing into this workspace's view with Custom Print submissions.</p></div>}
      </section>
    </>
  );
}
