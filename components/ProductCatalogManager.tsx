"use client";

import { useMemo, useState } from "react";
import type { CatalogProduct, ProductConfiguration, ProductPackage, ShirtColor } from "@/lib/types";
import { DEFAULT_CONFIGURATION, slugify } from "@/lib/catalog";

type Props = { initialProducts: CatalogProduct[] };

function cloneConfiguration(value: ProductConfiguration): ProductConfiguration {
  return JSON.parse(JSON.stringify(value));
}

function blankProduct(index: number): CatalogProduct {
  return {
    id: `new-${Date.now()}`,
    slug: `new-product-${index}`,
    name: "New custom shirt",
    description: "",
    active: true,
    configuration: cloneConfiguration(DEFAULT_CONFIGURATION)
  };
}

export default function ProductCatalogManager({ initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState(initialProducts[0]?.id || "");
  const [draft, setDraft] = useState<CatalogProduct | null>(initialProducts[0] ? JSON.parse(JSON.stringify(initialProducts[0])) : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => products.find((item) => item.id === selectedId) || null, [products, selectedId]);

  function choose(product: CatalogProduct) {
    setSelectedId(product.id);
    setDraft(JSON.parse(JSON.stringify(product)));
    setMessage("");
  }

  function createDraft() {
    const product = blankProduct(products.length + 1);
    setSelectedId(product.id);
    setDraft(product);
    setMessage("");
  }

  function updateConfiguration(next: Partial<ProductConfiguration>) {
    if (!draft) return;
    setDraft({ ...draft, configuration: { ...draft.configuration, ...next } });
  }

  async function save() {
    if (!draft) return;
    setBusy(true); setMessage("");
    const isNew = draft.id.startsWith("new-");
    const response = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${draft.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, slug: slugify(draft.slug || draft.name) })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to save product.");
    const saved = data.product as CatalogProduct;
    setProducts((current) => isNew ? [...current, saved] : current.map((item) => item.id === saved.id ? saved : item));
    setSelectedId(saved.id);
    setDraft(JSON.parse(JSON.stringify(saved)));
    setMessage("Saved. The public designer now uses this catalog.");
  }

  async function remove() {
    if (!draft || draft.id.startsWith("new-") || !confirm(`Delete ${draft.name}?`)) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/admin/products/${draft.id}`, { method: "DELETE" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to delete product.");
    const remaining = products.filter((item) => item.id !== draft.id);
    setProducts(remaining);
    setSelectedId(remaining[0]?.id || "");
    setDraft(remaining[0] ? JSON.parse(JSON.stringify(remaining[0])) : null);
  }

  return (
    <div className="catalog-layout">
      <aside className="catalog-list admin-card">
        <div className="catalog-list-head"><h2>Catalog</h2><button className="secondary-button compact" onClick={createDraft}>+ Add product</button></div>
        <div className="catalog-items">
          {products.map((product) => (
            <button key={product.id} className={selectedId === product.id ? "catalog-item active" : "catalog-item"} onClick={() => choose(product)}>
              <span><strong>{product.name}</strong><small>{product.configuration.supplier ? `${product.configuration.supplier.supplierName || product.configuration.supplier.provider}${product.configuration.supplier.sourceMode === "demo" ? " · Demo" : ""}` : "Manual"} · {product.configuration.packages.length} price packages · {product.configuration.colors.length} colors</small></span>
              <span className={product.active ? "status-dot on" : "status-dot"} />
            </button>
          ))}
        </div>
      </aside>

      <section className="admin-card catalog-editor">
        {!draft ? <div className="empty-state"><h2>No products yet</h2><button className="primary-button fit-button" onClick={createDraft}>Create your first product</button></div> : (
          <>
            <div className="catalog-editor-head">
              <div><p className="eyebrow">{draft.configuration.supplier ? `${draft.configuration.supplier.supplierName || draft.configuration.supplier.provider}${draft.configuration.supplier.sourceMode === "demo" ? " · DEMO IMPORT" : " · IMPORTED PRODUCT"}` : "PRODUCT EDITOR"}</p><h2>{draft.name || "Untitled product"}</h2>{draft.configuration.supplier && <small>{draft.configuration.supplier.variants.length} supplier SKUs · imported {new Date(draft.configuration.supplier.importedAt).toLocaleDateString()}</small>}</div>
              <label className="toggle-row"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span>Active in designer</span></label>
            </div>

            <div className="catalog-form-grid">
              <label><span>Product name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value, slug: slugify(event.target.value) })} /></label>
              <label><span>Product slug</span><input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} /></label>
              <label className="full-field"><span>Description</span><textarea rows={3} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <label className="full-field"><span>Mockup image URL (optional)</span><input placeholder="https://..." value={draft.configuration.mockupImageUrl || ""} onChange={(event) => updateConfiguration({ mockupImageUrl: event.target.value })} /></label>
            </div>

            <EditorSection title="Sizes" description="Add every garment size customers can assign quantities to.">
              <TagEditor values={draft.configuration.sizes} placeholder="Add size" onChange={(sizes) => updateConfiguration({ sizes })} />
            </EditorSection>

            <EditorSection title="Print locations" description="These choices appear inside the designer.">
              <TagEditor values={draft.configuration.printLocations} placeholder="Add print location" onChange={(printLocations) => updateConfiguration({ printLocations })} />
            </EditorSection>

            <EditorSection title="Shirt colors" description="Use a name and hex color for every available garment color.">
              <ColorEditor values={draft.configuration.colors} onChange={(colors) => updateConfiguration({ colors })} />
            </EditorSection>

            <EditorSection title="Quantity packages & pricing" description="Each package links to a real Squarespace product page for checkout.">
              <PackageEditor values={draft.configuration.packages} onChange={(packages) => updateConfiguration({ packages })} />
            </EditorSection>

            {message && <div className={message.startsWith("Saved") ? "success-message" : "error-message catalog-message"}>{message}</div>}
            <div className="catalog-actions">
              {!draft.id.startsWith("new-") && <button className="danger-button" disabled={busy} onClick={remove}>Delete product</button>}
              <button className="primary-button fit-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save product"}</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function EditorSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="catalog-section"><div><h3>{title}</h3><p>{description}</p></div>{children}</section>;
}

function TagEditor({ values, placeholder, onChange }: { values: string[]; placeholder: string; onChange: (values: string[]) => void }) {
  const [value, setValue] = useState("");
  function add() { const clean = value.trim(); if (!clean || values.includes(clean)) return; onChange([...values, clean]); setValue(""); }
  return <div><div className="tag-list">{values.map((item) => <button type="button" key={item} className="edit-tag" onClick={() => onChange(values.filter((value) => value !== item))}>{item}<span>×</span></button>)}</div><div className="inline-add"><input placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} /><button className="secondary-button compact" type="button" onClick={add}>Add</button></div></div>;
}

function ColorEditor({ values, onChange }: { values: ShirtColor[]; onChange: (values: ShirtColor[]) => void }) {
  return <div className="repeater-list">{values.map((color, index) => <div className="repeater-row color-row" key={`${color.id}-${index}`}><input type="color" value={color.hex} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, hex: event.target.value } : item))} /><input value={color.name} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value, id: slugify(event.target.value) } : item))} /><input value={color.hex} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, hex: event.target.value } : item))} /><button className="icon-button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}<button className="secondary-button compact" onClick={() => onChange([...values, { id: `color-${values.length + 1}`, name: "New color", hex: "#111111" }])}>+ Add color</button></div>;
}

function PackageEditor({ values, onChange }: { values: ProductPackage[]; onChange: (values: ProductPackage[]) => void }) {
  function patch(index: number, patchValue: Partial<ProductPackage>) { onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, ...patchValue } : item)); }
  return <div className="repeater-list">{values.map((item, index) => <div className="package-edit-card" key={`${item.id}-${index}`}><div className="package-edit-grid"><label><span>Label</span><input value={item.label} onChange={(event) => patch(index, { label: event.target.value, id: slugify(event.target.value) })} /></label><label><span>Quantity</span><input type="number" min="1" value={item.quantity} onChange={(event) => patch(index, { quantity: Math.max(1, Number(event.target.value)) })} /></label><label><span>Total price</span><input type="number" min="0" step="0.01" value={item.price} onChange={(event) => patch(index, { price: Math.max(0, Number(event.target.value)) })} /></label><label className="full-field"><span>Squarespace checkout URL</span><input placeholder="https://shop.com/store/p/..." value={item.checkoutUrl} onChange={(event) => patch(index, { checkoutUrl: event.target.value })} /></label></div><button className="icon-button package-remove" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}<button className="secondary-button compact" onClick={() => onChange([...values, { id: `package-${values.length + 1}`, label: `${values.length + 1} shirts`, quantity: 1, price: 0, checkoutUrl: "" }])}>+ Add price package</button></div>;
}
