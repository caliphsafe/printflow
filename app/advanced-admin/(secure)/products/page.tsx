import Link from "next/link";
import AdvancedAdminProductManager from "@/components/AdvancedAdminProductManager";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

export const dynamic = "force-dynamic";

export default async function AdvancedProducts() {
  const { db, shop } = await getAdvancedAdminContext();

  const { data: products } = await db
    .from("catalog_products")
    .select("*")
    .eq("shop_id", shop.id)
    .order("created_at");

  // This page is the CUSTOM APPAREL catalog manager.
  // Advanced only wants SanMar-imported garments here. School uniforms are
  // intentionally managed separately under Advanced Admin → School Uniforms.
  const items = (products || []).filter(
    (product: any) =>
      product.configuration?.supplier?.provider === "sanmar" &&
      product.configuration?.supplier?.sourceMode !== "demo"
  );

  return <>
    <header className="ae-page-head">
      <div className="copy">
        <p className="ae-kicker">CUSTOM APPAREL PRODUCTS</p>
        <h1>Only sell what you actually want.</h1>
        <p>
          This section contains only products imported from SanMar for the
          custom-order experience. Espirito Santo products are managed
          separately under School Uniforms.
        </p>
      </div>
      <div className="ae-page-actions">
        <Link className="ae-button primary" href="/advanced-admin/sanmar">
          Import from SanMar
        </Link>
      </div>
    </header>

    {items.length
      ? <section className="ae-product-grid">
          {items.map((product: any) => (
            <AdvancedAdminProductManager key={product.id} product={product} />
          ))}
        </section>
      : <section className="ae-card ae-empty">
          <span>01</span>
          <h3>No SanMar custom products yet</h3>
          <p>
            Your SanMar connection is separate from the Espirito Santo
            storefront. Once SanMar product/media access is available, import
            the T-shirts, polos and hats you want customers to order.
          </p>
          <Link className="ae-button primary" href="/advanced-admin/sanmar">
            Browse SanMar
          </Link>
        </section>}
  </>;
}
