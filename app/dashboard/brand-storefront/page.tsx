import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeBrandBusinessProfile } from "@/lib/brand-retail";
import { platformShopAccess } from "@/lib/shop-mode";

export const dynamic = "force-dynamic";

export default async function BrandStorefrontPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const [{ data: businessRow }, { count: productCount }, { count: paymentCount }] = await Promise.all([
    supabase.from("brand_business_profiles").select("id,name,settings").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("brand_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected")
  ]);

  const business = normalizeBrandBusinessProfile(businessRow, shop.name);
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

  const ready = business.settings.active && Number(productCount || 0) > 0 && Number(paymentCount || 0) > 0;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND STOREFRONT</p>
          <h1>Sell the merchandise.</h1>
          <p>The Brand storefront publishes finished retail products. It is separate from the custom-order Print storefront.</p>
        </div>
        <a className="secondary-button" href="/dashboard/brand-settings">Brand settings</a>
      </header>

      <section className={`brand-store-status admin-card ${ready ? "ready" : ""}`}>
        <div>
          <span>{ready ? "READY" : "SETUP NEEDED"}</span>
          <h2>{business.name}</h2>
          <p>{business.settings.active ? "Brand store published" : "Brand store is draft"} · {productCount || 0} live product{productCount === 1 ? "" : "s"} · {paymentCount ? "Payments connected" : "Payments not connected"}</p>
        </div>
        <strong>{ready ? "Brand store can accept orders" : "Finish the missing items below"}</strong>
      </section>

      <div className="publish-grid">
        <section className="admin-card publish-card">
          <p className="section-kicker">FULL RETAIL STOREFRONT</p>
          <h2>Standalone Brand store</h2>
          <p>A complete retail merchandise page for links, campaigns, social profiles, and direct shopping.</p>
          <code>{fullUrl}</code>
          <a className="primary-button" href={`/b/${shop.slug}`} target="_blank" rel="noreferrer">Open full Brand store ↗</a>
        </section>

        <section className="admin-card publish-card">
          <p className="section-kicker">SEAMLESS RETAIL EMBED</p>
          <h2>Inside an existing Brand website</h2>
          <p>The compact version removes duplicate Brand navigation and resizes automatically inside the host page.</p>
          <textarea readOnly rows={10} value={iframe} />
          <a className="primary-button" href={`/e/${shop.slug}`} target="_blank" rel="noreferrer">Open embed preview ↗</a>
        </section>
      </div>

      <section className="brand-publish-readiness">
        <a className={business.settings.active ? "done" : ""} href="/dashboard/brand-settings"><span>{business.settings.active ? "✓" : "1"}</span><div><strong>Publish Brand store</strong><small>Brand identity, colors, messaging, and independent Live/Draft status</small></div></a>
        <a className={Number(productCount || 0) > 0 ? "done" : ""} href="/dashboard/brand-products"><span>{productCount ? "✓" : "2"}</span><div><strong>Live merchandise</strong><small>Create and publish at least one finished Brand Product</small></div></a>
        <a className={Number(paymentCount || 0) > 0 ? "done" : ""} href="/dashboard/integrations"><span>{paymentCount ? "✓" : "3"}</span><div><strong>Checkout</strong><small>Connect Stripe or Square to accept retail payments</small></div></a>
      </section>

      <style>{`
        .brand-store-status{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:17px;margin-bottom:12px;border-left:4px solid #c09b42}.brand-store-status.ready{border-left-color:#2f925a}.brand-store-status span{font-size:7px;font-weight:850;letter-spacing:.1em;color:#777}.brand-store-status h2{margin:3px 0}.brand-store-status p{margin:0;color:#777;font-size:8px}.brand-store-status>strong{font-size:9px}
        .publish-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.publish-card{padding:18px}.publish-card h2{margin:3px 0 5px}.publish-card>p:not(.section-kicker){color:#777;font-size:9px;line-height:1.5}.publish-card code{display:block;overflow:auto;margin:12px 0;padding:10px;border-radius:8px;background:#f5f5f1;font-size:9px}.publish-card textarea{width:100%;box-sizing:border-box;margin:10px 0;font-family:monospace;font-size:8px}
        .brand-publish-readiness{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px}.brand-publish-readiness a{display:grid;grid-template-columns:26px minmax(0,1fr);gap:8px;align-items:center;padding:11px;border:1px solid #ddd;border-radius:10px;background:#fff;color:inherit;text-decoration:none}.brand-publish-readiness a>span{display:grid;place-items:center;width:24px;height:24px;border-radius:99px;background:#f1f1ed;font-size:8px;font-weight:800}.brand-publish-readiness a.done>span{background:#e9f5ed;color:#27774a}.brand-publish-readiness strong,.brand-publish-readiness small{display:block}.brand-publish-readiness strong{font-size:9px}.brand-publish-readiness small{font-size:7px;color:#777}
        @media(max-width:760px){.publish-grid,.brand-publish-readiness{grid-template-columns:1fr}.brand-store-status{display:grid}}
      `}</style>
    </>
  );
}
