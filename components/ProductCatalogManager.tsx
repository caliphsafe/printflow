"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import type { CatalogProduct, PrintArea, ProductConfiguration, ProductPackage, ShirtColor } from "@/lib/types";
import { DEFAULT_CONFIGURATION, inchesToPrintArea, slugify, tierUnitPrice } from "@/lib/catalog";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const TABS = ["Basics", "Options", "Colors", "Print areas", "Pricing"] as const;
type Tab = typeof TABS[number];
type UploadState = { busy: boolean; error?: string; success?: string };

const PRODUCT_IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml"
};

type Props = { initialProducts: CatalogProduct[] };

function blankProduct(index: number): CatalogProduct {
  return {
    id: `new-${Date.now()}`,
    slug: `new-product-${index}`,
    name: "New custom product",
    description: "",
    active: true,
    configuration: copy(DEFAULT_CONFIGURATION)
  };
}

function fileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

function normalizedProductImageMime(file: File) {
  return PRODUCT_IMAGE_MIME[fileExtension(file.name)] || (file.type === "image/jpg" ? "image/jpeg" : file.type);
}

export default function ProductCatalogManager({ initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState(initialProducts[0]?.id || "");
  const [draft, setDraft] = useState<CatalogProduct | null>(initialProducts[0] ? copy(initialProducts[0]) : null);
  const [tab, setTab] = useState<Tab>("Basics");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const selected = useMemo(() => products.find((item) => item.id === selectedId), [products, selectedId]);
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((item) => `${item.name} ${item.configuration.customization.category} ${item.configuration.supplier?.brandName || ""} ${item.configuration.supplier?.styleName || ""}`.toLowerCase().includes(query));
  }, [products, search]);

  function choose(product: CatalogProduct) {
    setSelectedId(product.id);
    setDraft(copy(product));
    setMessage("");
    setTab("Basics");
  }

  function updateConfiguration(next: Partial<ProductConfiguration>) {
    if (draft) setDraft({ ...draft, configuration: { ...draft.configuration, ...next } });
  }

  function updateCustomization(next: Partial<ProductConfiguration["customization"]>) {
    if (draft) updateConfiguration({ customization: { ...draft.configuration.customization, ...next } });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMessage("");
    try {
      const isNew = draft.id.startsWith("new-");
      const response = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${draft.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, slug: slugify(draft.slug || draft.name) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save product.");
      const saved = data.product as CatalogProduct;
      setProducts((current) => isNew ? [...current, saved] : current.map((item) => item.id === saved.id ? saved : item));
      setSelectedId(saved.id);
      setDraft(copy(saved));
      setMessage("Saved. Product images and customer options are live.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft || draft.id.startsWith("new-") || !confirm(`Delete ${draft.name}?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/products/${draft.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete product.");
      const remaining = products.filter((item) => item.id !== draft.id);
      setProducts(remaining);
      setSelectedId(remaining[0]?.id || "");
      setDraft(remaining[0] ? copy(remaining[0]) : null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete product.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="product-admin-shell">
    <aside className="product-library admin-card">
      <div className="product-library-head">
        <div><p className="eyebrow">PRODUCTS</p><h2>Catalog</h2></div>
        <button className="secondary-button compact" onClick={() => {
          const item = blankProduct(products.length + 1);
          setDraft(item);
          setSelectedId(item.id);
          setTab("Basics");
          setMessage("");
        }}>New product</button>
      </div>
      <div className="product-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></div>
      <div className="product-library-list">
        {visibleProducts.map((product) => <button key={product.id} className={selectedId === product.id ? "product-library-item active" : "product-library-item"} onClick={() => choose(product)}>
          <span className="product-thumb">{product.configuration.colors[0]?.frontImageUrl ? <img src={product.configuration.colors[0].frontImageUrl} alt=""/> : product.name.slice(0, 1)}</span>
          <span><strong>{product.name}</strong><small>{product.configuration.supplier ? product.configuration.supplier.supplierName || product.configuration.supplier.provider : "Manual"} · {product.configuration.colors.length} colors</small></span>
          <i className={product.active ? "live" : ""}/>
        </button>)}
        {!visibleProducts.length && <div className="library-empty">No matching products.</div>}
      </div>
    </aside>

    <section className="product-editor admin-card">{!draft ? <div className="empty-state"><h2>Add your first product</h2></div> : <>
      <div className="product-editor-top">
        <div><p className="eyebrow">{draft.configuration.supplier ? "SUPPLIER PRODUCT" : "CUSTOM PRODUCT"}</p><h1>{draft.name}</h1><p>{selected?.configuration.supplier?.partNumber || "Build a polished customer-ready product."}</p></div>
        <label className="modern-switch"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })}/><span/><b>{draft.active ? "Live" : "Hidden"}</b></label>
      </div>

      <nav className="product-editor-tabs" aria-label="Product setup sections">{TABS.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

      <div className="product-editor-body">
        {tab === "Basics" && <Panel title="Product basics" description="The information customers use to understand and choose this product.">
          <div className="clean-form-grid">
            <Field label="Product name"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value, slug: slugify(event.target.value) })}/></Field>
            <Field label="Category"><select value={draft.configuration.customization.category} onChange={(event) => updateCustomization({ category: event.target.value })}><option>T-Shirts</option><option>Hoodies</option><option>Sweatshirts</option><option>Polos</option><option>Jackets</option><option>Totes</option><option>Other</option></select></Field>
            <Field label="Product URL"><input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })}/></Field>
            <Field label="Minimum order"><div className="input-suffix"><input type="number" min="12" value={draft.configuration.customization.minimumQuantity} onChange={(event) => updateCustomization({ minimumQuantity: Math.max(12, Number(event.target.value)) })}/><span>items</span></div><small>Customers can order any quantity at or above this number.</small></Field>
            <Field label="Description" wide><textarea rows={4} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></Field>
            <Field label="Artwork guidance" wide><textarea rows={3} value={draft.configuration.customization.customerInstructions || ""} onChange={(event) => updateCustomization({ customerInstructions: event.target.value })}/></Field>
          </div>
        </Panel>}

        {tab === "Options" && <>
          <Panel title="Design choices" description="Select every layout customers can use for this product.">
            <div className="selection-card-grid">
              <CheckCard title="Front only" text="Artwork appears only on the front." checked={draft.configuration.customization.designModes.includes("front")} onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "front", checked) })}/>
              <CheckCard title="Back only" text="Artwork appears only on the back." checked={draft.configuration.customization.designModes.includes("back")} onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "back", checked) })}/>
              <CheckCard title="Front + back" text="Separate artwork can be uploaded for both sides." checked={draft.configuration.customization.designModes.includes("front-back")} onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "front-back", checked) })}/>
            </div>
          </Panel>
          <Panel title="Decoration methods" description="These appear as a compact dropdown in the customer designer."><TagEditor values={draft.configuration.customization.decorationMethods} placeholder="Add method" onChange={(decorationMethods) => updateCustomization({ decorationMethods })}/></Panel>
          <Panel title="Available sizes" description="Customers enter exactly how many garments they need in each size."><TagEditor values={draft.configuration.sizes} placeholder="Add size" onChange={(sizes) => updateConfiguration({ sizes })}/></Panel>
        </>}

        {tab === "Colors" && <Panel title="Color variations" description="Upload real front and back garment images for each color. Images preview immediately; save the product to publish them.">
          <ColorImageEditor values={draft.configuration.colors} onChange={(colors) => updateConfiguration({ colors })}/>
        </Panel>}

        {tab === "Print areas" && <Panel title="Printable dimensions" description="Enter the physical production measurements in inches. There are no stepper arrows—type the exact value you use in production.">
          <div className="inch-area-grid">
            <InchAreaEditor label="Front print area" value={draft.configuration.customization.frontPrintArea} onChange={(frontPrintArea) => updateCustomization({ frontPrintArea })}/>
            <InchAreaEditor label="Back print area" value={draft.configuration.customization.backPrintArea} onChange={(backPrintArea) => updateCustomization({ backPrintArea })}/>
          </div>
          <div className="measurement-note"><strong>Production guide</strong><span>Width and height define the largest printable artwork. Top position controls how far down the garment the printable area begins.</span></div>
        </Panel>}

        {tab === "Pricing" && <>
          <Panel title="Side pricing" description="These are order-level additions to the calculated garment total."><div className="clean-form-grid three"><Money label="Front only add-on" value={draft.configuration.customization.frontSurcharge} onChange={(frontSurcharge) => updateCustomization({ frontSurcharge })}/><Money label="Back only add-on" value={draft.configuration.customization.backSurcharge} onChange={(backSurcharge) => updateCustomization({ backSurcharge })}/><Money label="Front + back add-on" value={draft.configuration.customization.twoSideSurcharge} onChange={(twoSideSurcharge) => updateCustomization({ twoSideSurcharge })}/></div></Panel>
          <Panel title="Quantity pricing" description="Customers can order any amount. PrintFlow automatically applies the best eligible per-item rate."><TierEditor values={draft.configuration.packages} minimum={draft.configuration.customization.minimumQuantity} onChange={(packages) => updateConfiguration({ packages })}/></Panel>
        </>}
      </div>

      {message && <div className={message.startsWith("Saved") ? "success-message" : "error-message"}>{message}</div>}
      <div className="sticky-editor-actions">
        {!draft.id.startsWith("new-") && <button className="danger-button" disabled={busy} onClick={remove}>Delete</button>}
        <span>{draft.active ? "Changes will appear in the customer catalog." : "This product is hidden from customers."}</span>
        <button className="primary-button fit-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save product"}</button>
      </div>
    </>}</section>
  </div>;
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="editor-panel"><header><h2>{title}</h2><p>{description}</p></header><div>{children}</div></section>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? "clean-field wide" : "clean-field"}><span>{label}</span>{children}</label>;
}

function CheckCard({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={checked ? "selection-card selected" : "selection-card"}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><span className="fake-check">✓</span><span><strong>{title}</strong><small>{text}</small></span></label>;
}

function toggleValue<T>(values: T[], value: T, checked: boolean) {
  return checked ? Array.from(new Set([...values, value])) : values.filter((item) => item !== value);
}

function Money({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <Field label={label}><div className="input-prefix"><span>$</span><input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))}/></div></Field>;
}

function TagEditor({ values, placeholder, onChange }: { values: string[]; placeholder: string; onChange: (values: string[]) => void }) {
  const [entry, setEntry] = useState("");
  return <div className="modern-tag-editor"><div>{values.map((item) => <span key={item}>{item}<button onClick={() => onChange(values.filter((value) => value !== item))}>×</button></span>)}</div><form onSubmit={(event) => { event.preventDefault(); const value = entry.trim(); if (value && !values.includes(value)) onChange([...values, value]); setEntry(""); }}><input value={entry} placeholder={placeholder} onChange={(event) => setEntry(event.target.value)}/><button>Add</button></form></div>;
}

function ColorImageEditor({ values, onChange }: { values: ShirtColor[]; onChange: (values: ShirtColor[]) => void }) {
  const [states, setStates] = useState<Record<string, UploadState>>({});

  async function upload(index: number, side: "front" | "back", file?: File) {
    if (!file) return;
    const key = `${values[index]?.id || index}-${side}`;
    const contentType = normalizedProductImageMime(file);
    if (!Object.values(PRODUCT_IMAGE_MIME).includes(contentType)) {
      setStates((current) => ({ ...current, [key]: { busy: false, error: "Use PNG, JPG, WEBP, or SVG." } }));
      return;
    }

    setStates((current) => ({ ...current, [key]: { busy: true } }));
    try {
      const prepare = await fetch("/api/admin/products/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: contentType, sizeBytes: file.size })
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Unable to prepare the image upload.");

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const keyValue = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !keyValue) throw new Error("Public Supabase settings are missing.");
      const supabase = createClient(url, keyValue, { auth: { persistSession: false } });
      const result = await supabase.storage.from(prepared.bucket).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: prepared.contentType || contentType });
      if (result.error) throw result.error;

      onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, [side === "front" ? "frontImageUrl" : "backImageUrl"]: prepared.publicUrl } : item));
      setStates((current) => ({ ...current, [key]: { busy: false, success: "Uploaded. Save product to publish." } }));
    } catch (error) {
      setStates((current) => ({ ...current, [key]: { busy: false, error: error instanceof Error ? error.message : "Unable to upload image." } }));
    }
  }

  return <div className="modern-color-list">
    {values.map((color, index) => <article key={color.id} className="modern-color-card">
      <div className="color-card-header">
        <input type="color" value={color.hex} aria-label={`${color.name} color`} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, hex: event.target.value } : item))}/>
        <input value={color.name} aria-label="Color name" onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value, id: slugify(event.target.value) } : item))}/>
        <label className="modern-switch small"><input type="checkbox" checked={color.active !== false} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, active: event.target.checked } : item))}/><span/><b>Visible</b></label>
        <button className="icon-delete" aria-label={`Delete ${color.name}`} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button>
      </div>
      <div className="side-photo-grid">
        <PhotoField title="Front image" url={color.frontImageUrl} state={states[`${color.id}-front`]} onUrl={(url) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, frontImageUrl: url } : item))} onFile={(file) => upload(index, "front", file)} onRemove={() => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, frontImageUrl: undefined } : item))}/>
        <PhotoField title="Back image" url={color.backImageUrl} state={states[`${color.id}-back`]} onUrl={(url) => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, backImageUrl: url } : item))} onFile={(file) => upload(index, "back", file)} onRemove={() => onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, backImageUrl: undefined } : item))}/>
      </div>
    </article>)}
    <button className="add-outline-button" onClick={() => onChange([...values, { id: `color-${Date.now()}`, name: "New color", hex: "#888888", active: true }])}>+ Add color</button>
  </div>;
}

function PhotoField({ title, url, state, onUrl, onFile, onRemove }: { title: string; url?: string; state?: UploadState; onUrl: (value: string) => void; onFile: (file?: File) => Promise<void>; onRemove: () => void }) {
  return <div className="photo-field enhanced">
    <div className="photo-preview">{url ? <img src={url} alt={`${title} preview`}/> : <span><b>No image</b><small>Upload a centered garment mockup</small></span>}</div>
    <div className="photo-field-controls">
      <div className="photo-field-title"><strong>{title}</strong><small>PNG, JPG, WEBP, or SVG · up to 25 MB</small></div>
      <div className="photo-actions">
        <label className={state?.busy ? "upload-outline disabled" : "upload-outline"}>{state?.busy ? "Uploading…" : url ? "Replace image" : "Upload image"}<input disabled={state?.busy} type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { const input = event.currentTarget; void onFile(input.files?.[0]).finally(() => { input.value = ""; }); }}/></label>
        {url && <button className="text-button photo-remove" type="button" onClick={onRemove}>Remove</button>}
      </div>
      <label className="image-url-field"><span>Image URL</span><input placeholder="Paste an image URL" value={url || ""} onChange={(event) => onUrl(event.target.value)}/></label>
      {state?.error && <small className="upload-feedback error">{state.error}</small>}
      {state?.success && <small className="upload-feedback success">{state.success}</small>}
    </div>
  </div>;
}

function InchAreaEditor({ label, value, onChange }: { label: string; value: PrintArea; onChange: (value: PrintArea) => void }) {
  const current = inchesToPrintArea(value);
  const update = (next: Partial<PrintArea>) => onChange(inchesToPrintArea({ ...current, ...next }));
  return <article className="inch-area-card refined">
    <div className="inch-area-heading"><div><span className="measurement-icon">↔</span><div><h3>{label}</h3><p>Type the exact dimensions used for production.</p></div></div><b>{current.widthInches?.toFixed(1)}″ × {current.heightInches?.toFixed(1)}″</b></div>
    <div className="inch-fields refined">
      <MeasurementInput label="Printable width" value={current.widthInches || 1} min={1} max={20} onCommit={(widthInches) => update({ widthInches })}/>
      <MeasurementInput label="Printable height" value={current.heightInches || 1} min={1} max={24} onCommit={(heightInches) => update({ heightInches })}/>
      <MeasurementInput label="Top position" value={current.topInches || 0} min={0} max={20} onCommit={(topInches) => update({ topInches })}/>
    </div>
    <div className="inch-area-mini-preview"><span style={{ width: `${Math.min(88, Math.max(26, (current.widthInches || 1) * 5.5))}%`, height: `${Math.min(76, Math.max(22, (current.heightInches || 1) * 3.6))}%`, marginTop: `${Math.min(25, Math.max(2, (current.topInches || 0) * 1.25))}%` }}>{current.widthInches?.toFixed(1)}″ × {current.heightInches?.toFixed(1)}″</span></div>
  </article>;
}

function MeasurementInput({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"));
  useEffect(() => setText(value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")), [value]);

  function commit() {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setText(value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setText(next.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"));
    onCommit(next);
  }

  return <label className="measurement-text-field"><span>{label}</span><div><input type="text" inputMode="decimal" value={text} onChange={(event) => setText(event.target.value.replace(/[^0-9.]/g, ""))} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}/><b>in</b></div></label>;
}

function TierEditor({ values, minimum, onChange }: { values: ProductPackage[]; minimum: number; onChange: (values: ProductPackage[]) => void }) {
  return <div className="pricing-tier-editor"><div className="pricing-tier-head"><span>Starts at</span><span>Price per item</span><span>Example total</span><span/></div>{values.map((tier, index) => { const unit = tierUnitPrice(tier); return <div className="pricing-tier-row" key={tier.id}><div className="input-suffix"><input type="number" min={minimum} value={tier.quantity} onChange={(event) => { const quantity = Math.max(minimum, Number(event.target.value)); onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, quantity, label: `${quantity}+`, price: Number((unit * quantity).toFixed(2)) } : item).sort((a, b) => a.quantity - b.quantity)); }}/><span>items</span></div><div className="input-prefix"><span>$</span><input type="number" min="0" step="0.01" value={unit.toFixed(2)} onChange={(event) => { const nextUnit = Number(event.target.value); onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, price: Number((nextUnit * item.quantity).toFixed(2)) } : item)); }}/></div><strong>${tier.price.toFixed(2)}</strong><button className="icon-delete" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>; })}<button className="add-outline-button" onClick={() => { const last = values.at(-1); const quantity = Math.max(minimum, (last?.quantity || minimum) + 12); const unit = last ? tierUnitPrice(last) : 15; onChange([...values, { id: `tier-${Date.now()}`, label: `${quantity}+`, quantity, price: Number((quantity * unit).toFixed(2)), checkoutUrl: "" }]); }}>+ Add pricing tier</button><p className="pricing-example">Example: if the 24+ rate is $16 and a customer orders 31 shirts, the garment subtotal is $496 before side add-ons.</p></div>;
}
