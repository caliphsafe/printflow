"use client";

import { useMemo, useState } from "react";
import type { CatalogProduct, PrintArea, ProductConfiguration, ProductPackage, ShirtColor } from "@/lib/types";
import { DEFAULT_CONFIGURATION, inchesToPrintArea, slugify, tierUnitPrice } from "@/lib/catalog";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const TABS = ["Basics", "Options", "Colors", "Print areas", "Pricing"] as const;
type Tab = typeof TABS[number];

type Props = { initialProducts: CatalogProduct[] };
function blankProduct(index: number): CatalogProduct {
  return { id: `new-${Date.now()}`, slug: `new-product-${index}`, name: "New custom product", description: "", active: true, configuration: copy(DEFAULT_CONFIGURATION) };
}

export default function ProductCatalogManager({ initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState(initialProducts[0]?.id || "");
  const [draft, setDraft] = useState<CatalogProduct | null>(initialProducts[0] ? copy(initialProducts[0]) : null);
  const [tab, setTab] = useState<Tab>("Basics");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = useMemo(() => products.find((item) => item.id === selectedId), [products, selectedId]);

  function choose(product: CatalogProduct) { setSelectedId(product.id); setDraft(copy(product)); setMessage(""); setTab("Basics"); }
  function updateConfiguration(next: Partial<ProductConfiguration>) { if (draft) setDraft({ ...draft, configuration: { ...draft.configuration, ...next } }); }
  function updateCustomization(next: Partial<ProductConfiguration["customization"]>) { if (draft) updateConfiguration({ customization: { ...draft.configuration.customization, ...next } }); }

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
    setSelectedId(saved.id); setDraft(copy(saved)); setMessage("Saved. Your product experience is live.");
  }

  async function remove() {
    if (!draft || draft.id.startsWith("new-") || !confirm(`Delete ${draft.name}?`)) return;
    setBusy(true); const response = await fetch(`/api/admin/products/${draft.id}`, { method: "DELETE" }); const data = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to delete product.");
    const remaining = products.filter((item) => item.id !== draft.id); setProducts(remaining); setSelectedId(remaining[0]?.id || ""); setDraft(remaining[0] ? copy(remaining[0]) : null);
  }

  return <div className="product-admin-shell">
    <aside className="product-library admin-card">
      <div className="product-library-head"><div><p className="eyebrow">PRODUCTS</p><h2>Catalog</h2></div><button className="secondary-button compact" onClick={() => { const item = blankProduct(products.length + 1); setDraft(item); setSelectedId(item.id); setTab("Basics"); }}>New product</button></div>
      <div className="product-search"><input placeholder="Search products" /></div>
      <div className="product-library-list">{products.map((product) => <button key={product.id} className={selectedId === product.id ? "product-library-item active" : "product-library-item"} onClick={() => choose(product)}>
        <span className="product-thumb">{product.configuration.colors[0]?.frontImageUrl ? <img src={product.configuration.colors[0].frontImageUrl} alt=""/> : product.name.slice(0,1)}</span>
        <span><strong>{product.name}</strong><small>{product.configuration.supplier ? product.configuration.supplier.supplierName || product.configuration.supplier.provider : "Manual"} · {product.configuration.colors.length} colors</small></span>
        <i className={product.active ? "live" : ""}/>
      </button>)}</div>
    </aside>

    <section className="product-editor admin-card">{!draft ? <div className="empty-state"><h2>Add your first product</h2></div> : <>
      <div className="product-editor-top"><div><p className="eyebrow">{draft.configuration.supplier ? "SUPPLIER PRODUCT" : "CUSTOM PRODUCT"}</p><h1>{draft.name}</h1><p>{selected?.configuration.supplier?.partNumber || "Build a polished customer-ready product."}</p></div><label className="modern-switch"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })}/><span/><b>{draft.active ? "Live" : "Hidden"}</b></label></div>

      <nav className="product-editor-tabs">{TABS.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

      <div className="product-editor-body">
        {tab === "Basics" && <Panel title="Product basics" description="The information customers use to understand and choose this product.">
          <div className="clean-form-grid">
            <Field label="Product name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: slugify(e.target.value) })}/></Field>
            <Field label="Category"><select value={draft.configuration.customization.category} onChange={(e) => updateCustomization({ category: e.target.value })}><option>T-Shirts</option><option>Hoodies</option><option>Sweatshirts</option><option>Polos</option><option>Jackets</option><option>Totes</option><option>Other</option></select></Field>
            <Field label="Product URL"><input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}/></Field>
            <Field label="Minimum order"><div className="input-suffix"><input type="number" min="12" value={draft.configuration.customization.minimumQuantity} onChange={(e) => updateCustomization({ minimumQuantity: Math.max(12, Number(e.target.value)) })}/><span>items</span></div><small>Customers can order any quantity at or above this number.</small></Field>
            <Field label="Description" wide><textarea rows={4} value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })}/></Field>
            <Field label="Artwork guidance" wide><textarea rows={3} value={draft.configuration.customization.customerInstructions || ""} onChange={(e) => updateCustomization({ customerInstructions: e.target.value })}/></Field>
          </div>
        </Panel>}

        {tab === "Options" && <>
          <Panel title="Design choices" description="Select the layouts customers can choose. Checkboxes are used because more than one option can be available.">
            <div className="selection-card-grid">
              <CheckCard title="Front only" text="Artwork appears only on the front." checked={draft.configuration.customization.designModes.includes("front")} onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "front", checked) })}/>
              <CheckCard title="Back only" text="Artwork appears only on the back." checked={draft.configuration.customization.designModes.includes("back")} onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "back", checked) })}/>
              <CheckCard title="Front + back" text="Separate artwork can be uploaded for both sides." checked={draft.configuration.customization.designModes.includes("front-back")} onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "front-back", checked) })}/>
            </div>
          </Panel>
          <Panel title="Decoration methods" description="These appear as a simple dropdown in the customer designer."><TagEditor values={draft.configuration.customization.decorationMethods} placeholder="Add method" onChange={(decorationMethods) => updateCustomization({ decorationMethods })}/></Panel>
          <Panel title="Available sizes" description="Customers enter a quantity for each size they need."><TagEditor values={draft.configuration.sizes} placeholder="Add size" onChange={(sizes) => updateConfiguration({ sizes })}/></Panel>
        </>}

        {tab === "Colors" && <Panel title="Color variations" description="Every color can have its own front and back garment photography."><ColorImageEditor values={draft.configuration.colors} onChange={(colors) => updateConfiguration({ colors })}/></Panel>}

        {tab === "Print areas" && <Panel title="Printable dimensions" description="Set physical production dimensions in inches. PrintFlow converts them into the customer design boundary automatically.">
          <div className="inch-area-grid"><InchAreaEditor label="Front print area" value={draft.configuration.customization.frontPrintArea} onChange={(frontPrintArea) => updateCustomization({ frontPrintArea })}/><InchAreaEditor label="Back print area" value={draft.configuration.customization.backPrintArea} onChange={(backPrintArea) => updateCustomization({ backPrintArea })}/></div>
          <div className="measurement-note"><strong>How this works</strong><span>Width and height represent the largest printable artwork. Top position measures down from the top of the 800 × 800 garment workspace.</span></div>
        </Panel>}

        {tab === "Pricing" && <>
          <Panel title="Side pricing" description="These are order-level additions to the calculated garment total."><div className="clean-form-grid three"><Money label="Front only add-on" value={draft.configuration.customization.frontSurcharge} onChange={(frontSurcharge) => updateCustomization({ frontSurcharge })}/><Money label="Back only add-on" value={draft.configuration.customization.backSurcharge} onChange={(backSurcharge) => updateCustomization({ backSurcharge })}/><Money label="Front + back add-on" value={draft.configuration.customization.twoSideSurcharge} onChange={(twoSideSurcharge) => updateCustomization({ twoSideSurcharge })}/></div></Panel>
          <Panel title="Quantity pricing" description="Customers can order any amount. PrintFlow automatically applies the best eligible per-item rate."><TierEditor values={draft.configuration.packages} minimum={draft.configuration.customization.minimumQuantity} onChange={(packages) => updateConfiguration({ packages })}/></Panel>
        </>}
      </div>

      {message && <div className={message.startsWith("Saved") ? "success-message" : "error-message"}>{message}</div>}
      <div className="sticky-editor-actions">{!draft.id.startsWith("new-") && <button className="danger-button" disabled={busy} onClick={remove}>Delete</button>}<span>{draft.active ? "Changes will appear in the customer catalog." : "This product is hidden from customers."}</span><button className="primary-button fit-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save product"}</button></div>
    </>}</section>
  </div>;
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="editor-panel"><header><h2>{title}</h2><p>{description}</p></header><div>{children}</div></section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? "clean-field wide" : "clean-field"}><span>{label}</span>{children}</label>; }
function CheckCard({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (value:boolean)=>void }) { return <label className={checked ? "selection-card selected" : "selection-card"}><input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)}/><span className="fake-check">✓</span><span><strong>{title}</strong><small>{text}</small></span></label>; }
function toggleValue<T>(values: T[], value: T, checked: boolean) { return checked ? Array.from(new Set([...values, value])) : values.filter((item) => item !== value); }
function Money({ label, value, onChange }: { label: string; value: number; onChange: (value:number)=>void }) { return <Field label={label}><div className="input-prefix"><span>$</span><input type="number" min="0" step="0.01" value={value} onChange={(e)=>onChange(Number(e.target.value))}/></div></Field>; }

function TagEditor({ values, placeholder, onChange }: { values: string[]; placeholder: string; onChange:(values:string[])=>void }) {
  const [entry,setEntry]=useState("");
  return <div className="modern-tag-editor"><div>{values.map((item)=><span key={item}>{item}<button onClick={()=>onChange(values.filter(v=>v!==item))}>×</button></span>)}</div><form onSubmit={(e)=>{e.preventDefault(); const value=entry.trim(); if(value&&!values.includes(value)) onChange([...values,value]); setEntry("");}}><input value={entry} placeholder={placeholder} onChange={(e)=>setEntry(e.target.value)}/><button>Add</button></form></div>;
}

function ColorImageEditor({ values, onChange }: { values: ShirtColor[]; onChange:(values:ShirtColor[])=>void }) {
  async function upload(index:number, side:"front"|"back", file?:File){ if(!file)return; const body=new FormData(); body.append("file",file); const response=await fetch("/api/admin/products/images",{method:"POST",body}); const data=await response.json(); if(response.ok) onChange(values.map((item,i)=>i===index?{...item,[side==="front"?"frontImageUrl":"backImageUrl"]:data.url}:item)); }
  return <div className="modern-color-list">{values.map((color,index)=><article key={color.id} className="modern-color-card"><div className="color-card-header"><input type="color" value={color.hex} onChange={(e)=>onChange(values.map((item,i)=>i===index?{...item,hex:e.target.value}:item))}/><input value={color.name} onChange={(e)=>onChange(values.map((item,i)=>i===index?{...item,name:e.target.value,id:slugify(e.target.value)}:item))}/><label className="modern-switch small"><input type="checkbox" checked={color.active!==false} onChange={(e)=>onChange(values.map((item,i)=>i===index?{...item,active:e.target.checked}:item))}/><span/><b>Visible</b></label><button className="icon-delete" onClick={()=>onChange(values.filter((_,i)=>i!==index))}>×</button></div><div className="side-photo-grid"><PhotoField title="Front image" url={color.frontImageUrl} onUrl={(url)=>onChange(values.map((item,i)=>i===index?{...item,frontImageUrl:url}:item))} onFile={(file)=>upload(index,"front",file)}/><PhotoField title="Back image" url={color.backImageUrl} onUrl={(url)=>onChange(values.map((item,i)=>i===index?{...item,backImageUrl:url}:item))} onFile={(file)=>upload(index,"back",file)}/></div></article>)}<button className="add-outline-button" onClick={()=>onChange([...values,{id:`color-${Date.now()}`,name:"New color",hex:"#888888",active:true}])}>+ Add color</button></div>;
}
function PhotoField({title,url,onUrl,onFile}:{title:string;url?:string;onUrl:(value:string)=>void;onFile:(file?:File)=>void}){return <div className="photo-field"><div className="photo-preview">{url?<img src={url} alt=""/>:<span>No image</span>}</div><div><strong>{title}</strong><label className="upload-outline">Upload<input type="file" accept="image/*" onChange={(e)=>onFile(e.target.files?.[0])}/></label><input placeholder="or paste image URL" value={url||""} onChange={(e)=>onUrl(e.target.value)}/></div></div>}

function InchAreaEditor({label,value,onChange}:{label:string;value:PrintArea;onChange:(value:PrintArea)=>void}){
  const current=inchesToPrintArea(value); const update=(next:Partial<PrintArea>)=>onChange(inchesToPrintArea({...current,...next}));
  return <article className="inch-area-card"><div className="inch-area-visual"><div style={{width:`${Math.min(86,(current.widthInches||1)*6)}%`,height:`${Math.min(80,(current.heightInches||1)*4)}%`,marginTop:`${Math.min(35,(current.topInches||0)*2)}%`}}><span>{current.widthInches?.toFixed(1)}″ × {current.heightInches?.toFixed(1)}″</span></div></div><div><h3>{label}</h3><div className="inch-fields"><Field label="Width"><div className="input-suffix"><input type="number" min="1" max="20" step="0.25" value={current.widthInches} onChange={(e)=>update({widthInches:Number(e.target.value)})}/><span>in</span></div></Field><Field label="Height"><div className="input-suffix"><input type="number" min="1" max="24" step="0.25" value={current.heightInches} onChange={(e)=>update({heightInches:Number(e.target.value)})}/><span>in</span></div></Field><Field label="Top position"><div className="input-suffix"><input type="number" min="0" max="20" step="0.25" value={current.topInches} onChange={(e)=>update({topInches:Number(e.target.value)})}/><span>in</span></div></Field></div></div></article>;
}

function TierEditor({values,minimum,onChange}:{values:ProductPackage[];minimum:number;onChange:(values:ProductPackage[])=>void}){
  return <div className="pricing-tier-editor"><div className="pricing-tier-head"><span>Starts at</span><span>Price per item</span><span>Example total</span><span/></div>{values.map((tier,index)=>{const unit=tierUnitPrice(tier); return <div className="pricing-tier-row" key={tier.id}><div className="input-suffix"><input type="number" min={minimum} value={tier.quantity} onChange={(e)=>{const quantity=Math.max(minimum,Number(e.target.value));onChange(values.map((item,i)=>i===index?{...item,quantity,label:`${quantity}+`,price:Number((unit*quantity).toFixed(2))}:item).sort((a,b)=>a.quantity-b.quantity))}}/><span>items</span></div><div className="input-prefix"><span>$</span><input type="number" min="0" step="0.01" value={unit.toFixed(2)} onChange={(e)=>{const nextUnit=Number(e.target.value);onChange(values.map((item,i)=>i===index?{...item,price:Number((nextUnit*item.quantity).toFixed(2))}:item))}}/></div><strong>${tier.price.toFixed(2)}</strong><button className="icon-delete" onClick={()=>onChange(values.filter((_,i)=>i!==index))}>×</button></div>})}<button className="add-outline-button" onClick={()=>{const last=values.at(-1);const quantity=Math.max(minimum,(last?.quantity||minimum)+12);const unit=last?tierUnitPrice(last):15;onChange([...values,{id:`tier-${Date.now()}`,label:`${quantity}+`,quantity,price:Number((quantity*unit).toFixed(2)),checkoutUrl:""}])}}>+ Add pricing tier</button><p className="pricing-example">Example: if the 24+ rate is $16 and a customer orders 31 shirts, the garment subtotal is $496 before side add-ons.</p></div>;
}
