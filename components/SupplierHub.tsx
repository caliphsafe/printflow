import Link from "next/link";
import SSActivewearIntegration from "@/components/SSActivewearIntegration";

type Props = { ssSupplier: any; sanmarConnection: any; productCount: number; draftCount: number };

export default function SupplierHub({ ssSupplier, productCount, draftCount }: Props) {
  const connected = ssSupplier?.status === "connected";
  return (
    <>
      <section className="supplier-stat-grid polished">
        <div className="admin-card"><span>Imported supplier products</span><strong>{productCount}</strong><small>Products using live supplier SKUs</small></div>
        <div className="admin-card"><span>Jobs in supplier cart</span><strong>{draftCount}</strong><small>Provider-specific purchases ready to review</small></div>
        <div className="admin-card"><span>Live suppliers</span><strong>{connected ? 1 : 0}</strong><small>Operational catalog connections</small></div>
      </section>

      <div className="supplier-hub-actions"><Link className="primary-button" href="/dashboard/suppliers/cart">Supplier cart</Link><Link className="secondary-button" href="/dashboard/suppliers/catalog">S&amp;S catalog</Link></div>

      <section className="supplier-equal-grid production-suppliers">
        <article className="admin-card supplier-equal-card">
          <header><div className="provider-mark">S&amp;S</div><span className={connected ? "status-pill connected" : "status-pill"}>{connected ? "Live" : "Setup needed"}</span></header>
          <div><p className="eyebrow">WHOLESALE SUPPLIER</p><h2>S&amp;S Activewear</h2><p>Live product search, account pricing, inventory, exact SKUs, product imports, and direct wholesale ordering. AlphaBroder products are handled through S&amp;S.</p></div>
          <footer><Link className="secondary-button" href="#ss-settings">{connected ? "Connection" : "Connect account"}</Link>{connected && <Link className="text-button" href="/dashboard/suppliers/catalog">Catalog →</Link>}</footer>
        </article>
        <article className="admin-card supplier-equal-card">
          <header><div className="provider-mark">＋</div><span className="status-pill connected">Available</span></header>
          <div><p className="eyebrow">OWN INVENTORY</p><h2>Manual products</h2><p>Create products from local stock or specialty suppliers. PrintFlow keeps the provider attached to the item so future purchasing stays separated by supplier.</p></div>
          <footer><Link className="secondary-button" href="/dashboard/products">Products</Link><span className="supplier-card-note">Uses the same storefront and pricing engine.</span></footer>
        </article>
        <article className="admin-card supplier-equal-card roadmap">
          <header><div className="provider-mark">SM</div><span className="status-pill">Roadmap</span></header>
          <div><p className="eyebrow">FUTURE CONNECTOR</p><h2>SanMar</h2><p>When enabled, SanMar products will enter their own supplier cart and use a separate wholesale order connection.</p></div>
          <footer><span className="supplier-card-note">Supplier-specific catalog and ordering are required before connection.</span></footer>
        </article>
      </section>

      <section id="ss-settings" className="supplier-connection-section">
        <div className="supplier-section-heading"><div><p className="eyebrow">S&amp;S CONNECTION</p><h2>Catalog and ordering controls</h2><p>Use test orders while validating the purchase flow, then switch to live wholesale ordering.</p></div><Link className="secondary-button" href="/dashboard/integrations">Integrations</Link></div>
        <SSActivewearIntegration connected={connected} accountHint={ssSupplier?.account_hint} initialSettings={ssSupplier?.settings} />
      </section>
    </>
  );
}
