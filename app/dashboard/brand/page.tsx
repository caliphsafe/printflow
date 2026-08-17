import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeBrandBusinessProfile, normalizeBrandRetailProfile } from "@/lib/brand-retail";
import { platformShopAccess } from "@/lib/shop-mode";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

export const dynamic = "force-dynamic";

export default async function BrandOverviewPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const [
    { data: businessRow },
    { data: retailRow },
    { data: orders },
    { count: garmentCount },
    { count: designCount },
    { count: productCount },
    { count: liveProductCount },
    { count: collectionCount },
    { count: payments }
  ] = await Promise.all([
    supabase.from("brand_business_profiles").select("id,name,settings").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("brand_retail_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("designs").select("id,display_id,customer_name,product_name,package_quantity,package_price,paid_amount,status,payment_status,created_at,design_configuration,brand_design_snapshot").eq("shop_id", shop.id).eq("order_source", "brand").order("created_at", { ascending: false }).limit(100),
    supabase.from("brand_garments").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("brand_designs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("brand_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("brand_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("brand_collections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected")
  ]);

  const business = normalizeBrandBusinessProfile(businessRow, shop.name);
  const retail = normalizeBrandRetailProfile(retailRow?.configuration);
  const rows = orders || [];
  const paid = rows.filter((item: any) => item.payment_status === "paid" || item.status === "paid" || item.status === "in_production" || item.status === "delivered");
  const revenue = paid.reduce((sum: number, item: any) => sum + Number(item.paid_amount ?? item.package_price ?? 0), 0);
  const units = paid.reduce((sum: number, item: any) => sum + Number(item.package_quantity || 0), 0);
  const cogs = paid.reduce((sum: number, item: any) => {
    const perItem = Number(item.design_configuration?.brandEconomics?.estimatedCostPerItem || 0);
    return sum + perItem * Number(item.package_quantity || 0);
  }, 0);
  const grossProfit = Math.max(0, revenue - cogs);
  const margin = revenue > 0 ? grossProfit / revenue * 100 : 0;
  const averageOrder = paid.length ? revenue / paid.length : 0;

  const readiness = [
    { label: "Brand identity", done: Boolean(businessRow?.name), href: "/dashboard/brand-settings", copy: business.name },
    { label: "Retail Economics", done: Boolean(retailRow?.configuration), href: "/dashboard/brand-retail", copy: `${retail.defaultTargetMarginPercent}% default target margin` },
    { label: "Brand garments", done: Number(garmentCount || 0) > 0, href: "/dashboard/brand-garments", copy: `${garmentCount || 0} Brand garment${garmentCount === 1 ? "" : "s"}` },
    { label: "Approved designs", done: Number(designCount || 0) > 0, href: "/dashboard/designs", copy: `${designCount || 0} approved design${designCount === 1 ? "" : "s"}` },
    { label: "Retail products", done: Number(liveProductCount || 0) > 0, href: "/dashboard/brand-products", copy: `${liveProductCount || 0} live of ${productCount || 0} total` },
    { label: "Payments", done: Number(payments || 0) > 0, href: "/dashboard/integrations", copy: payments ? "Checkout connected" : "Connect Stripe or Square" }
  ];
  const completion = Math.round(readiness.filter((item) => item.done).length / readiness.length * 100);

  return (
    <>
      <header className="admin-header brand-overview-hero">
        <div>
          <p className="eyebrow">BRAND / MERCH · {business.name}</p>
          <h1>Run the retail business.</h1>
          <p>Track sales, margin, merchandise, launches, and customer demand without mixing Brand decisions into the Print Shop.</p>
        </div>
        <div className="header-actions">
          <Link className="ghost-button" href="/dashboard/brand-products">Products</Link>
          <a className="secondary-button" href={`/b/${shop.slug}`} target="_blank" rel="noreferrer">Brand store ↗</a>
        </div>
      </header>

      <section className="brand-metric-grid">
        <article><span>Gross sales</span><strong>{money(revenue)}</strong><small>{paid.length} paid Brand orders</small></article>
        <article><span>Units sold</span><strong>{units}</strong><small>{averageOrder ? `${money(averageOrder)} average order` : "No paid sales yet"}</small></article>
        <article><span>Estimated gross profit</span><strong>{money(grossProfit)}</strong><small>{cogs ? `${money(cogs)} estimated COGS` : "COGS appears after Brand sales"}</small></article>
        <article><span>Estimated margin</span><strong>{margin.toFixed(1)}%</strong><small>{retail.defaultTargetMarginPercent}% default target</small></article>
      </section>

      <div className="brand-overview-grid">
        <section className="admin-card brand-readiness">
          <div className="card-heading">
            <div><p className="section-kicker">BRAND LAUNCH</p><h2>Retail readiness</h2></div>
            <strong>{completion}%</strong>
          </div>
          <div className="brand-progress"><i style={{ width: `${completion}%` }} /></div>
          <div className="brand-readiness-list">
            {readiness.map((item) => (
              <Link key={item.label} href={item.href} className={item.done ? "done" : ""}>
                <span>{item.done ? "✓" : "→"}</span>
                <div><strong>{item.label}</strong><small>{item.copy}</small></div>
                <b>{item.done ? "Ready" : "Set up"}</b>
              </Link>
            ))}
          </div>
        </section>

        <aside className="admin-card brand-merch-pulse">
          <p className="section-kicker">MERCHANDISE</p>
          <h2>Brand inventory structure</h2>
          <div className="merch-counts">
            <Link href="/dashboard/brand-garments"><strong>{garmentCount || 0}</strong><span>Garments</span></Link>
            <Link href="/dashboard/designs"><strong>{designCount || 0}</strong><span>Designs</span></Link>
            <Link href="/dashboard/brand-products"><strong>{productCount || 0}</strong><span>Products</span></Link>
            <Link href="/dashboard/collections"><strong>{collectionCount || 0}</strong><span>Collections</span></Link>
          </div>
          <p>A garment is a Brand-approved blank. A design is approved artwork. A product combines them into something customers can actually buy.</p>
        </aside>
      </div>

      <section className="admin-card brand-recent-sales">
        <div className="card-heading">
          <div><p className="section-kicker">RECENT SALES</p><h2>Brand customer activity</h2></div>
          <Link href="/dashboard/brand-orders">All Brand sales</Link>
        </div>
        {rows.length ? (
          <div className="dashboard-table">
            <div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Product</span><span>Units</span><span>Value</span><span>Date</span></div>
            {rows.slice(0, 6).map((item: any) => (
              <Link key={item.id} href={`/dashboard/orders/${item.id}`} className="dashboard-table-row">
                <span><strong>{item.display_id}</strong><small>{item.payment_status || item.status}</small></span>
                <span>{item.customer_name}</span>
                <span>{item.product_name}</span>
                <span>{item.package_quantity}</span>
                <span>{money(Number(item.paid_amount ?? item.package_price ?? 0))}</span>
                <span>{date(item.created_at)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty"><span>01</span><h3>No Brand sales yet</h3><p>Publish a finished Brand Product and open the Brand storefront to start selling.</p><Link className="secondary-button" href="/dashboard/brand-products">Build a product</Link></div>
        )}
      </section>

      <style>{`
        .brand-overview-hero h1{max-width:700px}.brand-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.brand-metric-grid article{padding:16px;border:1px solid #e1e1dc;border-radius:13px;background:#fff}.brand-metric-grid span,.brand-metric-grid small{display:block}.brand-metric-grid span{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#777}.brand-metric-grid strong{display:block;margin:8px 0 3px;font-size:25px}.brand-metric-grid small{font-size:8px;color:#777}
        .brand-overview-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);gap:12px;margin-bottom:12px}.brand-readiness,.brand-merch-pulse,.brand-recent-sales{padding:18px}.brand-progress{height:5px;border-radius:99px;background:#eee;overflow:hidden}.brand-progress i{display:block;height:100%;background:#171717}.brand-readiness-list{display:grid;margin-top:10px}.brand-readiness-list a{display:grid;grid-template-columns:25px minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #eee;color:inherit;text-decoration:none}.brand-readiness-list a>span{display:grid;place-items:center;width:22px;height:22px;border-radius:99px;background:#f0f0ec;font-size:8px}.brand-readiness-list a.done>span{background:#eaf6ee;color:#27764a}.brand-readiness-list strong,.brand-readiness-list small{display:block}.brand-readiness-list strong{font-size:9px}.brand-readiness-list small{font-size:7px;color:#777}.brand-readiness-list b{font-size:7px;color:#777}
        .brand-merch-pulse>h2{margin:3px 0 12px}.merch-counts{display:grid;grid-template-columns:1fr 1fr;gap:6px}.merch-counts a{padding:12px;border-radius:9px;background:#f5f5f1;color:inherit;text-decoration:none}.merch-counts strong,.merch-counts span{display:block}.merch-counts strong{font-size:21px}.merch-counts span{font-size:8px;color:#777}.brand-merch-pulse>p:not(.section-kicker){margin:12px 0 0;color:#777;font-size:8px;line-height:1.5}.brand-recent-sales{margin-bottom:25px}
        @media(max-width:900px){.brand-metric-grid{grid-template-columns:1fr 1fr}.brand-overview-grid{grid-template-columns:1fr}}
        @media(max-width:560px){.brand-metric-grid{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
