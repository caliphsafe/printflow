import Link from "next/link";
import { getAdminContext } from "@/lib/admin-data";

function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }
function statusLabel(status: string) { return status.replaceAll("_", " "); }

export default async function DashboardPage() {
  const { supabase, organization, shop } = await getAdminContext();
  if (!organization || !shop) return null;
  const [all, awaiting, paid, products, recent, payments, supplier, pricing] = await Promise.all([
    supabase.from("designs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("designs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "awaiting_payment"),
    supabase.from("designs").select("id,package_price,paid_amount", { count: "exact" }).eq("shop_id", shop.id).eq("status", "paid"),
    supabase.from("catalog_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("designs").select("id,display_id,customer_name,customer_email,product_name,package_quantity,package_price,status,payment_status,created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("integration_connections").select("provider,status").eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected"),
    supabase.from("supplier_connections").select("provider,status").eq("shop_id", shop.id).eq("status", "connected"),
    supabase.from("shop_pricing_profiles").select("id").eq("shop_id", shop.id).maybeSingle()
  ]);
  const paidRevenue = (paid.data || []).reduce((sum, row) => sum + Number(row.paid_amount ?? row.package_price ?? 0), 0);
  const readiness = [
    { label: "Connect live payments", done: Boolean(payments.data?.length), href: "/dashboard/integrations", copy: payments.data?.length ? payments.data.map(x=>x.provider).join(" + ") : "Required before checkout" },
    { label: "Connect a supplier", done: Boolean(supplier.data?.length), href: "/dashboard/suppliers", copy: supplier.data?.length ? "Live supplier catalog connected" : "Connect S&S or create manual products" },
    { label: "Configure production pricing", done: Boolean(pricing.data), href: "/dashboard/pricing", copy: pricing.data ? "Method pricing profile installed" : "Set cost, methods, and thresholds" },
    { label: "Publish products", done: Number(products.count || 0) > 0, href: "/dashboard/products", copy: `${products.count || 0} active product${products.count === 1 ? "" : "s"}` },
    { label: "Customize storefront", done: Boolean(shop.settings?.brand?.primaryColor && shop.settings?.customerExperience?.headline), href: "/dashboard/settings", copy: shop.active ? "Storefront is active" : "Review and activate storefront" }
  ];
  const completion = Math.round(readiness.filter(item=>item.done).length / readiness.length * 100);

  return <>
    <header className="admin-header admin-hero-header"><div><p className="eyebrow">{organization.name}</p><h1>Run the shop from here.</h1><p>Track paid orders, complete launch setup, and move every job toward production.</p></div><div className="header-actions"><Link className="ghost-button" href="/dashboard/products">Manage products</Link><a className="secondary-button" href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">Open storefront ↗</a></div></header>

    <section className="stat-grid stat-grid-expanded">
      <article className="metric-card"><div className="metric-top"><span>Paid revenue</span><span className="metric-dot green"/></div><strong>${paidRevenue.toFixed(2)}</strong><small>{paid.count || 0} paid orders</small></article>
      <article className="metric-card"><div className="metric-top"><span>Awaiting payment</span><span className="metric-dot amber"/></div><strong>{awaiting.count || 0}</strong><small>Saved orders needing checkout</small></article>
      <article className="metric-card"><div className="metric-top"><span>All orders</span><span className="metric-dot blue"/></div><strong>{all.count || 0}</strong><small>Customer submissions</small></article>
      <article className="metric-card"><div className="metric-top"><span>Launch readiness</span><span>{completion}%</span></div><strong>{readiness.filter(x=>x.done).length}/{readiness.length}</strong><small>Production essentials complete</small></article>
    </section>

    <section className="launch-readiness admin-card"><div className="card-heading"><div><p className="section-kicker">GO-LIVE CHECKLIST</p><h2>Finish the production foundation</h2></div><span className="readiness-score">{completion}% ready</span></div><div className="readiness-progress"><i style={{width:`${completion}%`}}/></div><div className="readiness-list">{readiness.map(item=><Link href={item.href} key={item.label} className={item.done?"done":""}><span>{item.done?"✓":"→"}</span><div><strong>{item.label}</strong><small>{item.copy}</small></div><b>{item.done?"Complete":"Set up"}</b></Link>)}</div></section>

    <div className="dashboard-content-grid">
      <section className="admin-card dashboard-orders-card"><div className="card-heading"><div><p className="section-kicker">RECENT ORDERS</p><h2>Latest customer activity</h2></div><Link href="/dashboard/orders">View all →</Link></div>
      {recent.data?.length ? <div className="dashboard-table"><div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Product</span><span>Status</span><span>Date</span></div>{recent.data.map(item=><Link key={item.id} href={`/dashboard/orders/${item.id}`} className="dashboard-table-row"><span><strong>{item.display_id}</strong><small>{item.package_quantity} pcs · ${Number(item.package_price).toFixed(2)}</small></span><span><strong>{item.customer_name}</strong><small>{item.customer_email}</small></span><span>{item.product_name}</span><span><em className={`status-badge status-${item.status}`}>{statusLabel(item.payment_status === "paid" ? "paid" : item.status)}</em></span><span>{formatDate(item.created_at)}</span></Link>)}</div> : <div className="dashboard-empty"><span>01</span><h3>Your first order starts at the storefront.</h3><p>Once payments and products are live, customers can build, upload, and pay in one flow.</p><a className="secondary-button" href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">Open storefront</a></div>}</section>
      <aside className="dashboard-side-stack"><section className="admin-card quick-actions-card"><p className="section-kicker">QUICK ACTIONS</p><h2>Keep moving</h2><div className="quick-action-list"><Link href="/dashboard/suppliers/catalog"><span>↗</span><div><strong>Import S&S products</strong><small>Live styles, colors, costs, and SKUs</small></div></Link><Link href="/dashboard/pricing"><span>$</span><div><strong>Tune method pricing</strong><small>Screen Print, DTF, and Embroidery</small></div></Link><Link href="/dashboard/integrations"><span>⌁</span><div><strong>Manage live checkout</strong><small>Stripe, Square, and S&S</small></div></Link><Link href="/dashboard/settings"><span>✦</span><div><strong>Polish storefront</strong><small>Brand, messaging, and trust details</small></div></Link></div></section></aside>
    </div>
  </>;
}
