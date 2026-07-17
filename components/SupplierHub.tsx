import Link from "next/link";
import SSActivewearIntegration from "@/components/SSActivewearIntegration";

type Props = { ssSupplier: any; sanmarConnection: any; productCount: number; draftCount: number };

export default function SupplierHub({ ssSupplier, sanmarConnection, productCount, draftCount }: Props) {
  const ssConnected = ssSupplier?.status === "connected";
  const sanmarConnected = sanmarConnection?.status === "connected";
  return <>
    <section className="supplier-stat-grid polished">
      <div className="admin-card"><span>Imported supplier products</span><strong>{productCount}</strong><small>Products using supplier SKU data</small></div>
      <div className="admin-card"><span>Blank drafts ready</span><strong>{draftCount}</strong><small>Purchasing drafts awaiting action</small></div>
      <div className="admin-card"><span>Connected suppliers</span><strong>{[ssConnected, sanmarConnected].filter(Boolean).length}</strong><small>Live or credential-ready accounts</small></div>
    </section>

    <section className="supplier-equal-grid">
      <article className="admin-card supplier-equal-card">
        <header><div className="provider-mark">S&amp;S</div><span className={ssConnected ? "status-pill connected" : "status-pill"}>{ssConnected ? "Connected" : "Setup needed"}</span></header>
        <div><p className="eyebrow">WHOLESALE SUPPLIER</p><h2>S&amp;S Activewear</h2><p>Live catalog search, color and size imports, inventory, and blank ordering. AlphaBroder is now handled through S&amp;S Activewear.</p></div>
        <footer><Link className="secondary-button" href="#ss-settings">{ssConnected ? "Manage connection" : "Connect account"}</Link><Link className="text-button" href="/dashboard/suppliers/catalog">Browse catalog →</Link></footer>
      </article>

      <article className="admin-card supplier-equal-card">
        <header><div className="provider-mark">SM</div><span className={sanmarConnected ? "status-pill connected" : "status-pill"}>{sanmarConnected ? "Configured" : "Not connected"}</span></header>
        <div><p className="eyebrow">WHOLESALE SUPPLIER</p><h2>SanMar</h2><p>Credential-ready connection using the same normalized products, variants, print zones, and purchasing workflow as every supplier.</p></div>
        <footer><Link className="secondary-button" href="/dashboard/integrations">{sanmarConnected ? "Manage credentials" : "Connect credentials"}</Link><span className="supplier-card-note">Live mapping requires approved API access.</span></footer>
      </article>

      <article className="admin-card supplier-equal-card">
        <header><div className="provider-mark">PF</div><span className="status-pill connected">Available</span></header>
        <div><p className="eyebrow">TEST SUPPLIER</p><h2>PrintFlow Demo</h2><p>Safe sample garments for testing product imports, front/back color images, sizes, pricing, and blank-order drafts.</p></div>
        <footer><Link className="secondary-button" href="/dashboard/suppliers/catalog">Browse demo catalog</Link><span className="supplier-card-note">Never creates a live wholesale order.</span></footer>
      </article>

      <article className="admin-card supplier-equal-card">
        <header><div className="provider-mark">＋</div><span className="status-pill">Built in</span></header>
        <div><p className="eyebrow">CUSTOM CATALOG</p><h2>Manual products</h2><p>Create products from any local or specialty supplier and upload real front/back garment photos for every color.</p></div>
        <footer><Link className="secondary-button" href="/dashboard/products">Create product</Link><span className="supplier-card-note">No supplier account required.</span></footer>
      </article>
    </section>

    <section id="ss-settings" className="supplier-connection-section">
      <div className="supplier-section-heading"><div><p className="eyebrow">S&amp;S CONNECTION</p><h2>Catalog and ordering controls</h2><p>Supplier-specific settings stay here while connection status remains visible in Integrations.</p></div><Link className="secondary-button" href="/dashboard/integrations">View all integrations</Link></div>
      <SSActivewearIntegration connected={ssConnected} accountHint={ssSupplier?.account_hint} initialSettings={ssSupplier?.settings}/>
    </section>
  </>;
}
