import Link from "next/link";
import AdvancedAdminProductManager from "@/components/AdvancedAdminProductManager";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

export const dynamic = "force-dynamic";

export default async function AdvancedProducts() {
  const { db, shop } = await getAdvancedAdminContext();
  const { data: products } = await db.from("catalog_products").select("*").eq("shop_id", shop.id).order("created_at");
  const items = products || [];

  return <>
    <header className="ae-page-head">
      <div className="copy"><p className="ae-kicker">PRODUCTS</p><h1>Only sell what you actually want.</h1><p>Keep the customer catalog simple. Advanced controls the friendly product name, live/draft status, minimum quantity and allowed decoration methods.</p></div>
      <div className="ae-page-actions"><Link className="ae-button primary" href="/advanced-admin/sanmar">Import from SanMar</Link></div>
    </header>

    {items.length ? <section className="ae-product-grid">{items.map((product: any) => <AdvancedAdminProductManager key={product.id} product={product} />)}</section>
    : <section className="ae-card ae-empty"><span>01</span><h3>No custom products yet</h3><p>Connect SanMar and import the exact T-shirt, polo and hat Advanced wants customers to order.</p><Link className="ae-button primary" href="/advanced-admin/settings">Connect SanMar</Link></section>}
  </>;
}
