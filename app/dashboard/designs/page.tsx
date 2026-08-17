import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { isBrandMode, shopAccountMode } from "@/lib/shop-mode";

export default async function BrandDesignsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;

  const mode = shopAccountMode(shop.settings);
  if (!isBrandMode(mode)) redirect("/dashboard/mode");

  const [
    { count: designCount },
    { count: categoryCount },
    { count: productCount },
    { count: collectionCount }
  ] = await Promise.all([
    supabase.from("brand_designs").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("brand_design_categories").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("catalog_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    supabase.from("brand_collections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id)
  ]);

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND STUDIO</p>
          <h1>Design library</h1>
          <p>Predetermined artwork will live here separately from customer orders and production jobs.</p>
        </div>
        <div className="admin-header-actions">
          <Link className="secondary-button" href="/dashboard/products">Garments</Link>
          <Link className="secondary-button" href="/dashboard/mode">Store mode</Link>
        </div>
      </header>

      <section className="admin-metric-grid">
        <article className="admin-card"><span>Designs</span><strong>{designCount || 0}</strong><small>Reusable brand artwork</small></article>
        <article className="admin-card"><span>Categories</span><strong>{categoryCount || 0}</strong><small>Customer-facing groups</small></article>
        <article className="admin-card"><span>Garments</span><strong>{productCount || 0}</strong><small>Active catalog products</small></article>
        <article className="admin-card"><span>Collections</span><strong>{collectionCount || 0}</strong><small>Curated merchandise groups</small></article>
      </section>

      <section className="admin-card" style={{ marginTop: 18 }}>
        <div style={{ maxWidth: 760 }}>
          <p className="section-kicker">FOUNDATION READY</p>
          <h2 style={{ margin: "4px 0 8px" }}>Brand artwork is isolated from order artwork</h2>
          <p style={{ margin: 0, color: "#6f6f6f", lineHeight: 1.6 }}>
            Step 3 connects the Brand workspace to the verified database foundation. The next Brand Studio build adds the production-safe uploader, light and dark garment variants, categories, compatible garments, and locked print placements directly to this page.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10, marginTop: 20 }}>
          {[
            ["Artwork variants", "Separate assets for light, dark, and eventually specialty garment treatments."],
            ["Compatibility", "Assign designs only to garments and placements that can actually produce them."],
            ["Production lock", "Brand-approved position and dimensions instead of free customer dragging."]
          ].map(([title, text]) => (
            <article key={title} style={{ border: "1px solid #e5e5df", borderRadius: 12, padding: 15, background: "#fafaf7" }}>
              <strong style={{ display: "block", marginBottom: 5, fontSize: 12 }}>{title}</strong>
              <p style={{ margin: 0, color: "#757575", fontSize: 10, lineHeight: 1.5 }}>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
