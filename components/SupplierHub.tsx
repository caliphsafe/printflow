import Link from "next/link";
import SSActivewearIntegration from "@/components/SSActivewearIntegration";
type Props={supplier:any;productCount:number;draftCount:number};
export default function SupplierHub({supplier,productCount,draftCount}:Props){const connected=supplier?.status==='connected';return <>
 <section className="supplier-hero admin-card"><div><p className="eyebrow">SUPPLIER OPERATING SYSTEM</p><h2>Connect, source and order blanks</h2><p>Supplier accounts belong to each PrintFlow shop. Imported products follow one shared format, so the designer and order workflow work the same across future suppliers.</p></div><Link className="primary-button fit-button" href="/dashboard/suppliers/catalog">Browse demo catalog</Link></section>
 <section className="supplier-stat-grid"><div className="admin-card"><span>Imported supplier products</span><strong>{productCount}</strong></div><div className="admin-card"><span>Blank drafts ready</span><strong>{draftCount}</strong></div><div className="admin-card"><span>Live supplier connections</span><strong>{connected?1:0}</strong></div></section>
 <div className="supplier-hub-grid"><div><SSActivewearIntegration connected={connected} accountHint={supplier?.account_hint} initialSettings={supplier?.settings}/></div><div className="supplier-available-column">
  <section className="admin-card supplier-provider-card"><div className="provider-mark">SM</div><div><div className="card-heading"><h3>SanMar</h3><span className="status-pill">Coming soon</span></div><p>Future supplier connector using the same catalog and order-draft structure.</p></div></section>
  <section className="admin-card supplier-provider-card"><div className="provider-mark">AB</div><div><div className="card-heading"><h3>AlphaBroder</h3><span className="status-pill">Coming soon</span></div><p>Planned catalog import, inventory and blank-purchasing connection.</p></div></section>
  <section className="admin-card supplier-provider-card demo-provider"><div className="provider-mark">PF</div><div><div className="card-heading"><h3>PrintFlow Demo Supplier</h3><span className="status-pill connected">Available</span></div><p>Local sample products for testing imports, colors, sizes, images and order drafts without supplier credentials.</p><Link className="text-button" href="/dashboard/suppliers/catalog">Open demo catalog →</Link></div></section>
 </div></div>
 </>}
