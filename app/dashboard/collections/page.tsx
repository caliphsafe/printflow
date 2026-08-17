import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { isBrandMode, shopAccountMode } from "@/lib/shop-mode";

export default async function BrandCollectionsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;

  if (!isBrandMode(shopAccountMode(shop.settings))) redirect("/dashboard/mode");

  const { data: collections } = await supabase
    .from("brand_collections")
    .select("id,name,slug,description,active,featured,sort_order,created_at")
    .eq("shop_id", shop.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND STUDIO</p>
          <h1>Collections</h1>
          <p>Organize designs and garments into intentional drops without creating duplicate product records.</p>
        </div>
        <div className="admin-header-actions">
          <Link className="secondary-button" href="/dashboard/designs">Designs</Link>
          <Link className="secondary-button" href="/dashboard/products">Garments</Link>
        </div>
      </header>

      <section className="admin-card">
        {collections?.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {collections.map((collection) => (
              <article key={collection.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "center", padding: 15, border: "1px solid #e6e6e0", borderRadius: 12 }}>
                <div>
                  <strong style={{ display: "block", marginBottom: 3 }}>{collection.name}</strong>
                  <small style={{ color: "#747474" }}>{collection.description || "No description yet."}</small>
                </div>
                <span style={{ fontSize: 10, fontWeight: 750, color: collection.active ? "#227247" : "#777" }}>
                  {collection.active ? "Active" : "Hidden"}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ maxWidth: 680, padding: "18px 4px" }}>
            <p className="section-kicker">NO COLLECTIONS YET</p>
            <h2 style={{ margin: "4px 0 8px" }}>Collections come after your design library</h2>
            <p style={{ margin: "0 0 16px", color: "#707070", lineHeight: 1.55 }}>
              Your database is ready for collections, but PrintFlow will not ask you to curate a drop before reusable designs exist. Build the design library first, then collections can combine approved artwork and existing supplier garments.
            </p>
            <Link className="secondary-button" href="/dashboard/designs">Design library</Link>
          </div>
        )}
      </section>
    </>
  );
}
