import Link from "next/link";
import { getAdminContext } from "@/lib/admin-data";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function statusLabel(status: string) { return status.replaceAll("_", " "); }

export default async function DashboardPage() {
  const { supabase, organization, shop } = await getAdminContext();
  if (!organization || !shop) return <EmptySetup />;

  const [allResult, awaitingResult, paidResult, deliveredResult, productResult, recentResult] = await Promise.all([
    supabase.from("designs").select("*", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("designs").select("*", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "awaiting_payment"),
    supabase.from("designs").select("*", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "paid"),
    supabase.from("designs").select("*", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "delivered"),
    supabase.from("catalog_products").select("*", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("designs").select("id, display_id, customer_name, customer_email, package_label, package_price, status, created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(6),
  ]);

  const recent = recentResult.data || [];
  const totalValue = recent.reduce((sum, item) => sum + Number(item.package_price || 0), 0);

  return <>
    <header className="admin-header admin-hero-header">
      <div><p className="eyebrow">{organization.name}</p><h1>Good to see you.</h1><p>Here’s what’s happening across {shop.name} today.</p></div>
      <div className="header-actions"><Link className="ghost-button" href="/dashboard/products">Manage products</Link><a className="secondary-button" href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">Open designer ↗</a></div>
    </header>

    <section className="stat-grid stat-grid-expanded">
      <article className="metric-card"><div className="metric-top"><span>Total designs</span><span className="metric-icon">↗</span></div><strong>{allResult.count ?? 0}</strong><small>All customer submissions</small></article>
      <article className="metric-card"><div className="metric-top"><span>Awaiting payment</span><span className="metric-dot amber"/></div><strong>{awaitingResult.count ?? 0}</strong><small>Saved but not yet paid</small></article>
      <article className="metric-card"><div className="metric-top"><span>Paid orders</span><span className="metric-dot blue"/></div><strong>{paidResult.count ?? 0}</strong><small>Ready for production flow</small></article>
      <article className="metric-card"><div className="metric-top"><span>Active products</span><span className="metric-dot green"/></div><strong>{productResult.count ?? 0}</strong><small>Visible in the designer</small></article>
    </section>

    <div className="dashboard-content-grid">
      <section className="admin-card dashboard-orders-card">
        <div className="card-heading"><div><p className="section-kicker">RECENT ACTIVITY</p><h2>Latest submissions</h2></div><Link href="/dashboard/orders">View all orders →</Link></div>
        {recent.length ? <div className="dashboard-table">
          <div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Package</span><span>Status</span><span>Date</span></div>
          {recent.map(item => <Link key={item.id} href={`/dashboard/orders/${item.id}`} className="dashboard-table-row"><span><strong>{item.display_id}</strong></span><span><strong>{item.customer_name}</strong><small>{item.customer_email}</small></span><span>{item.package_label}</span><span><em className={`status-badge status-${item.status}`}>{statusLabel(item.status)}</em></span><span>{formatDate(item.created_at)}</span></Link>)}
        </div> : <div className="dashboard-empty"><span>01</span><h3>No customer submissions yet</h3><p>Open the public designer and submit a test design to see the full order journey appear here.</p><a className="secondary-button" href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">Test the designer</a></div>}
      </section>

      <aside className="dashboard-side-stack">
        <section className="admin-card quick-actions-card"><p className="section-kicker">QUICK ACTIONS</p><h2>Keep moving</h2><div className="quick-action-list"><Link href="/dashboard/products"><span>+</span><div><strong>Add a product</strong><small>Colors, sizes and package pricing</small></div></Link><a href={`/s/${shop.slug}`} target="_blank" rel="noreferrer"><span>↗</span><div><strong>Preview designer</strong><small>See the customer experience</small></div></a><Link href="/dashboard/integrations"><span>⌁</span><div><strong>Check integrations</strong><small>Squarespace and Google delivery</small></div></Link></div></section>
        <section className="admin-card pulse-card"><p className="section-kicker">RECENT VALUE</p><strong>${totalValue.toFixed(2)}</strong><p>Package value represented by the latest {recent.length} submissions.</p><div className="pulse-footer"><span>{deliveredResult.count ?? 0} delivered</span><span>{allResult.count ?? 0} total</span></div></section>
      </aside>
    </div>
  </>;
}

function EmptySetup(){return <section className="admin-card dashboard-empty"><span>!</span><h1>Your account needs a shop.</h1><p>Connect this login to the pilot organization before using the dashboard.</p></section>}
