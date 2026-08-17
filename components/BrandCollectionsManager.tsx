"use client";

import { useState } from "react";

type Collection = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  featured: boolean;
  designIds: string[];
  productIds: string[];
};

type SimpleItem = { id: string; name: string };

const fresh = () => ({
  id: "",
  name: "",
  description: "",
  active: true,
  featured: false,
  designIds: [] as string[],
  productIds: [] as string[]
});

export default function BrandCollectionsManager({
  initial,
  designs,
  products
}: {
  initial: Collection[];
  designs: SimpleItem[];
  products: SimpleItem[];
}) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<any>(initial[0] ? { ...initial[0] } : fresh());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function toggleId(field: "designIds" | "productIds", id: string, checked: boolean) {
    setDraft((current: any) => ({
      ...current,
      [field]: checked
        ? [...new Set([...(current[field] || []), id])]
        : (current[field] || []).filter((value: string) => value !== id)
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
      designIds: draft.designIds,
      productIds: draft.productIds
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
      setItems((current) => current.map((item) => item.id === draft.id ? { ...item, ...payload } : item));
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
    <div className="collection-shell">
      <aside className="admin-card collection-library">
        <div className="library-head">
          <div><p className="eyebrow">COLLECTIONS</p><h2>Library</h2></div>
          <button className="secondary-button compact" onClick={() => setDraft(fresh())}>New</button>
        </div>

        <div className="collection-list">
          {items.map((item) => (
            <button key={item.id} className={draft.id === item.id ? "active" : ""} onClick={() => setDraft({ ...item })}>
              <div><strong>{item.name}</strong><small>{item.designIds.length} designs · {item.productIds.length} garments</small></div>
              <span className={item.active ? "live" : ""}>{item.active ? "Live" : "Hidden"}</span>
            </button>
          ))}
          {!items.length && <p>No collections yet.</p>}
        </div>
      </aside>

      <section className="admin-card collection-editor">
        <header>
          <div>
            <p className="eyebrow">MERCHANDISING</p>
            <h1>{draft.id ? draft.name : "New collection"}</h1>
            <p>Group approved garments and designs into drops, seasons, campaigns, or permanent collections.</p>
          </div>
          <label className="modern-switch">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            <span /><b>{draft.active ? "Live" : "Hidden"}</b>
          </label>
        </header>

        <div className="collection-form">
          <label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label><span>Description</span><textarea rows={3} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label className="featured-check"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /><span>Featured collection</span></label>
        </div>

        <div className="membership-grid">
          <section>
            <div><h2>Garments</h2><p>Only selected garments appear when a customer browses this collection.</p></div>
            <div className="membership-list">
              {products.map((item) => (
                <label key={item.id}>
                  <input type="checkbox" checked={draft.productIds.includes(item.id)} onChange={(event) => toggleId("productIds", item.id, event.target.checked)} />
                  <span>{item.name}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div><h2>Designs</h2><p>Only selected designs appear when this collection is active.</p></div>
            <div className="membership-list">
              {designs.map((item) => (
                <label key={item.id}>
                  <input type="checkbox" checked={draft.designIds.includes(item.id)} onChange={(event) => toggleId("designIds", item.id, event.target.checked)} />
                  <span>{item.name}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {message && <div className={/updated|created|deleted/i.test(message) ? "success-message" : "error-message"}>{message}</div>}

        <footer>
          {draft.id && <button className="danger-button" disabled={busy} onClick={remove}>Delete collection</button>}
          <button className="primary-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save collection"}</button>
        </footer>
      </section>

      <style jsx>{`
        .collection-shell{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px;align-items:start}
        .collection-library{position:sticky;top:20px;padding:15px}
        .library-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.library-head h2{margin:2px 0}
        .collection-list{display:grid;gap:5px}.collection-list button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px;border:1px solid transparent;border-radius:9px;background:transparent;color:inherit;text-align:left}.collection-list button.active{background:#f5f5f1;border-color:#ddd}.collection-list strong{display:block;font-size:10px}.collection-list small{display:block;color:#777;font-size:8px}.collection-list span{font-size:8px;color:#777}.collection-list span.live{color:#2f8b59}.collection-list p{text-align:center;color:#777;font-size:9px;padding:20px}
        .collection-editor{padding:20px}.collection-editor>header{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:16px;border-bottom:1px solid #eee}.collection-editor h1{margin:3px 0 5px}.collection-editor header p{margin:0;color:#777;max-width:650px}
        .collection-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:18px 0}.collection-form label{display:grid;gap:5px}.collection-form label>span{font-size:9px;font-weight:750}.collection-form textarea{grid-column:span 1}.featured-check{display:flex!important;align-items:center;gap:7px!important}
        .membership-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.membership-grid>section{padding:14px;border:1px solid #e1e1dc;border-radius:11px}.membership-grid h2{margin:0 0 3px;font-size:14px}.membership-grid p{margin:0;color:#777;font-size:8px}.membership-list{display:grid;gap:5px;margin-top:10px;max-height:300px;overflow:auto}.membership-list label{display:flex;align-items:center;gap:7px;padding:7px 8px;border-radius:7px;background:#f7f7f3}.membership-list span{font-size:9px}
        .collection-editor>footer{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
        @media(max-width:900px){.collection-shell{grid-template-columns:1fr}.collection-library{position:static}}
        @media(max-width:650px){.collection-form,.membership-grid{grid-template-columns:1fr}.collection-editor>header{display:grid}}
      `}</style>
    </div>
  );
}
