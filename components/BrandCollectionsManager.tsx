"use client";

import { useState } from "react";

type Collection = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  featured: boolean;
  merchProductIds: string[];
};

type MerchProduct = {
  id: string;
  name: string;
  retail_price: number;
  active: boolean;
};

const fresh = () => ({
  id: "",
  name: "",
  description: "",
  active: false,
  featured: false,
  merchProductIds: [] as string[]
});

export default function BrandCollectionsManager({
  initial,
  products
}: {
  initial: Collection[];
  products: MerchProduct[];
}) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<any>(initial[0] ? { ...initial[0] } : fresh());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function toggleProduct(id: string, checked: boolean) {
    setDraft((current: any) => ({
      ...current,
      merchProductIds: checked
        ? [...new Set([...(current.merchProductIds || []), id])]
        : (current.merchProductIds || []).filter((value: string) => value !== id)
    }));
  }

  async function save() {
    if (!draft.name.trim()) return setMessage("Enter a collection name.");
    setBusy(true);
    setMessage("");

    const payload = {
      id: draft.id || undefined,
      name: draft.name,
      description: draft.description,
      active: draft.active,
      featured: draft.featured,
      productIds: draft.merchProductIds
    };

    const response = await fetch("/api/admin/brand-collections", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) return setMessage(data.error || "Unable to save collection.");

    if (draft.id) {
      const next = { ...draft };
      setItems((current) => current.map((item) => item.id === draft.id ? next : item));
      setMessage("Collection updated.");
    } else {
      const created = data.collection as Collection;
      setItems((current) => [...current, created]);
      setDraft({ ...created });
      setMessage("Collection created.");
    }
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Delete ${draft.name}?`)) return;
    setBusy(true);

    const response = await fetch(`/api/admin/brand-collections?id=${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) return setMessage(data.error || "Unable to delete collection.");

    const remaining = items.filter((item) => item.id !== draft.id);
    setItems(remaining);
    setDraft(remaining[0] ? { ...remaining[0] } : fresh());
    setMessage("Collection deleted.");
  }

  return (
    <div className="brand-collection-shell">
      <aside className="admin-card collection-library">
        <div className="library-head">
          <div><p className="eyebrow">COLLECTIONS</p><h2>Merchandising</h2></div>
          <button className="secondary-button compact" onClick={() => setDraft(fresh())}>New</button>
        </div>

        <div className="collection-list">
          {items.map((item) => (
            <button key={item.id} className={draft.id === item.id ? "active" : ""} onClick={() => setDraft({ ...item })}>
              <div><strong>{item.name}</strong><small>{item.merchProductIds.length} product{item.merchProductIds.length === 1 ? "" : "s"}</small></div>
              <span>{item.active ? "Live" : "Draft"}</span>
            </button>
          ))}
          {!items.length && <p>No collections yet.</p>}
        </div>
      </aside>

      <section className="admin-card collection-editor">
        <header>
          <div>
            <p className="eyebrow">BRAND MERCHANDISING</p>
            <h1>{draft.id ? draft.name : "New collection"}</h1>
            <p>Collections organize finished Brand Products—the actual merchandise customers can buy.</p>
          </div>
          <label className="modern-switch">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            <span /><b>{draft.active ? "Live" : "Draft"}</b>
          </label>
        </header>

        <div className="collection-form">
          <label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Summer '26" /></label>
          <label className="wide"><span>Description</span><textarea rows={3} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label className="featured"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /><span>Feature this collection</span></label>
        </div>

        <section className="collection-products">
          <div>
            <h2>Products in this collection</h2>
            <p>Select finished Brand products. Garments and designs are configured before this stage.</p>
          </div>

          <div className="collection-product-grid">
            {products.map((product) => (
              <label key={product.id} className={draft.merchProductIds.includes(product.id) ? "selected" : ""}>
                <input type="checkbox" checked={draft.merchProductIds.includes(product.id)} onChange={(event) => toggleProduct(product.id, event.target.checked)} />
                <span><strong>{product.name}</strong><small>${Number(product.retail_price).toFixed(2)} · {product.active ? "Live" : "Draft"}</small></span>
                <i>{draft.merchProductIds.includes(product.id) ? "✓" : ""}</i>
              </label>
            ))}
            {!products.length && <div className="empty-products"><h3>No Brand products yet</h3><p>Build finished merchandise first.</p><a href="/dashboard/brand-products">Brand Products</a></div>}
          </div>
        </section>

        {message && <div className={/updated|created|deleted/i.test(message) ? "success-message" : "error-message"}>{message}</div>}

        <footer>
          {draft.id && <button className="danger-button" disabled={busy} onClick={remove}>Delete collection</button>}
          <button className="primary-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save collection"}</button>
        </footer>
      </section>

      <style jsx>{`
        .brand-collection-shell{display:grid;grid-template-columns:250px minmax(0,1fr);gap:14px;align-items:start}.collection-library{position:sticky;top:20px;padding:14px}.library-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.library-head h2{margin:2px 0}.collection-list{display:grid;gap:4px}.collection-list button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px;border:1px solid transparent;border-radius:8px;background:transparent;color:inherit;text-align:left}.collection-list button.active{background:#f5f5f1;border-color:#ddd}.collection-list strong,.collection-list small{display:block}.collection-list strong{font-size:9px}.collection-list small,.collection-list button>span{font-size:7px;color:#777}.collection-list>p{text-align:center;padding:20px;color:#777;font-size:8px}
        .collection-editor{padding:18px}.collection-editor>header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding-bottom:15px;border-bottom:1px solid #eee}.collection-editor h1{margin:3px 0 4px}.collection-editor header p:not(.eyebrow){margin:0;color:#777}
        .collection-form{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:16px 0}.collection-form label{display:grid;gap:5px}.collection-form label>span{font-size:8px;font-weight:800}.collection-form .wide{grid-column:1/-1}.collection-form .featured{display:flex;align-items:center;gap:6px}
        .collection-products{padding-top:15px;border-top:1px solid #eee}.collection-products h2{margin:0 0 3px;font-size:14px}.collection-products>div>p{margin:0;color:#777;font-size:8px}.collection-product-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.collection-product-grid label{display:grid;grid-template-columns:auto minmax(0,1fr) 20px;gap:7px;align-items:center;padding:9px;border:1px solid #ddd;border-radius:8px}.collection-product-grid label.selected{border-color:#171717;background:#f5f5f1}.collection-product-grid strong,.collection-product-grid small{display:block}.collection-product-grid strong{font-size:9px}.collection-product-grid small{font-size:7px;color:#777}.collection-product-grid i{display:grid;place-items:center;width:18px;height:18px;border-radius:99px;background:#171717;color:#fff;font-size:7px;font-style:normal}.empty-products{grid-column:1/-1;padding:20px;border-radius:9px;background:#f5f5f1}.empty-products h3,.empty-products p{margin:0}.empty-products p{margin:3px 0 8px;color:#777;font-size:8px}.empty-products a{font-size:8px}
        .collection-editor>footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
        @media(max-width:850px){.brand-collection-shell{grid-template-columns:1fr}.collection-library{position:static}.collection-list{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}}
        @media(max-width:600px){.collection-form,.collection-product-grid{grid-template-columns:1fr}.collection-form .wide{grid-column:auto}.collection-editor>header{display:grid}}
      `}</style>
    </div>
  );
}
