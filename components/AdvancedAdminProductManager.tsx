"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { decodeProductNameFields } from "@/lib/html-entities";
import { AVAILABLE_DECORATION_METHODS, normalizeDecorationMethods } from "@/lib/catalog";
import { defaultProductImage, uniqueProductImageChoices } from "@/lib/product-images";

const methods = [...AVAILABLE_DECORATION_METHODS];

export default function AdvancedAdminProductManager({ product }: { product: any }) {
  product = decodeProductNameFields(product);
  const router = useRouter();
  const [name, setName] = useState(product.name || "");
  const [active, setActive] = useState(product.active !== false);
  const [colors, setColors] = useState(product.configuration?.colors || []);
  const [defaultColorId, setDefaultColorId] = useState(product.configuration?.defaultColorId || product.configuration?.colors?.[0]?.id || "");
  const [minimumQuantity, setMinimumQuantity] = useState(Number(product.configuration?.customization?.minimumQuantity || 1));
  const [decorationMethods, setDecorationMethods] = useState<string[]>(normalizeDecorationMethods(product.configuration?.customization?.decorationMethods));
  const [busy, setBusy] = useState(false);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [message, setMessage] = useState("");

  const supplier = product.configuration?.supplier;
  const activeDefault = colors.find((c:any) => c.id === defaultColorId && c.active !== false) || colors.find((c:any) => c.active !== false) || colors[0];
  const image = activeDefault?.frontImageUrl || product.configuration?.mockupImageUrl;
  const dirty = name !== product.name || active !== product.active || minimumQuantity !== Number(product.configuration?.customization?.minimumQuantity || 1) || JSON.stringify(decorationMethods) !== JSON.stringify(normalizeDecorationMethods(product.configuration?.customization?.decorationMethods)) || JSON.stringify(colors) !== JSON.stringify(product.configuration?.colors || []) || defaultColorId !== (product.configuration?.defaultColorId || product.configuration?.colors?.[0]?.id || "");

  function toggleMethod(method: string) {
    if (decorationMethods.includes(method) && decorationMethods.length === 1) {
      setMessage("Keep at least one decoration method enabled for this product.");
      return;
    }
    setDecorationMethods((current) => current.includes(method) ? current.filter((item) => item !== method) : [...current, method]);
    setMessage("");
  }

  async function loadSanMarImages() {
    if (!supplier?.styleId) return;
    setImagesBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/suppliers/sanmar/style?style=${encodeURIComponent(supplier.styleId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load SanMar photos.");
      const media = data.style?.media || {};
      setColors((current:any[]) => current.map((color) => {
        const found = media[color.name] || {};
        const imageChoices = uniqueProductImageChoices(color.imageChoices || [], found.imageChoices || []);
        return {
          ...color,
          imageChoices,
          frontImageUrl: color.frontImageUrl || found.frontImageUrl || defaultProductImage(imageChoices, "front") || undefined,
          backImageUrl: color.backImageUrl || found.backImageUrl || defaultProductImage(imageChoices, "back") || undefined
        };
      }));
      setMessage("SanMar photos loaded. Choose the front and back images, then save the product.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load SanMar photos.");
    } finally { setImagesBusy(false); }
  }

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/advanced-admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, active, minimumQuantity, decorationMethods, colors, defaultColorId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save product.");
      setMessage("Product saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product.");
    } finally { setBusy(false); }
  }

  return <article className="ae-card ae-product-card">
    <header>
      <div><p className="ae-kicker">{product.configuration?.customization?.category || "CUSTOM APPAREL"}</p><h3>{name}</h3><small>{supplier ? `${supplier.supplierName || "Supplier"} · ${supplier.brandName || ""} ${supplier.styleName || supplier.styleId || ""}` : "Manual product"}</small></div>
      <label className="ae-switch"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/><span>{active ? "LIVE" : "DRAFT"}</span></label>
    </header>
    <div className="ae-product-preview">{image ? <img src={image} alt="Product preview"/> : <span>Supplier image will appear after import.</span>}</div>
    <div className="ae-product-image-choices"><strong>Customer product images</strong><small>Choose the photos shoppers see for each color. You can change these choices at any time.</small>{supplier?.provider==="sanmar"&&<button className="ae-button" type="button" onClick={()=>void loadSanMarImages()} disabled={imagesBusy}>{imagesBusy?"Loading SanMar photos…":"Refresh all SanMar photos"}</button>}{colors.map((color:any,index:number)=>{
      const choices=Array.from(new Map([...(color.imageChoices||[]),...(color.frontImageUrl?[{url:color.frontImageUrl,label:"Current front"}]:[]),...(color.backImageUrl?[{url:color.backImageUrl,label:"Current back"}]:[])].filter((choice:any)=>choice.url).map((choice:any)=>[choice.url,choice] as const)).values());
      return <section key={color.id}><b>{color.name}</b><div>{(["frontImageUrl","backImageUrl"] as const).map((side)=> <label key={side}><span>{side==="frontImageUrl"?"Front photo":"Back photo"}</span><select value={color[side]||""} onChange={(event)=>setColors((current:any[])=>current.map((item,itemIndex)=>itemIndex===index?{...item,[side]:event.target.value||undefined}:item))}><option value="">No image</option>{choices.map((choice:any)=><option key={choice.url} value={choice.url}>{choice.label}</option>)}</select></label>)}</div></section>;
    })}</div>
    <label className="ae-field"><span>Customer-facing product name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
    <label className="ae-field"><span>Minimum order quantity</span><input type="number" min="1" value={minimumQuantity} onChange={(e) => setMinimumQuantity(Math.max(1, Number(e.target.value || 1)))} /></label>
    <div><span style={{fontSize:8,fontWeight:900,color:"var(--ae-navy)"}}>Allowed decoration</span><div className="ae-methods" style={{marginTop:6}}>
      {methods.map((method) => <label className="ae-check" key={method}><input type="checkbox" checked={decorationMethods.includes(method)} onChange={() => toggleMethod(method)}/><span>{method}</span></label>)}
    </div></div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
      <small className={`ae-message ${message.includes("saved") ? "success" : "error"}`}>{message}</small>
      <button className="ae-button primary" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save product"}</button>
    </div>
  </article>;
}
