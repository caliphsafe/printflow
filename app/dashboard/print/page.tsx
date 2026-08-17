import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import { platformShopAccess } from "@/lib/shop-mode";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

export const dynamic = "force-dynamic";

export default async function PrintOverviewPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).customPrint) redirect("/dashboard/mode");

  const [
    { data: orders },
    { count: productCount },
    { data: pricingRow },
    { count: supplierCount },
    { count: paymentCount }
  ] = await Promise.all([
    supabase.from("designs").select("id,display_id,customer_name,product_name,package_quantity,package_price,paid_amount,status,payment_status,created_at").eq("shop_id", shop.id).eq("order_source", "custom").order("created_at", { ascending: false }).limit(100),
    supabase.from("catalog_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("supplier_connections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "connected"),
    supabase.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected")
  ]);

  const pricing = normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE);
  const rows = orders || [];
  const paid = rows.filter((item: any) => item.payment_status === "paid" || item.status === "paid" || item.status === "in_production" || item.status === "delivered");
  const revenue = paid.reduce((sum: number, item: any) => sum + Number(item.paid_amount ?? item.package_price ?? 0), 0);
  const awaiting = rows.filter((item: any) => item.status === "awaiting_payment").length;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">PRINT SHOP · {shop.name}</p>
          <h1>Run the production business.</h1>
          <p>Custom orders, production pricing, supplier blanks, and customer-submitted artwork live here.</p>
        </div>
        <div className="header-actions">
          <Link className="ghost-button" href="/dashboard/products">Products</Link>
          <a className="secondary-button" href={shop.active ? `/s/${shop.slug}` : "/preview/storefront"} target="_blank" rel="noreferrer">Print storefront ↗</a>
        </div>
      </header>

      <section className="print-overview-metrics">
        <article><span>Paid revenue</span><strong>{money(revenue)}</strong><small>{paid.length} paid custom orders</small></article>
        <article><span>Awaiting payment</span><strong>{awaiting}</strong><small>Custom orders needing checkout</small></article>
        <article><span>Active products</span><strong>{productCount || 0}</strong><small>Print Shop catalog</small></article>
        <article><span>Garment markup</span><strong>{pricing.garmentMarkupPercent}%</strong><small>Production pricing model</small></article>
      </section>

      <div className="print-overview-grid">
        <section className="admin-card print-readiness">
          <div className="card-heading"><div><p className="section-kicker">PRINT OPERATIONS</p><h2>Production foundation</h2></div></div>
          <div className="print-readiness-list">
            <Link href="/dashboard/products" className={productCount ? "done" : ""}><span>{productCount ? "✓" : "1"}</span><div><strong>Print products</strong><small>{productCount || 0} active products</small></div></Link>
            <Link href="/dashboard/pricing" className={pricingRow ? "done" : ""}><span>{pricingRow ? "✓" : "2"}</span><div><strong>Production pricing</strong><small>Screen Print, DTF, Embroidery, setup and quantity rules</small></div></Link>
            <Link href="/dashboard/suppliers" className={supplierCount ? "done" : ""}><span>{supplierCount ? "✓" : "3"}</span><div><strong>Supplier connection</strong><small>{supplierCount ? "Connected" : "Connect S&S or another supplier"}</small></div></Link>
            <Link href="/dashboard/integrations" className={paymentCount ? "done" : ""}><span>{paymentCount ? "✓" : "4"}</span><div><strong>Payments</strong><small>{paymentCount ? "Checkout connected" : "Connect Stripe or Square"}</small></div></Link>
          </div>
        </section>

        <aside className="admin-card print-model">
          <p className="section-kicker">PRODUCTION PRICING</p>
          <h2>How the Print Shop quotes</h2>
          <div><span>Screen Print</span><b>{pricing.screenPrinting.active ? "Active" : "Off"}</b></div>
          <div><span>DTF</span><b>{pricing.dtf.active ? "Active" : "Off"}</b></div>
          <div><span>Embroidery</span><b>{pricing.embroidery.active ? "Active" : "Off"}</b></div>
          <p>This pricing belongs only to customer-submitted custom production. Brand retail prices and margin live in the Brand / Merch workspace.</p>
          <Link href="/dashboard/pricing">Production pricing →</Link>
        </aside>
      </div>

      <section className="admin-card recent-print-orders">
        <div className="card-heading"><div><p className="section-kicker">RECENT PRINT ORDERS</p><h2>Custom production activity</h2></div><Link href="/dashboard/orders">All Print orders</Link></div>
        {rows.length ? (
          <div className="dashboard-table">
            <div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Product</span><span>Value</span><span>Status</span><span>Date</span></div>
            {rows.slice(0, 6).map((item: any) => (
              <Link key={item.id} href={`/dashboard/orders/${item.id}`} className="dashboard-table-row">
                <span><strong>{item.display_id}</strong><small>{item.package_quantity} pcs</small></span>
                <span>{item.customer_name}</span>
                <span>{item.product_name}</span>
                <span>{money(Number(item.paid_amount ?? item.package_price ?? 0))}</span>
                <span><em className={`status-badge status-${item.status}`}>{String(item.payment_status === "paid" ? "paid" : item.status).replaceAll("_", " ")}</em></span>
                <span>{date(item.created_at)}</span>
              </Link>
            ))}
          </div>
        ) : <div className="dashboard-empty"><span>01</span><h3>No custom Print orders yet</h3><p>The Brand business has its own Sales screen; only customer-upload custom production appears here.</p></div>}
      </section>

      <style>{`
        .print-overview-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}.print-overview-metrics article{padding:16px;border:1px solid #e1e1dc;border-radius:13px;background:#fff}.print-overview-metrics span,.print-overview-metrics small{display:block}.print-overview-metrics span{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#777}.print-overview-metrics strong{display:block;margin:8px 0 3px;font-size:24px}.print-overview-metrics small{font-size:8px;color:#777}
        .print-overview-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);gap:12px;margin-bottom:12px}.print-readiness,.print-model,.recent-print-orders{padding:18px}.print-readiness-list{display:grid}.print-readiness-list a{display:grid;grid-template-columns:25px minmax(0,1fr);gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #eee;color:inherit;text-decoration:none}.print-readiness-list a>span{display:grid;place-items:center;width:22px;height:22px;border-radius:99px;background:#f0f0ec;font-size:8px}.print-readiness-list a.done>span{background:#eaf6ee;color:#27764a}.print-readiness-list strong,.print-readiness-list small{display:block}.print-readiness-list strong{font-size:9px}.print-readiness-list small{font-size:7px;color:#777}
        .print-model h2{margin:3px 0 12px}.print-model>div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:9px}.print-model>p:not(.section-kicker){color:#777;font-size:8px;line-height:1.5}.print-model>a{font-size:8px}.recent-print-orders{margin-bottom:24px}
        @media(max-width:900px){.print-overview-metrics{grid-template-columns:1fr 1fr}.print-overview-grid{grid-template-columns:1fr}}
        @media(max-width:560px){.print-overview-metrics{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
