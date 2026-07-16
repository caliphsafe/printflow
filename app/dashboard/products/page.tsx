import { getAdminContext } from "@/lib/admin-data";
import type { ShopSettings } from "@/lib/types";

export default async function ProductsPage() {
  const { shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;

  const settings = shop.settings as ShopSettings;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">CATALOG</p>
          <h1>Products & pricing</h1>
          <p>The pilot reads this catalog from the shop configuration. A self-service editor can replace this view later without changing the designer.</p>
        </div>
      </header>

      <section className="admin-card">
        <div className="card-heading"><h2>{settings.product.name}</h2><span className="status-pill">Active</span></div>
        <p>{settings.product.description || "Custom apparel product"}</p>
        <div className="mini-grid">
          <article><span>Colors</span><strong>{settings.colors.length}</strong></article>
          <article><span>Sizes</span><strong>{settings.sizes.length}</strong></article>
          <article><span>Packages</span><strong>{settings.packages.length}</strong></article>
        </div>
      </section>

      <section className="admin-card admin-stack">
        <h2>Packages</h2>
        <div className="order-list">
          {settings.packages.map((item) => (
            <div className="order-row" key={item.id}>
              <div><strong>{item.label}</strong><span>{item.quantity} total garments</span></div>
              <div><strong>${Number(item.price).toFixed(2)}</strong><span>{item.checkoutUrl}</span></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
