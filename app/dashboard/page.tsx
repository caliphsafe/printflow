import Link from "next/link";
import SupplierInsights from "@/components/SupplierInsights";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";

function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }
function statusLabel(status: string) { return status.replaceAll("_", " "); }

export default async function DashboardPage() {
  const { supabase, organization, shop } = await getAdminContext();
  if (!organization || !shop) return null;
  const [all, awaiting, paid, products, recent, payments, supplier, pricingRow, subscription, supplierCart, importedProducts] = await Promise.all([
    supabase.from("designs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("designs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "awaiting_payment"),
    supabase.from("designs").select("id,package_price,paid_amount", { count: "exact" }).eq("shop_id", shop.id).eq("status", "paid"),
    supabase.from("catalog_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("designs").select("id,display_id,customer_name,customer_email,product_name,package_quantity,package_price,status,payment_status,created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("integration_connections").select("provider,status").eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected"),
    supabase.from("supplier_connections").select("provider,status").eq("shop_id", shop.id).eq("status", "connected"),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("subscription_accounts").select("plan_code,status,current_period_end").eq("organization_id", organization.id).maybeSingle(),
    supabase.from("supplier_order_drafts").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).in("status", ["cart", "ready"]),
    supabase.from("catalog_products").select("id,configuration").eq("shop_id", shop.id).eq("active", true)
  ]);
  const pricing = normalizePricingProfile(pricingRow.data?.configuration || DEFAULT_PRICING_PROFILE);
  const paidRevenue = (paid.data || []).reduce((sum, row) => sum + Number(row.paid_amount ?? row.package_price ?? 0), 0);
  const importedCount = (importedProducts.data || []).filter((row: any) => row.configuration?.supplier?.sourceMode === "live").length;
  const methodCards = [
    { name: pricing.screenPrinting.label, active: pricing.screenPrinting.active, detail: `${pricing.screenPrinting.quantityDiscounts.length} quantity levels · up to ${pricing.screenPrinting.maximumColors} colors` },
    { name: pricing.dtf.label, active: pricing.dtf.active, detail: `$${pricing.dtf.ratePerSquareInch.toFixed(3)} / sq. in. · ${pricing.dtf.quantityDiscounts.length} quantity levels` },
    { name: pricing.embroidery.label, active: pricing.embroidery.active, detail: `$${pricing.embroidery.ratePerThousandStitches.toFixed(2)} / 1k stitches · ${pricing.embroidery.quantityDiscounts.length} quantity levels` }
  ];
  const readiness = [
    { label: "Choose an account plan", done: ["active", "pilot"].includes(subscription.data?.status || "") || (subscription.data?.status === "trialing" && Boolean(subscription.data?.current_period_end)), href: "/dashboard/account", copy: subscription.data ? `${subscription.data.plan_code} · ${subscription.data.status}` : "Start the free trial and choose a plan" },
    { label: "Connect live payments", done: Boolean(payments.data?.length), href: "/dashboard/integrations", copy: payments.data?.length ? payments.data.map(x=>x.provider).join(" + ") : "Required before checkout" },
    { label: "Connect a supplier", done: Boolean(supplier.data?.length), href: "/dashboard/suppliers", copy: supplier.data?.length ? "Live supplier catalog connected" : "Connect S&S or create manual products" },
    { label: "Configure production pricing", done: Boolean(pricingRow.data), href: "/dashboard/pricing", copy: pricingRow.data ? "Production methods and quantity levels are ready" : "Set cost, methods, and quantity levels" },
    { label: "Publish products", done: Number(products.count || 0) > 0, href: "/dashboard/products", copy: `${products.count || 0} active product${products.count === 1 ? "" : "s"}` },
    { label: "Customize storefront", done: Boolean(shop.settings?.brand?.primaryColor && shop.settings?.customerExperience?.headline), href: "/dashboard/settings", copy: shop.active ? "Storefront is active" : "Review and activate storefront" }
  ];
  const completion = Math.round(readiness.filter(item=>item.done).length / readiness.length * 100);

  return <>
    <header className="admin-header admin-hero-header"><div><p className="eyebrow">{organization.name}</p><h1>Run the shop with confidence.</h1><p>See what is selling, watch supplier opportunities, review pricing, and move every job toward production.</p></div><div className="header-actions"><Link className="ghost-button" href="/dashboard/products">Products</Link><a className="secondary-button" href={shop.active ? `/s/${shop.slug}` : "/preview/storefront"} target="_blank" rel="noreferrer">{shop.active ? "Storefront ↗" : "Preview storefront ↗"}</a></div></header>

    <section className="stat-grid stat-grid-expanded">
      <article className="metric-card"><div className="metric-top"><span>Paid revenue</span><span className="metric-dot green"/></div><strong>${paidRevenue.toFixed(2)}</strong><small>{paid.count || 0} paid orders</small></article>
      <article className="metric-card"><div className="metric-top"><span>Awaiting payment</span><span className="metric-dot amber"/></div><strong>{awaiting.count || 0}</strong><small>Saved orders needing checkout</small></article>
      <article className="metric-card"><div className="metric-top"><span>Supplier products</span><span className="metric-dot blue"/></div><strong>{importedCount}</strong><small>Live imported products</small></article>
      <article className="metric-card"><div className="metric-top"><span>Launch readiness</span><span>{completion}%</span></div><strong>{readiness.filter(x=>x.done).length}/{readiness.length}</strong><small>Production essentials complete</small></article>
    </section>

    <section className="launch-readiness admin-card"><div className="card-heading"><div><p className="section-kicker">GO-LIVE CHECKLIST</p><h2>Finish the production foundation</h2></div><span className="readiness-score">{completion}% ready</span></div><div className="readiness-progress"><i style={{width:`${completion}%`}}/></div><div className="readiness-list">{readiness.map(item=><Link href={item.href} key={item.label} className={item.done?"done":""}><span>{item.done?"✓":"→"}</span><div><strong>{item.label}</strong><small>{item.copy}</small></div><b>{item.done?"Complete":"Set up"}</b></Link>)}</div></section>

    <section className="overview-business-grid">
      <article className="admin-card pricing-pulse-card"><div className="card-heading"><div><p className="section-kicker">PRICING MODEL</p><h2>How the shop is quoting</h2></div><Link href="/dashboard/pricing">Pricing</Link></div><div className="pricing-pulse-foundation"><div><small>Garment markup</small><strong>{pricing.garmentMarkupPercent}%</strong></div><div><small>Order setup</small><strong>${pricing.orderSetupFee.amount.toFixed(2)}</strong></div><div><small>Design service</small><strong>${pricing.designOptimizationFee.amount.toFixed(2)}</strong></div></div><div className="pricing-method-summary">{methodCards.map(method=><div key={method.name} className={method.active?"active":""}><span>{method.active?"●":"○"}</span><div><strong>{method.name}</strong><small>{method.active?method.detail:"Not offered"}</small></div></div>)}</div></article>
      <article className="admin-card sourcing-pulse-card"><div className="card-heading"><div><p className="section-kicker">SOURCING</p><h2>Purchase readiness</h2></div><Link href="/dashboard/suppliers/cart">Supplier cart</Link></div><div className="sourcing-pulse-figure"><strong>{supplierCart.count || 0}</strong><span>job{supplierCart.count === 1 ? "" : "s"} waiting for blank purchasing</span></div><div className="sourcing-pulse-actions"><Link href="/dashboard/suppliers/catalog"><b>Browse supplier catalog</b><small>Import live products, costs, images, and SKUs.</small></Link><Link href="/dashboard/orders"><b>Review customer orders</b><small>Confirm payment and prepare supplier purchases.</small></Link></div></article>
    </section>

    <SupplierInsights />

    <div className="dashboard-content-grid overview-activity-grid">
      <section className="admin-card dashboard-orders-card"><div className="card-heading"><div><p className="section-kicker">RECENT ORDERS</p><h2>Latest customer activity</h2></div><Link href="/dashboard/orders">All orders</Link></div>
      {recent.data?.length ? <div className="dashboard-table"><div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Product</span><span>Status</span><span>Date</span></div>{recent.data.map(item=><Link key={item.id} href={`/dashboard/orders/${item.id}`} className="dashboard-table-row"><span><strong>{item.display_id}</strong><small>{item.package_quantity} pcs · ${Number(item.package_price).toFixed(2)}</small></span><span><strong>{item.customer_name}</strong><small>{item.customer_email}</small></span><span>{item.product_name}</span><span><em className={`status-badge status-${item.status}`}>{statusLabel(item.payment_status === "paid" ? "paid" : item.status)}</em></span><span>{formatDate(item.created_at)}</span></Link>)}</div> : <div className="dashboard-empty"><span>01</span><h3>Your first order starts at the storefront.</h3><p>Once payments and products are live, customers can build, upload, and pay in one flow.</p><a className="secondary-button" href={shop.active ? `/s/${shop.slug}` : "/preview/storefront"} target="_blank" rel="noreferrer">{shop.active ? "Storefront" : "Preview storefront"}</a></div>}</section>
      <aside className="dashboard-side-stack"><section className="admin-card quick-actions-card"><p className="section-kicker">QUICK ACTIONS</p><h2>Keep moving</h2><div className="quick-action-list"><Link href="/dashboard/suppliers/cart"><span>▣</span><div><strong>Supplier cart</strong><small>{supplierCart.count || 0} job{supplierCart.count === 1 ? "" : "s"} ready for purchasing</small></div></Link><Link href="/dashboard/suppliers/catalog"><span>↗</span><div><strong>S&amp;S catalog</strong><small>Live styles, colors, costs, and SKUs</small></div></Link><Link href="/dashboard/pricing"><span>$</span><div><strong>Production pricing</strong><small>Screen Print, DTF, and Embroidery</small></div></Link><Link href="/dashboard/integrations"><span>⌁</span><div><strong>Connected services</strong><small>Stripe, Square, and S&amp;S</small></div></Link><Link href="/dashboard/settings"><span>✦</span><div><strong>Storefront setup</strong><small>Brand, messaging, and launch status</small></div></Link><Link href="/dashboard/account"><span>◎</span><div><strong>Account & billing</strong><small>Profile, plan, and subscription</small></div></Link></div></section></aside>
    </div>
  </>;
}
