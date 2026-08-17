import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { brandStorefrontMode, isBrandMode, shopAccountMode } from "@/lib/shop-mode";

export default async function BrandStorefrontSetup() {
  const { shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  if (!isBrandMode(shopAccountMode(shop.settings))) redirect("/dashboard/mode");

  const mode = brandStorefrontMode(shop.settings);
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const full = `${origin}/b/${shop.slug}`;
  const embedUrl = `${origin}/e/${shop.slug}`;

  const embed = `<iframe
  src="${embedUrl}"
  title="${shop.name} merchandise"
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

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND STOREFRONT</p>
          <h1>Publish your Brand experience</h1>
          <p>Use the full store as a standalone destination, embed the compact version into your existing website, or keep both available.</p>
        </div>
        <div className="admin-header-actions">
          <a className="secondary-button" href={`/b/${shop.slug}`} target="_blank" rel="noreferrer">Open full store</a>
          <a className="secondary-button" href={`/e/${shop.slug}`} target="_blank" rel="noreferrer">Open embed</a>
        </div>
      </header>

      <div className="brand-publish-grid">
        <section className="admin-card">
          <p className="section-kicker">FULL STOREFRONT</p>
          <h2>Standalone Brand store</h2>
          <p>Best when PrintFlow is the complete shopping destination.</p>
          <code>{full}</code>
          <a className="primary-button" href={`/b/${shop.slug}`} target="_blank" rel="noreferrer">Preview full store</a>
        </section>

        <section className="admin-card">
          <p className="section-kicker">SEAMLESS EMBED</p>
          <h2>Inside your website</h2>
          <p>No duplicate Brand header or oversized marketing area. The iframe automatically resizes as customers move through the order.</p>
          <textarea readOnly rows={10} value={embed} />
          <a className="primary-button" href={`/e/${shop.slug}`} target="_blank" rel="noreferrer">Preview embedded experience</a>
        </section>

        <aside className="admin-card">
          <span>Publishing preference</span>
          <strong>{mode === "both" ? "Full + Embed" : mode === "embed" ? "Embed" : "Full storefront"}</strong>
          <p>Change this preference from Store access. Both routes remain available so you never have to rebuild the store.</p>
        </aside>
      </div>

      <style>{`
        .brand-publish-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .brand-publish-grid>section,.brand-publish-grid>aside{padding:20px}
        .brand-publish-grid h2{margin:4px 0 6px}
        .brand-publish-grid p{color:#707070;line-height:1.5}
        .brand-publish-grid code{display:block;overflow:auto;padding:10px;border-radius:8px;background:#f5f5f1;font-size:10px;margin:12px 0}
        .brand-publish-grid textarea{width:100%;box-sizing:border-box;margin:12px 0;font-family:monospace;font-size:9px}
        .brand-publish-grid aside{grid-column:1/-1;display:grid;grid-template-columns:1fr auto;gap:4px 16px}
        .brand-publish-grid aside span{font-size:9px;color:#777;text-transform:uppercase}
        .brand-publish-grid aside strong{font-size:13px}
        .brand-publish-grid aside p{grid-column:1/-1;margin:0;font-size:10px}
        @media(max-width:760px){.brand-publish-grid{grid-template-columns:1fr}.brand-publish-grid aside{grid-column:auto}}
      `}</style>
    </>
  );
}
