"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const methods = ["Screen Printing", "DTF", "Embroidery"];

export default function AdvancedAdminProductManager({ product }: { product: any }) {
  const router = useRouter();
  const [name, setName] = useState(product.name || "");
  const [active, setActive] = useState(product.active !== false);
  const [minimumQuantity, setMinimumQuantity] = useState(Number(product.configuration?.customization?.minimumQuantity || 1));
  const [decorationMethods, setDecorationMethods] = useState<string[]>(product.configuration?.customization?.decorationMethods || []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const supplier = product.configuration?.supplier;
  const image = product.configuration?.mockupImageUrl || product.configuration?.colors?.find((c:any) => c.active !== false)?.frontImageUrl;
  const dirty = name !== product.name || active !== product.active || minimumQuantity !== Number(product.configuration?.customization?.minimumQuantity || 1) || JSON.stringify(decorationMethods) !== JSON.stringify(product.configuration?.customization?.decorationMethods || []);

  function toggleMethod(method: string) {
    setDecorationMethods((current) => current.includes(method) ? current.filter((x) => x !== method) : [...current, method]);
  }

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/advanced-admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, active, minimumQuantity, decorationMethods })
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
