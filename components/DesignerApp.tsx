"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { pricingForQuantity } from "@/lib/catalog";
import type { ArtworkPlacement, CatalogProduct, DesignMode, DesignSide, PublicShop, ShirtColor, SizeQuantity } from "@/lib/types";

const W = 800; const H = 800;
const emptyPlacement: ArtworkPlacement = { x: 280, y: 260, width: 240, height: 240, rotation: 0 };
type SideState = { file: File | null; dataUrl: string; placement: ArtworkPlacement };
const freshSide = (): SideState => ({ file: null, dataUrl: "", placement: { ...emptyPlacement } });

function assetUrl(url?: string) {
  if (!url) return "";
  try { const parsed = new URL(url, window.location.origin); if (parsed.hostname.endsWith("ssactivewear.com")) return `/api/public/supplier-image?url=${encodeURIComponent(parsed.toString())}`; return url; } catch { return url; }
}
function modeLabel(mode: DesignMode) { return mode === "front" ? "Front only" : mode === "back" ? "Back only" : "Front + back"; }

export default function DesignerApp({ shop }: { shop: PublicShop }) {
  const products = shop.products.filter((item) => item.active);
  const [step, setStep] = useState<"products" | "customize">("products");
  const [product, setProduct] = useState<CatalogProduct>(products[0]);
  const [color, setColor] = useState<ShirtColor>(products[0]?.configuration.colors[0]);
  const [mode, setMode] = useState<DesignMode>(products[0]?.configuration.customization.designModes[0] || "front");
  const [side, setSide] = useState<DesignSide>("front");
  const [sizes, setSizes] = useState<SizeQuantity[]>(products[0]?.configuration.sizes.map((size) => ({ size, quantity: 0 })) || []);
  const [decoration, setDecoration] = useState(products[0]?.configuration.customization.decorationMethods[0] || "Screen Print");
  const [front, setFront] = useState<SideState>(freshSide()); const [back, setBack] = useState<SideState>(freshSide());
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" }); const [notes, setNotes] = useState("");
  const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false); const [completed, setCompleted] = useState<{ displayId: string; checkoutUrl: string } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null); const dragRef = useRef<any>(null);

  const sideState = side === "front" ? front : back;
  const setSideState = side === "front" ? setFront : setBack;
  const printArea = side === "front" ? product.configuration.customization.frontPrintArea : product.configuration.customization.backPrintArea;
  const garmentUrl = assetUrl(side === "front" ? color?.frontImageUrl || product.configuration.mockupImageUrl : color?.backImageUrl || product.configuration.mockupImageUrl);
  const totalAssigned = useMemo(() => sizes.reduce((sum, item) => sum + item.quantity, 0), [sizes]);
  const surcharge = mode === "front" ? product.configuration.customization.frontSurcharge : mode === "back" ? product.configuration.customization.backSurcharge : product.configuration.customization.twoSideSurcharge;
  const pricing = pricingForQuantity(product?.configuration.packages || [], totalAssigned || product?.configuration.customization.minimumQuantity || 12);
  const totalPrice = pricing.basePrice + surcharge;
  const minimum = product?.configuration.customization.minimumQuantity || 12;
  const neededSides: DesignSide[] = mode === "front-back" ? ["front", "back"] : [mode];

  useEffect(() => { const send = () => window.parent.postMessage({ type: "printflow:resize", height: document.documentElement.scrollHeight }, "*"); send(); const observer = new ResizeObserver(send); observer.observe(document.body); return () => observer.disconnect(); }, []);

  function chooseProduct(next: CatalogProduct) {
    setProduct(next); setColor(next.configuration.colors.find((item) => item.active !== false) || next.configuration.colors[0]);
    const nextMode = next.configuration.customization.designModes[0] || "front"; setMode(nextMode); setSide(nextMode === "back" ? "back" : "front");
    setSizes(next.configuration.sizes.map((size) => ({ size, quantity: 0 })));
    setDecoration(next.configuration.customization.decorationMethods[0] || "Screen Print"); setFront(freshSide()); setBack(freshSide()); setStep("customize"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleArtwork(target: DesignSide, file?: File) {
    if (!file) return; setError("");
    if (!shop.settings.upload.acceptedTypes.includes(file.type)) return setError("That artwork file type is not accepted.");
    if (file.size > shop.settings.upload.maxBytes) return setError("Artwork is larger than this shop allows.");
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = new Image(); image.src = dataUrl; await image.decode();
    const area = target === "front" ? product.configuration.customization.frontPrintArea : product.configuration.customization.backPrintArea;
    const ratio = Math.min((area.width * .72) / image.width, (area.height * .72) / image.height, 1);
    const placement = { x: area.x + (area.width - image.width * ratio) / 2, y: area.y + (area.height - image.height * ratio) / 2, width: image.width * ratio, height: image.height * ratio, rotation: 0 };
    (target === "front" ? setFront : setBack)({ file, dataUrl, placement });
  }

  function point(event: ReactPointerEvent<SVGElement>) { const rect = svgRef.current!.getBoundingClientRect(); return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H }; }
  function begin(kind: "drag" | "resize", event: ReactPointerEvent<SVGElement>) { if (!sideState.dataUrl) return; event.preventDefault(); const p = point(event); dragRef.current = { kind, p, placement: { ...sideState.placement } }; event.currentTarget.setPointerCapture(event.pointerId); }
  function move(event: ReactPointerEvent<SVGElement>) { if (!dragRef.current) return; const current = point(event); const dx = current.x - dragRef.current.p.x; const dy = current.y - dragRef.current.p.y; const start = dragRef.current.placement;
    if (dragRef.current.kind === "drag") setSideState((state) => ({ ...state, placement: { ...state.placement, x: Math.max(printArea.x, Math.min(printArea.x + printArea.width - start.width, start.x + dx)), y: Math.max(printArea.y, Math.min(printArea.y + printArea.height - start.height, start.y + dy)) } }));
    else { let width = Math.max(50, Math.min(printArea.x + printArea.width - start.x, start.width + dx)); let height = width * (start.height / start.width); if (height > printArea.y + printArea.height - start.y) { height = printArea.y + printArea.height - start.y; width = height * (start.width / start.height); } setSideState((state) => ({ ...state, placement: { ...state.placement, width, height } })); }
  }
  function end() { dragRef.current = null; }
  function updateSize(size: string, quantity: number) { setSizes((current) => current.map((item) => item.size === size ? { ...item, quantity: Math.max(0, Math.floor(quantity || 0)) } : item)); }

  async function renderSide(target: DesignSide) {
    const state = target === "front" ? front : back; const url = assetUrl(target === "front" ? color.frontImageUrl || product.configuration.mockupImageUrl : color.backImageUrl || product.configuration.mockupImageUrl);
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H; const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#f5f5f5"; ctx.fillRect(0, 0, W, H);
    if (url) { const img = new Image(); img.crossOrigin = "anonymous"; img.src = url; await img.decode(); const scale = Math.min(W / img.width, H / img.height) * .92; ctx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale); }
    if (state.dataUrl) { const art = new Image(); art.src = state.dataUrl; await art.decode(); ctx.drawImage(art, state.placement.x, state.placement.y, state.placement.width, state.placement.height); }
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Preview failed.")), "image/png", .92));
  }

  async function submit() {
    setError(""); if (neededSides.some((target) => !(target === "front" ? front.file : back.file))) return setError(`Upload artwork for ${neededSides.join(" and ")}.`);
    if (!customer.name.trim() || !customer.email.trim()) return setError("Enter your name and email.");
    if (totalAssigned < minimum) return setError(`Your order must include at least ${minimum} items. You currently have ${totalAssigned}.`);
    setSubmitting(true);
    try {
      const sideUploads: Record<string, any> = {};
      for (const target of neededSides) { const state = target === "front" ? front : back; sideUploads[target] = { filename: state.file!.name, mimeType: state.file!.type, sizeBytes: state.file!.size, placement: state.placement }; }
      const startResponse = await fetch("/api/designs/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopSlug: shop.slug, customer, configuration: { productId: product.id, packageId: pricing.tier?.id || "", colorId: color.id, designMode: mode, decorationMethod: decoration, sizes, notes, totalPrice, surcharge, quantity: totalAssigned }, artworks: sideUploads }) });
      const startData = await startResponse.json(); if (!startResponse.ok) throw new Error(startData.error || "Unable to begin submission.");
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      for (const target of neededSides) { const state = target === "front" ? front : back; const preview = await renderSide(target); const upload = startData.uploads[target];
        const originalResult = await supabase.storage.from(upload.original.bucket).uploadToSignedUrl(upload.original.path, upload.original.token, state.file!, { contentType: state.file!.type }); if (originalResult.error) throw originalResult.error;
        const previewResult = await supabase.storage.from(upload.preview.bucket).uploadToSignedUrl(upload.preview.path, upload.preview.token, preview, { contentType: "image/png" }); if (previewResult.error) throw previewResult.error;
      }
      const finishResponse = await fetch("/api/designs/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designId: startData.designId }) }); const finishData = await finishResponse.json(); if (!finishResponse.ok) throw new Error(finishData.error || "Unable to complete submission."); setCompleted({ displayId: startData.displayId, checkoutUrl: finishData.checkoutUrl });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to submit design."); } finally { setSubmitting(false); }
  }

  if (!products.length) return <main className="designer-empty"><h1>No products are available yet.</h1></main>;
  if (completed) return <main className="designer-complete"><span>✓</span><h1>Your design is ready.</h1><p>Reference {completed.displayId}</p><a className="designer-primary" href={completed.checkoutUrl}>Continue to payment · ${totalPrice.toFixed(2)}</a></main>;

  return <main className="designer-shell modern-customer-shell" style={{ "--brand": shop.settings.brand.primaryColor, "--brand-text": shop.settings.brand.textColor } as React.CSSProperties}>
    <header className="customer-header modern">{shop.settings.brand.logoUrl ? <img src={shop.settings.brand.logoUrl} alt={shop.name}/> : <strong>{shop.name}</strong>}<div><small>Custom order studio</small><b>{step === "products" ? "Choose a product" : product.name}</b></div>{step === "customize" && <button onClick={() => setStep("products")}>← Products</button>}</header>

    {step === "products" ? <section className="product-first-flow modern"><div className="customer-intro"><p className="eyebrow">START YOUR ORDER</p><h1>{shop.settings.customerExperience?.headline || "Choose your blank. Make it yours."}</h1><p>{shop.settings.customerExperience?.introduction || "Select a product to see colors, print options, and live pricing."}</p></div><div className="customer-product-grid modern">{products.map((item) => { const firstColor = item.configuration.colors.find((c) => c.active !== false) || item.configuration.colors[0]; const min=item.configuration.customization.minimumQuantity; const price=pricingForQuantity(item.configuration.packages,min); return <button className="customer-product-card modern" key={item.id} onClick={() => chooseProduct(item)}><div className="customer-product-image">{firstColor?.frontImageUrl || item.configuration.mockupImageUrl ? <img src={assetUrl(firstColor?.frontImageUrl || item.configuration.mockupImageUrl)} alt={item.name}/> : <div className="product-placeholder">T</div>}<span className="product-card-arrow">→</span></div><div><span>{item.configuration.customization.category}</span><h2>{item.name}</h2><p>{item.description}</p><div className="product-card-meta"><small>{item.configuration.colors.length} colors</small><small>{item.configuration.sizes.length} sizes</small><small>Min. {min}</small></div><strong>From ${price.unitPrice.toFixed(2)} each</strong></div></button>; })}</div></section> :
    <section className="modern-designer-layout">
      <aside className="designer-step-panel">
        <div className="designer-step-heading"><p className="eyebrow">CUSTOMIZE</p><h1>{product.name}</h1><p>{product.description}</p></div>
        <WizardSection number="1" title="Print sides"><div className="radio-card-grid">{product.configuration.customization.designModes.map((value) => <label key={value} className={mode===value?"radio-card selected":"radio-card"}><input type="radio" name="mode" checked={mode===value} onChange={()=>{setMode(value);setSide(value==="back"?"back":"front")}}/><span><b>{modeLabel(value)}</b><small>{value==="front-back"?"Upload separate artwork for both sides.":`Artwork on the ${value} only.`}</small></span><i/></label>)}</div></WizardSection>
        <WizardSection number="2" title="Garment color"><div className="modern-color-picker">{product.configuration.colors.filter((item)=>item.active!==false).map((item)=><button key={item.id} className={color.id===item.id?"selected":""} onClick={()=>setColor(item)} title={item.name}><i style={{background:item.hex}}/><span>{item.name}</span></button>)}</div></WizardSection>
        <WizardSection number="3" title="Decoration"><select className="modern-select" value={decoration} onChange={(e)=>setDecoration(e.target.value)}>{product.configuration.customization.decorationMethods.map((item)=><option key={item}>{item}</option>)}</select></WizardSection>
      </aside>

      <div className="modern-stage-column">
        <div className="stage-topbar"><div className="side-tabs modern">{neededSides.map((target)=><button key={target} className={side===target?"selected":""} onClick={()=>setSide(target)}>{target==="front"?"Front":"Back"}{(target==="front"?front.file:back.file)?<i>✓</i>:null}</button>)}</div><span>Print area: {printArea.widthInches?.toFixed(1)}″ × {printArea.heightInches?.toFixed(1)}″</span></div>
        <div className="design-stage modern"><svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><rect width={W} height={H} fill="#f6f6f3"/>{garmentUrl ? <image href={garmentUrl} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet"/> : <path d="M255 150 110 245l75 135 78-42v330h274V338l78 42 75-135-145-95-65 55H320z" fill={color.hex} stroke="#bbb" strokeWidth="3"/>}<rect x={printArea.x} y={printArea.y} width={printArea.width} height={printArea.height} rx="6" fill="rgba(255,255,255,.08)" stroke="rgba(0,0,0,.45)" strokeDasharray="10 8"/>{sideState.dataUrl && <g><image href={sideState.dataUrl} x={sideState.placement.x} y={sideState.placement.y} width={sideState.placement.width} height={sideState.placement.height} onPointerDown={(e)=>begin("drag",e)} style={{cursor:"move"}}/><rect x={sideState.placement.x} y={sideState.placement.y} width={sideState.placement.width} height={sideState.placement.height} fill="none" stroke="#111" strokeWidth="2" pointerEvents="none"/><circle cx={sideState.placement.x+sideState.placement.width} cy={sideState.placement.y+sideState.placement.height} r="13" fill="#111" onPointerDown={(e)=>begin("resize",e)} style={{cursor:"nwse-resize"}}/></g>}</svg><div className="stage-upload modern"><label><input type="file" accept={shop.settings.upload.acceptedTypes.join(",")} onChange={(e)=>handleArtwork(side,e.target.files?.[0])}/>{sideState.file?`Replace ${side} artwork`:`Upload ${side} artwork`}</label>{sideState.file&&<button onClick={()=>setSideState(freshSide())}>Remove</button>}</div></div>
        <p className="stage-help modern">{product.configuration.customization.customerInstructions}</p>
      </div>

      <aside className="modern-order-panel">
        <div><p className="eyebrow">ORDER DETAILS</p><h2>Choose quantities</h2><p>Order any amount. The minimum is {minimum} items.</p></div>
        <div className="modern-size-grid">{sizes.map((item)=><label key={item.size}><span>{item.size}</span><div><button onClick={()=>updateSize(item.size,item.quantity-1)}>−</button><input type="number" min="0" value={item.quantity||""} onChange={(e)=>updateSize(item.size,Number(e.target.value))}/><button onClick={()=>updateSize(item.size,item.quantity+1)}>+</button></div></label>)}</div>
        <div className={totalAssigned>=minimum?"modern-quantity-status good":"modern-quantity-status"}><span>Total quantity</span><b>{totalAssigned}</b><small>{totalAssigned>=minimum?"Minimum reached":`${minimum-totalAssigned} more needed`}</small></div>
        <div className="live-price-card"><div><span>Rate</span><b>${pricing.unitPrice.toFixed(2)} each</b></div><div><span>{totalAssigned||minimum} garments</span><b>${pricing.basePrice.toFixed(2)}</b></div><div><span>{modeLabel(mode)}</span><b>${surcharge.toFixed(2)}</b></div><div className="total"><span>Estimated total</span><b>${totalPrice.toFixed(2)}</b></div></div>
        <details className="customer-details" open><summary>Contact & notes</summary><div><input placeholder="Full name" value={customer.name} onChange={(e)=>setCustomer({...customer,name:e.target.value})}/><input type="email" placeholder="Email" value={customer.email} onChange={(e)=>setCustomer({...customer,email:e.target.value})}/><input placeholder="Phone (optional)" value={customer.phone} onChange={(e)=>setCustomer({...customer,phone:e.target.value})}/><textarea rows={3} placeholder="Order notes" value={notes} onChange={(e)=>setNotes(e.target.value)}/></div></details>
        {error&&<div className="error-message">{error}</div>}<button className="designer-primary full modern" disabled={submitting||totalAssigned<minimum} onClick={submit}>{submitting?"Saving design…":`Continue · $${totalPrice.toFixed(2)}`}</button><small className="disclaimer">{shop.settings.customerExperience?.artworkDisclaimer}</small>
      </aside>
    </section>}
  </main>;
}

function WizardSection({number,title,children}:{number:string;title:string;children:React.ReactNode}){return <section className="wizard-section"><header><span>{number}</span><h3>{title}</h3></header>{children}</section>}
