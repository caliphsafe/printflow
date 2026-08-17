import { redirect } from "next/navigation";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import { normalizeBrandBusinessProfile, normalizeBrandProductConfiguration } from "@/lib/brand-retail";
import { brandStoreReadiness } from "@/lib/brand-readiness";
import { platformShopAccess } from "@/lib/shop-mode";
import type { BrandDesign, BrandStoreProduct } from "@/lib/brand-types";
import type { BrandMerchProduct } from "@/lib/brand-retail";
import type { CatalogProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrandStorefrontPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const [
    { data: businessRow },
    { data: garmentRows },
    { data: sourceRows },
    { data: designRows },
    { data: variants },
    { data: rules },
    { data: productRows },
    { count: paymentCount }
  ] = await Promise.all([
    supabase.from("brand_business_profiles").select("id,name,settings").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("brand_garments").select("id,source_catalog_product_id,active,configuration").eq("shop_id", shop.id),
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id),
    supabase.from("brand_designs").select("*").eq("shop_id", shop.id),
    supabase.from("brand_design_variants").select("*").eq("shop_id", shop.id),
    supabase.from("brand_design_product_rules").select("brand_design_id,catalog_product_id,configuration,active").eq("shop_id", shop.id),
    supabase.from("brand_products").select("*").eq("shop_id", shop.id),
    supabase.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected")
  ]);

  const business = normalizeBrandBusinessProfile(businessRow, shop.name);
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

  const origin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const fullUrl = `${origin}/b/${shop.slug}`;
  const embedUrl = `${origin}/e/${shop.slug}`;
  const iframe = `<iframe
  src="${embedUrl}"
  title="${business.name} merchandise"
  style="width:100%;border:0;min-height:760px"
  loading="lazy">
</iframe>
<script>
window.addEventListener("message", function(event) {
  if (event.data && event.data.type === "printflow:resize") {
    var frame = document.querySelector('iframe[src="${embedUrl}"]');
    if (frame) frame.style.height = event.data.height + "px";
  }
});
</script>`;

  const publicReady = business.settings.active && readiness.readyProducts.length > 0 && Number(paymentCount || 0) > 0;

  return (
    <>
      <BrandWorkflowRail active="publish" />
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND STOREFRONT</p>
          <h1>Preview first. Publish when ready.</h1>
          <p>The private preview always shows your work in progress. The public Brand store opens only when you choose to publish it.</p>
        </div>
        <div className="header-actions">
          <a className="ghost-button" href="/preview/brand" target="_blank" rel="noreferrer">Preview Store ↗</a>
          <a className="secondary-button" href="/dashboard/brand-settings">Store Design</a>
        </div>
      </header>

      <section className={`store-control-hero admin-card ${publicReady ? "ready" : ""}`}>
        <div>
          <span>{business.settings.active ? "PUBLIC STORE · LIVE" : "PUBLIC STORE · DRAFT"}</span>
          <h2>{business.name}</h2>
          <p>{readiness.readyProducts.length} customer-ready product{readiness.readyProducts.length === 1 ? "" : "s"} · {paymentCount ? "Payments connected" : "Payments not connected"}</p>
        </div>
        <div className="store-score">
          <strong>{readiness.completion}%</strong>
          <span>launch readiness</span>
        </div>
        <div className="store-control-actions">
          <a className="secondary-button" href="/preview/brand" target="_blank" rel="noreferrer">Open private preview</a>
          <a className="primary-button" href="/dashboard/brand-settings">{business.settings.active ? "Manage publish status" : "Publish controls"}</a>
        </div>
      </section>

      <div className="storefront-control-grid">
        <section className="admin-card publish-readiness-card">
          <div className="card-heading"><div><p className="section-kicker">LAUNCH CHECK</p><h2>What the store needs</h2></div><strong>{readiness.steps.filter((item) => item.done).length}/{readiness.steps.length}</strong></div>
          <div className="publish-readiness-list">
            {readiness.steps.map((item, index) => (
              <a key={item.key} href={item.href} className={item.done ? "done" : ""}>
                <span>{item.done ? "✓" : String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.label}</strong><small>{item.done ? "Ready" : "Needs attention before launch"}</small></div>
                <b>{item.done ? "Ready" : "Fix →"}</b>
              </a>
            ))}
          </div>
        </section>

        <aside className="admin-card preview-card">
          <p className="section-kicker">PRIVATE PREVIEW</p>
          <h2>See the store while it is Draft.</h2>
          <p>Preview Mode includes Draft products and shows readiness labels. Checkout is disabled, so you can safely review layout, products, colors, sizes, artwork, and pricing before launch.</p>
          <a className="primary-button" href="/preview/brand" target="_blank" rel="noreferrer">Preview Brand Store ↗</a>
        </aside>
      </div>

      <div className="publish-grid">
        <section className="admin-card publish-card">
          <p className="section-kicker">FULL RETAIL STOREFRONT</p>
          <h2>Standalone store</h2>
          <p>For direct links, campaigns, social profiles, and customers shopping the Brand as a full retail experience.</p>
          <code>{fullUrl}</code>
          <a className="secondary-button" href={`/b/${shop.slug}`} target="_blank" rel="noreferrer">Open public route ↗</a>
        </section>

        <section className="admin-card publish-card">
          <p className="section-kicker">WEBSITE EMBED</p>
          <h2>Compact merchandise experience</h2>
          <p>Use the smaller storefront inside an existing Brand website without duplicating the Brand's navigation or hero.</p>
          <textarea readOnly rows={9} value={iframe} />
          <a className="secondary-button" href={`/e/${shop.slug}`} target="_blank" rel="noreferrer">Open embed route ↗</a>
        </section>
      </div>

      <style>{`
        .store-control-hero{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:24px;align-items:center;padding:18px;margin-bottom:10px;border-left:4px solid #b98d45}.store-control-hero.ready{border-left-color:#2e8557}.store-control-hero>div:first-child>span{font-size:7px;font-weight:900;letter-spacing:.1em;color:#777}.store-control-hero h2{margin:4px 0}.store-control-hero p{margin:0;color:#777;font-size:8px}.store-score{text-align:center}.store-score strong,.store-score span{display:block}.store-score strong{font-size:27px}.store-score span{font-size:7px;color:#777}.store-control-actions{display:flex;gap:6px}
        .storefront-control-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:10px;margin-bottom:10px}.publish-readiness-card,.preview-card,.publish-card{padding:17px}.publish-readiness-list{display:grid}.publish-readiness-list a{display:grid;grid-template-columns:27px minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #eee;color:inherit;text-decoration:none}.publish-readiness-list a>span{display:grid;place-items:center;width:24px;height:24px;border-radius:99px;background:#f1f1ec;font-size:7px;font-weight:900}.publish-readiness-list a.done>span{background:#e8f4ec;color:#2b7a4d}.publish-readiness-list strong,.publish-readiness-list small{display:block}.publish-readiness-list strong{font-size:9px}.publish-readiness-list small{font-size:7px;color:#888}.publish-readiness-list b{font-size:7px;color:#777}
        .preview-card{display:flex;flex-direction:column;align-items:flex-start;background:#1f2947;color:#fff}.preview-card h2{margin:4px 0 6px;font-size:22px}.preview-card>p:not(.section-kicker){color:#ced3e3;font-size:8px;line-height:1.55}.preview-card .primary-button{margin-top:auto;background:#fff;color:#1f2947}.preview-card .section-kicker{color:#aeb7d3}
        .publish-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.publish-card h2{margin:4px 0 5px}.publish-card>p:not(.section-kicker){color:#777;font-size:8px;line-height:1.5}.publish-card code{display:block;overflow:auto;margin:11px 0;padding:9px;border-radius:8px;background:#f4f4f0;font-size:8px}.publish-card textarea{width:100%;box-sizing:border-box;margin:9px 0;font-family:monospace;font-size:7px}
        @media(max-width:900px){.store-control-hero{grid-template-columns:1fr auto}.store-control-actions{grid-column:1/-1}.storefront-control-grid,.publish-grid{grid-template-columns:1fr}}
        @media(max-width:560px){.store-control-hero{grid-template-columns:1fr}.store-score{text-align:left}.store-control-actions{display:grid}.publish-grid{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
