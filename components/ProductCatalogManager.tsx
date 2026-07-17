"use client";

import { useMemo, useState } from "react";
import type { CatalogProduct, ProductConfiguration, ProductPackage, ShirtColor, PrintArea } from "@/lib/types";
import { DEFAULT_CONFIGURATION, slugify } from "@/lib/catalog";

type Props = { initialProducts: CatalogProduct[] };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function blankProduct(index: number): CatalogProduct {
  return { id: `new-${Date.now()}`, slug: `new-product-${index}`, name: "New custom product", description: "", active: true, configuration: copy(DEFAULT_CONFIGURATION) };
}

export default function ProductCatalogManager({ initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState(initialProducts[0]?.id || "");
  const [draft, setDraft] = useState<CatalogProduct | null>(initialProducts[0] ? copy(initialProducts[0]) : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => products.find((item) => item.id === selectedId), [products, selectedId]);

  function choose(product: CatalogProduct) { setSelectedId(product.id); setDraft(copy(product)); setMessage(""); }
  function updateConfiguration(next: Partial<ProductConfiguration>) { if (draft) setDraft({ ...draft, configuration: { ...draft.configuration, ...next } }); }
  function updateCustomization(next: Partial<ProductConfiguration["customization"]>) {
    if (draft) updateConfiguration({ customization: { ...draft.configuration.customization, ...next } });
  }

  async function save() {
    if (!draft) return;
    setBusy(true); setMessage("");
    const isNew = draft.id.startsWith("new-");
    const response = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${draft.id}`, {
      method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, slug: slugify(draft.slug || draft.name) })
    });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to save product.");
    const saved = data.product as CatalogProduct;
    setProducts((current) => isNew ? [...current, saved] : current.map((item) => item.id === saved.id ? saved : item));
    setSelectedId(saved.id); setDraft(copy(saved)); setMessage("Saved. Product images and designer options are live.");
  }

  async function remove() {
    if (!draft || draft.id.startsWith("new-") || !confirm(`Delete ${draft.name}?`)) return;
    setBusy(true); const response = await fetch(`/api/admin/products/${draft.id}`, { method: "DELETE" }); const data = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to delete product.");
    const remaining = products.filter((item) => item.id !== draft.id); setProducts(remaining); setSelectedId(remaining[0]?.id || ""); setDraft(remaining[0] ? copy(remaining[0]) : null);
  }

  return <div className="catalog-layout">
    <aside className="catalog-list admin-card">
      <div className="catalog-list-head"><div><p className="eyebrow">PRODUCT LIBRARY</p><h2>Products</h2></div><button className="secondary-button compact" onClick={() => { const item = blankProduct(products.length + 1); setDraft(item); setSelectedId(item.id); }}>+ Add</button></div>
      <div className="catalog-items">{products.map((product) => <button key={product.id} className={selectedId === product.id ? "catalog-item active" : "catalog-item"} onClick={() => choose(product)}>
        <span><strong>{product.name}</strong><small>{product.configuration.supplier ? product.configuration.supplier.supplierName || product.configuration.supplier.provider : "Manual product"} · {product.configuration.colors.length} colors · {product.configuration.customization.designModes.length} design modes</small></span><span className={product.active ? "status-dot on" : "status-dot"}/>
      </button>)}</div>
    </aside>

    <section className="admin-card catalog-editor">{!draft ? <div className="empty-state"><h2>Add your first product</h2></div> : <>
      <div className="catalog-editor-head"><div><p className="eyebrow">{draft.configuration.supplier ? "SUPPLIER PRODUCT" : "CUSTOM PRODUCT"}</p><h2>{draft.name}</h2><small>{selected?.configuration.supplier?.partNumber || "Fully editable product"}</small></div><label className="toggle-row"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })}/><span>Visible to customers</span></label></div>

      <div className="catalog-form-grid">
        <label><span>Product name</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: slugify(e.target.value) })}/></label>
        <label><span>Category</span><input value={draft.configuration.customization.category} onChange={(e) => updateCustomization({ category: e.target.value })}/></label>
        <label><span>Product slug</span><input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}/></label>
        <label><span>Minimum quantity</span><input type="number" min="1" value={draft.configuration.customization.minimumQuantity} onChange={(e) => updateCustomization({ minimumQuantity: Number(e.target.value) })}/></label>
        <label className="full-field"><span>Description</span><textarea rows={3} value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })}/></label>
        <label className="full-field"><span>Customer customization guidance</span><textarea rows={2} value={draft.configuration.customization.customerInstructions || ""} onChange={(e) => updateCustomization({ customerInstructions: e.target.value })}/></label>
      </div>

      <Section title="Design sides & pricing" description="Choose which design experiences customers can use and what each side adds to the package price.">
        <div className="option-grid">
          <Toggle label="Front only" checked={draft.configuration.customization.designModes.includes("front")} onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "front", checked) })}/>
          <Toggle label="Back only" checked={draft.configuration.customization.designModes.includes("back")} onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "back", checked) })}/>
          <Toggle label="Front + back" checked={draft.configuration.customization.designModes.includes("front-back")} onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "front-back", checked) })}/>
        </div>
        <div className="catalog-form-grid three">
          <Money label="Front surcharge" value={draft.configuration.customization.frontSurcharge} onChange={(frontSurcharge) => updateCustomization({ frontSurcharge })}/>
          <Money label="Back surcharge" value={draft.configuration.customization.backSurcharge} onChange={(backSurcharge) => updateCustomization({ backSurcharge })}/>
          <Money label="Two-side surcharge" value={draft.configuration.customization.twoSideSurcharge} onChange={(twoSideSurcharge) => updateCustomization({ twoSideSurcharge })}/>
        </div>
      </Section>

      <Section title="Decoration methods" description="Offer the production methods supported for this product."><TagEditor values={draft.configuration.customization.decorationMethods} placeholder="Screen Print" onChange={(decorationMethods) => updateCustomization({ decorationMethods })}/></Section>
      <Section title="Sizes" description="Customers assign quantities by size."><TagEditor values={draft.configuration.sizes} placeholder="Add size" onChange={(sizes) => updateConfiguration({ sizes })}/></Section>
      <Section title="Color variations & images" description="Upload a real front and back garment image for every color. Supplier imports can still be overridden here."><ColorImageEditor values={draft.configuration.colors} onChange={(colors) => updateConfiguration({ colors })}/></Section>
      <Section title="Print areas" description="Control the movable artwork boundary for each garment side."><div className="print-area-grid"><PrintAreaEditor label="Front print area" value={draft.configuration.customization.frontPrintArea} onChange={(frontPrintArea) => updateCustomization({ frontPrintArea })}/><PrintAreaEditor label="Back print area" value={draft.configuration.customization.backPrintArea} onChange={(backPrintArea) => updateCustomization({ backPrintArea })}/></div></Section>
      <Section title="Packages & checkout" description="Base package price plus the selected design-side surcharge becomes the displayed total."><PackageEditor values={draft.configuration.packages} onChange={(packages) => updateConfiguration({ packages })}/></Section>

      {message && <div className={message.startsWith("Saved") ? "success-message" : "error-message"}>{message}</div>}
      <div className="catalog-actions">{!draft.id.startsWith("new-") && <button className="danger-button" disabled={busy} onClick={remove}>Delete</button>}<button className="primary-button fit-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save product"}</button></div>
    </>}</section>
  </div>;
}

function toggleValue<T>(values: T[], value: T, checked: boolean) { return checked ? Array.from(new Set([...values, value])) : values.filter((item) => item !== value); }
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="editor-section"><div><h3>{title}</h3><p>{description}</p></div><div>{children}</div></section>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="choice-card"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}/><span>{label}</span></label>; }
function Money({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label><span>{label}</span><div className="money-input"><b>$</b><input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(Number(e.target.value))}/></div></label>; }

function TagEditor({ values, placeholder, onChange }: { values: string[]; placeholder: string; onChange: (values: string[]) => void }) {
  const [next, setNext] = useState(""); return <div className="tag-editor"><div className="tag-list">{values.map((value) => <span key={value}>{value}<button onClick={() => onChange(values.filter((item) => item !== value))}>×</button></span>)}</div><div className="tag-add"><input value={next} placeholder={placeholder} onChange={(e) => setNext(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (next.trim()) { onChange([...values, next.trim()]); setNext(""); } } }}/><button className="secondary-button compact" onClick={() => { if (next.trim()) { onChange([...values, next.trim()]); setNext(""); } }}>Add</button></div></div>;
}

function ColorImageEditor({ values, onChange }: { values: ShirtColor[]; onChange: (values: ShirtColor[]) => void }) {
  const [uploading, setUploading] = useState("");
  async function upload(index: number, side: "frontImageUrl" | "backImageUrl" | "swatchImageUrl", file?: File) {
    if (!file) return; setUploading(`${index}-${side}`); const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/admin/products/images", { method: "POST", body: form }); const data = await response.json(); setUploading("");
    if (!response.ok) return alert(data.error || "Upload failed.");
    onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, [side]: data.url } : item));
  }
  return <div className="color-image-list">{values.map((color, index) => <article className="color-image-card" key={color.id}>
    <div className="color-image-head"><input type="color" value={color.hex} onChange={(e) => onChange(values.map((item, i) => i === index ? { ...item, hex: e.target.value } : item))}/><input value={color.name} onChange={(e) => onChange(values.map((item, i) => i === index ? { ...item, name: e.target.value, id: slugify(e.target.value) } : item))}/><button className="icon-button" onClick={() => onChange(values.filter((_, i) => i !== index))}>×</button></div>
    <div className="side-image-grid"><ImageField label="Front image" url={color.frontImageUrl} busy={uploading === `${index}-frontImageUrl`} onFile={(file) => upload(index, "frontImageUrl", file)} onUrl={(url) => onChange(values.map((item, i) => i === index ? { ...item, frontImageUrl: url } : item))}/><ImageField label="Back image" url={color.backImageUrl} busy={uploading === `${index}-backImageUrl`} onFile={(file) => upload(index, "backImageUrl", file)} onUrl={(url) => onChange(values.map((item, i) => i === index ? { ...item, backImageUrl: url } : item))}/></div>
  </article>)}<button className="secondary-button fit-button" onClick={() => onChange([...values, { id: `color-${Date.now()}`, name: "New color", hex: "#777777" }])}>+ Add color variation</button></div>;
}
function ImageField({ label, url, busy, onFile, onUrl }: { label: string; url?: string; busy: boolean; onFile: (file?: File) => void; onUrl: (url: string) => void }) { return <div className="image-upload-field"><span>{label}</span><div className="image-preview">{url ? <img src={url} alt=""/> : <small>No image</small>}</div><label className="secondary-button compact file-button">{busy ? "Uploading…" : "Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => onFile(e.target.files?.[0])}/></label><input placeholder="Or paste image URL" value={url || ""} onChange={(e) => onUrl(e.target.value)}/></div>; }
function PrintAreaEditor({ label, value, onChange }: { label: string; value: PrintArea; onChange: (value: PrintArea) => void }) { return <div className="print-area-card"><h4>{label}</h4><div className="four-field-grid">{(["x", "y", "width", "height"] as const).map((key) => <label key={key}><span>{key.toUpperCase()}</span><input type="number" value={value[key]} onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}/></label>)}</div></div>; }
function PackageEditor({ values, onChange }: { values: ProductPackage[]; onChange: (values: ProductPackage[]) => void }) { return <div className="package-editor">{values.map((item, index) => <div className="package-row" key={item.id}><input placeholder="Label" value={item.label} onChange={(e) => onChange(values.map((v, i) => i === index ? { ...v, label: e.target.value } : v))}/><input type="number" min="1" value={item.quantity} onChange={(e) => onChange(values.map((v, i) => i === index ? { ...v, quantity: Number(e.target.value) } : v))}/><input type="number" min="0" step="0.01" value={item.price} onChange={(e) => onChange(values.map((v, i) => i === index ? { ...v, price: Number(e.target.value) } : v))}/><input placeholder="Checkout URL" value={item.checkoutUrl} onChange={(e) => onChange(values.map((v, i) => i === index ? { ...v, checkoutUrl: e.target.value } : v))}/><button className="icon-button" onClick={() => onChange(values.filter((_, i) => i !== index))}>×</button></div>)}<button className="secondary-button fit-button" onClick={() => onChange([...values, { id: `package-${Date.now()}`, label: "24 shirts", quantity: 24, price: 299, checkoutUrl: "" }])}>+ Add package</button></div>; }
