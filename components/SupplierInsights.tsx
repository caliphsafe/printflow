"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id?: string; styleId?: string; name?: string; brandName: string; styleName: string; title?: string; category?: string; imageUrl?: string; orders?: number; pieces?: number; colors?: number; salePrice?: number; regularPrice?: number; accountPrice?: number; inventory?: number; saleExpiration?: string };
type Payload = { connected: boolean; topItems: Item[]; newItems: Item[]; saleItems: Item[]; warning?: string; updatedAt?: string };

function imageSrc(url?: string) {
  if (!url) return "";
  return url.includes("ssactivewear.com") ? `/api/public/supplier-image?url=${encodeURIComponent(url)}` : url;
}

function SupplierCard({ item, kind }: { item: Item; kind: "top" | "new" | "sale" }) {
  return <article className="supplier-intelligence-card">
    <div className="supplier-intelligence-image">{item.imageUrl ? <img src={imageSrc(item.imageUrl)} alt={`${item.brandName} ${item.styleName}`}/> : <span>S&amp;S</span>}{kind === "new" && <em>New</em>}{kind === "sale" && <em>Sale</em>}</div>
    <div className="supplier-intelligence-copy"><small>{item.brandName} · {item.styleName}</small><strong>{item.name || item.title || `${item.brandName} ${item.styleName}`}</strong>
      {kind === "top" && <p>{item.orders || 0} order{item.orders === 1 ? "" : "s"} · {item.pieces || 0} pieces</p>}
      {kind === "new" && <p>{item.category || "Apparel"}</p>}
      {kind === "sale" && <p><b>${Number(item.salePrice || item.accountPrice || 0).toFixed(2)}</b>{item.regularPrice ? <del>${Number(item.regularPrice).toFixed(2)}</del> : null} · {Number(item.inventory || 0).toLocaleString()} available</p>}
    </div>
  </article>;
}

export default function SupplierInsights() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(true);
  async function load(refresh = false) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/suppliers/insights${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok) setData(payload);
    } finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  return <section className="admin-card supplier-intelligence-section">
    <div className="card-heading supplier-intelligence-heading"><div><p className="section-kicker">SUPPLIER INTELLIGENCE</p><h2>Products worth watching</h2><p>Live opportunities from your supplier account and the products customers choose most.</p></div><div><button className="text-button" onClick={() => void load(true)} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</button><Link href="/dashboard/suppliers/catalog">Catalog</Link></div></div>
    {data?.warning && <div className="supplier-intelligence-warning">Live supplier updates could not refresh. Your imported-product activity is still shown.</div>}
    <div className="supplier-intelligence-columns">
      <section><header><h3>Top in your shop</h3><small>Based on customer orders</small></header><div>{data?.topItems?.length ? data.topItems.slice(0,3).map((item, index) => <SupplierCard key={item.id || index} item={item} kind="top"/>) : <p className="supplier-intelligence-empty">Order history will reveal your best sellers.</p>}</div></section>
      <section><header><h3>New from S&amp;S</h3><small>Marked new in the live catalog</small></header><div>{data?.newItems?.length ? data.newItems.slice(0,3).map((item, index) => <SupplierCard key={item.styleId || index} item={item} kind="new"/>) : <p className="supplier-intelligence-empty">{data?.connected ? "No new styles were returned in this refresh." : "Connect S&S to see new catalog styles."}</p>}</div></section>
      <section><header><h3>Supplier sale watch</h3><small>Sale-priced imported styles</small></header><div>{data?.saleItems?.length ? data.saleItems.slice(0,3).map((item, index) => <SupplierCard key={`${item.styleId}-${index}`} item={item} kind="sale"/>) : <p className="supplier-intelligence-empty">{data?.connected ? "No current sale prices were found on imported styles." : "Connect S&S to watch supplier pricing."}</p>}</div></section>
    </div>
  </section>;
}
