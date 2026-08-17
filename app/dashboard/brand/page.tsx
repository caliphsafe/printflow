import Link from "next/link";
import { redirect } from "next/navigation";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import { normalizeBrandBusinessProfile, normalizeBrandProductConfiguration, normalizeBrandRetailProfile } from "@/lib/brand-retail";
import { brandStoreReadiness } from "@/lib/brand-readiness";
import { platformShopAccess } from "@/lib/shop-mode";
import type { BrandDesign, BrandStoreProduct } from "@/lib/brand-types";
import type { BrandMerchProduct } from "@/lib/brand-retail";
import type { CatalogProduct } from "@/lib/types";

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
    { data: garmentRows },
    { data: sourceRows },
    { data: designRows },
    { data: variants },
    { data: rules },
    { data: productRows },
    { count: collectionCount },
    { count: paymentCount }
  ] = await Promise.all([
    supabase.from("brand_business_profiles").select("id,name,settings").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("brand_retail_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("designs").select("id,display_id,customer_name,product_name,package_quantity,package_price,paid_amount,status,payment_status,created_at,design_configuration").eq("shop_id", shop.id).eq("order_source", "brand").order("created_at", { ascending: false }).limit(100),
    supabase.from("brand_garments").select("id,source_catalog_product_id,active,configuration").eq("shop_id", shop.id),
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id),
    supabase.from("brand_designs").select("*").eq("shop_id", shop.id).order("sort_order"),
    supabase.from("brand_design_variants").select("*").eq("shop_id", shop.id),
    supabase.from("brand_design_product_rules").select("brand_design_id,catalog_product_id,configuration,active").eq("shop_id", shop.id),
    supabase.from("brand_products").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }),
    supabase.from("brand_collections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected")
  ]);

  const business = normalizeBrandBusinessProfile(businessRow, shop.name);
  const retail = normalizeBrandRetailProfile(retailRow?.configuration);

  const garmentRowsBySource = new Map((garmentRows || []).map((row: any) => [row.source_catalog_product_id, row]));
  const garments: BrandStoreProduct[] = (sourceRows || [])
    .map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) } as CatalogProduct))
    .map((source) => {
      const row: any = garmentRowsBySource.get(source.id);
      if (!row) return null;
      const configured = applyBrandGarmentConfiguration(source, { ...(row.configuration || {}), active: true });
      return configured ? { ...configured, brandGarmentId: row.id, active: row.active === true } as BrandStoreProduct : null;
    })
    .filter((item): item is BrandStoreProduct => Boolean(item));

  const designs: BrandDesign[] = (designRows || []).map((design: any) => ({
    ...design,
    variants: (variants || []).filter((variant: any) => variant.brand_design_id === design.id),
    productIds: (rules || []).filter((rule: any) => rule.brand_design_id === design.id && rule.active !== false).map((rule: any) => rule.catalog_product_id),
    productRules: (rules || []).filter((rule: any) => rule.brand_design_id === design.id && rule.active !== false).map((rule: any) => ({
      productId: rule.catalog_product_id,
      placements: rule.configuration?.placements || {}
    }))
  }));

  const garmentById = new Map(garments.map((item) => [item.brandGarmentId, item]));
  const products: BrandMerchProduct[] = (productRows || []).map((row: any) => ({
    ...row,
    retail_price: Number(row.retail_price || 0),
    compare_at_price: row.compare_at_price ? Number(row.compare_at_price) : null,
    target_margin_percent: row.target_margin_percent ? Number(row.target_margin_percent) : null,
    configuration: normalizeBrandProductConfiguration(row.configuration, garmentById.get(row.brand_garment_id))
  }));

  const readiness = brandStoreReadiness({
    businessActive: business.settings.active,
    paymentReady: Number(paymentCount || 0) > 0,
    products,
    garments,
    designs
  });

  const rows = orders || [];
  const paid = rows.filter((item: any) => item.payment_status === "paid" || ["paid", "in_production", "delivered"].includes(item.status));
  const revenue = paid.reduce((sum: number, item: any) => sum + Number(item.paid_amount ?? item.package_price ?? 0), 0);
  const units = paid.reduce((sum: number, item: any) => sum + Number(item.package_quantity || 0), 0);
  const cogs = paid.reduce((sum: number, item: any) => {
    const perItem = Number(item.design_configuration?.brandEconomics?.estimatedCostPerItem || 0);
    return sum + perItem * Number(item.package_quantity || 0);
  }, 0);
  const grossProfit = Math.max(0, revenue - cogs);
  const margin = revenue > 0 ? grossProfit / revenue * 100 : 0;

  const problemProducts = readiness.productStates.filter((item) => !item.readiness.ready);

  return (
    <>
      <BrandWorkflowRail />
      <header className="admin-header brand-command-header">
        <div>
          <p className="eyebrow">BRAND / MERCH · {business.name}</p>
          <h1>Build the brand. Sell the product.</h1>
          <p>Source garments, approve designs, build finished products, merchandise the store, and track retail performance from one workflow.</p>
        </div>
        <div className="header-actions">
          <Link className="ghost-button" href="/preview/brand">Preview Store</Link>
          <Link className="secondary-button" href="/dashboard/brand-products">Build Product</Link>
        </div>
      </header>

      <section className="brand-command-status admin-card">
        <div className="command-score">
          <span>STORE READINESS</span>
          <strong>{readiness.completion}%</strong>
          <div><i style={{ width: `${readiness.completion}%` }} /></div>
          <small>{business.settings.active ? "Public storefront is Live" : "Public storefront is Draft"}</small>
        </div>

        <div className="command-next">
          <span>NEXT ACTION</span>
          {readiness.next ? (
            <>
              <strong>{readiness.next.label}</strong>
              <p>Complete this step to move the Brand storefront closer to launch-ready.</p>
              <Link href={readiness.next.href}>Continue setup →</Link>
            </>
          ) : (
            <>
              <strong>Brand store is ready</strong>
              <p>All core launch requirements are complete.</p>
              <Link href="/preview/brand">Review storefront →</Link>
            </>
          )}
        </div>

        <div className="command-product-health">
          <span>PRODUCT HEALTH</span>
          <strong>{readiness.readyProducts.length} / {products.length}</strong>
          <p>products fully ready for customers</p>
          <Link href="/dashboard/brand-products">{problemProducts.length ? `${problemProducts.length} need attention →` : "Review products →"}</Link>
        </div>
      </section>

      <section className="brand-business-metrics">
        <article><span>Gross sales</span><strong>{money(revenue)}</strong><small>{paid.length} paid Brand orders</small></article>
        <article><span>Units sold</span><strong>{units}</strong><small>{products.filter((item) => item.active).length} live products</small></article>
        <article><span>Estimated profit</span><strong>{money(grossProfit)}</strong><small>{cogs ? `${money(cogs)} estimated COGS` : "COGS records after sales"}</small></article>
        <article><span>Estimated margin</span><strong>{margin.toFixed(1)}%</strong><small>{retail.defaultTargetMarginPercent}% default target</small></article>
      </section>

      <div className="brand-command-grid">
        <section className="admin-card brand-workflow-card">
          <div className="card-heading">
            <div><p className="section-kicker">BUILD FLOW</p><h2>Your retail pipeline</h2></div>
            <span>{readiness.completion}% complete</span>
          </div>

          <div className="brand-pipeline">
            <Link href="/dashboard/brand-garments"><span>01</span><div><strong>Source</strong><small>{garments.length} garments</small></div><b>{garments.length ? "✓" : "→"}</b></Link>
            <Link href="/dashboard/designs"><span>02</span><div><strong>Create</strong><small>{designs.length} designs</small></div><b>{designs.length ? "✓" : "→"}</b></Link>
            <Link href="/dashboard/brand-products"><span>03</span><div><strong>Build</strong><small>{products.length} products</small></div><b>{readiness.publishableProducts.length ? "✓" : "→"}</b></Link>
            <Link href="/dashboard/collections"><span>04</span><div><strong>Merchandise</strong><small>{collectionCount || 0} collections</small></div><b>{collectionCount ? "✓" : "→"}</b></Link>
            <Link href="/dashboard/brand-retail"><span>05</span><div><strong>Price</strong><small>{retail.defaultTargetMarginPercent}% margin target</small></div><b>✓</b></Link>
            <Link href="/dashboard/brand-storefront"><span>06</span><div><strong>Publish</strong><small>{business.settings.active ? "Store Live" : "Store Draft"}</small></div><b>{business.settings.active ? "✓" : "→"}</b></Link>
          </div>
        </section>

        <aside className="admin-card attention-card">
          <div className="card-heading"><div><p className="section-kicker">NEEDS ATTENTION</p><h2>Product health</h2></div><Link href="/dashboard/brand-products">All products</Link></div>
          {problemProducts.length ? (
            <div className="attention-list">
              {problemProducts.slice(0, 5).map(({ product, readiness: state }) => (
                <Link href="/dashboard/brand-products" key={product.id}>
                  <span className={state.publishable ? "publishable" : "issue"}>{state.publishable ? "!" : state.issues.filter((item) => item.code !== "DRAFT").length}</span>
                  <div><strong>{product.name}</strong><small>{state.issues[0]?.label || "Ready to publish"}</small></div>
                  <b>Fix →</b>
                </Link>
              ))}
            </div>
          ) : (
            <div className="attention-empty"><span>✓</span><strong>Everything looks good.</strong><small>All current Brand products are customer-ready.</small></div>
          )}
        </aside>
      </div>

      <section className="admin-card recent-brand-sales">
        <div className="card-heading"><div><p className="section-kicker">RECENT SALES</p><h2>Customer activity</h2></div><Link href="/dashboard/brand-orders">All Brand sales</Link></div>
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
          <div className="dashboard-empty"><span>01</span><h3>No Brand sales yet</h3><p>Use Preview Store to verify the customer experience, then publish when the business is ready.</p><Link className="secondary-button" href="/preview/brand">Preview Store</Link></div>
        )}
      </section>

      <style>{`
        .brand-command-header h1{max-width:760px}.brand-command-status{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;padding:0;margin-bottom:10px;overflow:hidden}.brand-command-status>div{padding:17px;border-right:1px solid #e8e8e3}.brand-command-status>div:last-child{border-right:0}.brand-command-status span{display:block;font-size:7px;font-weight:900;letter-spacing:.11em;color:#888}.brand-command-status strong{display:block;margin:5px 0;font-size:25px}.command-score>div{height:5px;margin:8px 0;border-radius:99px;background:#ecece7;overflow:hidden}.command-score i{display:block;height:100%;background:#1f2947}.brand-command-status small,.brand-command-status p{color:#777;font-size:8px}.command-next p,.command-product-health p{margin:3px 0 7px}.brand-command-status a{font-size:8px;font-weight:850;color:#1f2947}
        .brand-business-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.brand-business-metrics article{padding:14px;border:1px solid #e1e1dc;border-radius:12px;background:#fff}.brand-business-metrics span,.brand-business-metrics small{display:block}.brand-business-metrics span{font-size:7px;text-transform:uppercase;letter-spacing:.08em;color:#888}.brand-business-metrics strong{display:block;margin:7px 0 2px;font-size:23px}.brand-business-metrics small{font-size:7px;color:#777}
        .brand-command-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(310px,.8fr);gap:10px;margin-bottom:10px}.brand-workflow-card,.attention-card,.recent-brand-sales{padding:17px}.brand-pipeline{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.brand-pipeline a{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:7px;align-items:center;padding:10px;border:1px solid #e4e4df;border-radius:9px;color:inherit;text-decoration:none}.brand-pipeline a:hover{background:#f6f6f2}.brand-pipeline a>span{display:grid;place-items:center;width:24px;height:24px;border-radius:99px;background:#1f2947;color:#fff;font-size:7px}.brand-pipeline strong,.brand-pipeline small{display:block}.brand-pipeline strong{font-size:9px}.brand-pipeline small{font-size:7px;color:#888}.brand-pipeline b{font-size:8px;color:#2d7d52}
        .attention-list{display:grid}.attention-list a{display:grid;grid-template-columns:25px minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #eee;color:inherit;text-decoration:none}.attention-list a>span{display:grid;place-items:center;width:23px;height:23px;border-radius:99px;background:#fff2df;color:#9b6323;font-size:7px;font-weight:900}.attention-list a>span.issue{background:#fdebea;color:#a63f38}.attention-list strong,.attention-list small{display:block}.attention-list strong{font-size:8px}.attention-list small{font-size:7px;color:#888}.attention-list b{font-size:7px;color:#777}.attention-empty{display:grid;justify-items:center;padding:35px 10px;text-align:center}.attention-empty>span{display:grid;place-items:center;width:34px;height:34px;border-radius:99px;background:#e9f5ed;color:#2a7a4d}.attention-empty strong{margin-top:8px}.attention-empty small{margin-top:3px;color:#888}
        .recent-brand-sales{margin-bottom:25px}
        @media(max-width:950px){.brand-command-status{grid-template-columns:1fr}.brand-command-status>div{border-right:0;border-bottom:1px solid #e8e8e3}.brand-business-metrics{grid-template-columns:1fr 1fr}.brand-command-grid{grid-template-columns:1fr}.brand-pipeline{grid-template-columns:1fr 1fr}}
        @media(max-width:560px){.brand-business-metrics,.brand-pipeline{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
