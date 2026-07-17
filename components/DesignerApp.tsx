"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ArtworkPlacement, CatalogProduct, DesignMode, DesignSide, ProductPackage, PublicShop, ShirtColor, SizeQuantity } from "@/lib/types";

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
  const [pkg, setPkg] = useState<ProductPackage>(products[0]?.configuration.packages[0]);
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
  const totalPrice = Number(pkg?.price || 0) + surcharge;
  const neededSides: DesignSide[] = mode === "front-back" ? ["front", "back"] : [mode];

  useEffect(() => { const send = () => window.parent.postMessage({ type: "printflow:resize", height: document.documentElement.scrollHeight }, "*"); send(); const observer = new ResizeObserver(send); observer.observe(document.body); return () => observer.disconnect(); }, []);

  function chooseProduct(next: CatalogProduct) {
    setProduct(next); setColor(next.configuration.colors.find((item) => item.active !== false) || next.configuration.colors[0]);
    const nextMode = next.configuration.customization.designModes[0] || "front"; setMode(nextMode); setSide(nextMode === "back" ? "back" : "front");
    setPkg(next.configuration.packages[0]); setSizes(next.configuration.sizes.map((size) => ({ size, quantity: 0 })));
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
    if (totalAssigned !== pkg.quantity) return setError(`Size quantities must total ${pkg.quantity}. You currently have ${totalAssigned}.`);
    setSubmitting(true);
    try {
      const sideUploads: Record<string, any> = {};
      for (const target of neededSides) { const state = target === "front" ? front : back; sideUploads[target] = { filename: state.file!.name, mimeType: state.file!.type, sizeBytes: state.file!.size, placement: state.placement }; }
      const startResponse = await fetch("/api/designs/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopSlug: shop.slug, customer, configuration: { productId: product.id, packageId: pkg.id, colorId: color.id, designMode: mode, decorationMethod: decoration, sizes, notes, totalPrice, surcharge }, artworks: sideUploads }) });
      const startData = await startResponse.json(); if (!startResponse.ok) throw new Error(startData.error || "Unable to begin submission.");
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      for (const target of neededSides) { const state = target === "front" ? front : back; const preview = await renderSide(target); const upload = startData.uploads[target];
        const originalResult = await supabase.storage.from(upload.original.bucket).uploadToSignedUrl(upload.original.path, upload.original.token, state.file!, { contentType: state.file!.type }); if (originalResult.error) throw originalResult.error;
        const previewResult = await supabase.storage.from(upload.preview.bucket).uploadToSignedUrl(upload.preview.path, upload.preview.token, preview, { contentType: "image/png" }); if (previewResult.error) throw previewResult.error;
      }
      const completeResponse = await fetch("/api/designs/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ designId: startData.designId }) }); const completeData = await completeResponse.json(); if (!completeResponse.ok) throw new Error(completeData.error || "Unable to complete submission."); setCompleted(completeData);
    } catch (err) { setError(err instanceof Error ? err.message : "Submission failed."); } finally { setSubmitting(false); }
  }

  if (!product) return <main className="designer-shell"><div className="designer-empty"><h1>No products are available yet.</h1></div></main>;
  if (completed) return <main className="designer-shell"><section className="designer-complete"><span>✓</span><p className="eyebrow">DESIGN RECEIVED</p><h1>{completed.displayId}</h1><p>{shop.settings.customerExperience?.confirmationMessage || "Your design is saved. Continue to payment to reserve production."}</p><a className="designer-primary" href={completed.checkoutUrl}>Continue to payment · ${totalPrice.toFixed(2)}</a></section></main>;

  return <main className="designer-shell" style={{ "--brand": shop.settings.brand.primaryColor, "--brand-text": shop.settings.brand.textColor } as React.CSSProperties}>
    <header className="customer-header">{shop.settings.brand.logoUrl ? <img src={shop.settings.brand.logoUrl} alt={shop.name}/> : <strong>{shop.name}</strong>}<div><small>Custom product studio</small><b>{step === "products" ? "Choose a product" : product.name}</b></div>{step === "customize" && <button onClick={() => setStep("products")}>Change product</button>}</header>
    {step === "products" ? <section className="product-first-flow"><div className="customer-intro"><p className="eyebrow">START YOUR ORDER</p><h1>{shop.settings.customerExperience?.headline || "Choose your blank, then make it yours."}</h1><p>{shop.settings.customerExperience?.introduction}</p></div><div className="customer-product-grid">{products.map((item) => { const firstColor = item.configuration.colors.find((c) => c.active !== false) || item.configuration.colors[0]; return <button className="customer-product-card" key={item.id} onClick={() => chooseProduct(item)}><div className="customer-product-image">{firstColor?.frontImageUrl || item.configuration.mockupImageUrl ? <img src={assetUrl(firstColor?.frontImageUrl || item.configuration.mockupImageUrl)} alt={item.name}/> : <div className="product-placeholder">T</div>}</div><div><span>{item.configuration.customization.category}</span><h2>{item.name}</h2><p>{item.description}</p><small>{item.configuration.colors.length} colors · {item.configuration.sizes.length} sizes · From ${Math.min(...item.configuration.packages.map((p) => p.price)).toFixed(2)}</small></div></button>; })}</div></section> :
    <section className="designer-workspace">
      <aside className="designer-controls">
        <div className="mobile-product-summary"><p className="eyebrow">CUSTOMIZING</p><h1>{product.name}</h1><p>{product.description}</p></div>
        <Control title="1. Design placement"><div className="design-mode-grid">{product.configuration.customization.designModes.map((value) => <button key={value} className={mode === value ? "selected" : ""} onClick={() => { setMode(value); setSide(value === "back" ? "back" : "front"); }}>{modeLabel(value)}</button>)}</div></Control>
        <Control title="2. Garment color"><div className="customer-color-grid">{product.configuration.colors.filter((item) => item.active !== false).map((item) => <button key={item.id} className={color.id === item.id ? "selected" : ""} onClick={() => setColor(item)}><i style={{ background: item.hex }}/><span>{item.name}</span></button>)}</div></Control>
        <Control title="3. Decoration"><select value={decoration} onChange={(e) => setDecoration(e.target.value)}>{product.configuration.customization.decorationMethods.map((item) => <option key={item}>{item}</option>)}</select></Control>
        <Control title="4. Package"><div className="customer-package-list">{product.configuration.packages.map((item) => <button key={item.id} className={pkg.id === item.id ? "selected" : ""} onClick={() => { setPkg(item); setSizes(product.configuration.sizes.map((size) => ({ size, quantity: 0 }))); }}><span>{item.label}</span><b>${(item.price + surcharge).toFixed(2)}</b></button>)}</div><small>Includes ${surcharge.toFixed(2)} for {modeLabel(mode).toLowerCase()}.</small></Control>
      </aside>

      <div className="design-stage-column">
        <div className="side-tabs">{neededSides.map((target) => <button key={target} className={side === target ? "selected" : ""} onClick={() => setSide(target)}>{target === "front" ? "Front" : "Back"}{(target === "front" ? front.file : back.file) ? <i>✓</i> : null}</button>)}</div>
        <div className="design-stage">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
            <rect width={W} height={H} fill="#f3f3f1"/>{garmentUrl ? <image href={garmentUrl} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet"/> : <path d="M255 150 110 245l75 135 78-42v330h274V338l78 42 75-135-145-95-65 55H320z" fill={color.hex} stroke="#bbb" strokeWidth="3"/>}
            <rect x={printArea.x} y={printArea.y} width={printArea.width} height={printArea.height} fill="none" stroke="rgba(0,0,0,.3)" strokeDasharray="10 8"/>
            {sideState.dataUrl && <g><image href={sideState.dataUrl} x={sideState.placement.x} y={sideState.placement.y} width={sideState.placement.width} height={sideState.placement.height} onPointerDown={(e) => begin("drag", e)} style={{ cursor: "move" }}/><rect x={sideState.placement.x} y={sideState.placement.y} width={sideState.placement.width} height={sideState.placement.height} fill="none" stroke="#111" strokeWidth="2" pointerEvents="none"/><circle cx={sideState.placement.x + sideState.placement.width} cy={sideState.placement.y + sideState.placement.height} r="13" fill="#111" onPointerDown={(e) => begin("resize", e)} style={{ cursor: "nwse-resize" }}/></g>}
          </svg>
          <div className="stage-upload"><label><input type="file" accept={shop.settings.upload.acceptedTypes.join(",")} onChange={(e) => handleArtwork(side, e.target.files?.[0])}/>{sideState.file ? `Replace ${side} artwork` : `Upload ${side} artwork`}</label>{sideState.file && <button onClick={() => setSideState(freshSide())}>Remove</button>}</div>
        </div>
        <p className="stage-help">{product.configuration.customization.customerInstructions}</p>
      </div>

      <aside className="order-panel">
        <p className="eyebrow">ORDER DETAILS</p><h2>Build your size run</h2><div className="size-quantity-grid">{sizes.map((item) => <label key={item.size}><span>{item.size}</span><input type="number" min="0" value={item.quantity || ""} onChange={(e) => updateSize(item.size, Number(e.target.value))}/></label>)}</div><div className={totalAssigned === pkg.quantity ? "quantity-total good" : "quantity-total"}><span>Assigned</span><b>{totalAssigned} / {pkg.quantity}</b></div>
        <div className="customer-fields"><input placeholder="Full name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })}/><input type="email" placeholder="Email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })}/><input placeholder="Phone (optional)" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}/><textarea rows={3} placeholder="Order notes" value={notes} onChange={(e) => setNotes(e.target.value)}/></div>
        <div className="order-price"><span>{pkg.label}</span><b>${pkg.price.toFixed(2)}</b><span>{modeLabel(mode)}</span><b>${surcharge.toFixed(2)}</b><strong>Total</strong><strong>${totalPrice.toFixed(2)}</strong></div>
        {error && <div className="error-message">{error}</div>}<button className="designer-primary full" disabled={submitting} onClick={submit}>{submitting ? "Saving design…" : `Continue · $${totalPrice.toFixed(2)}`}</button><small>{shop.settings.customerExperience?.artworkDisclaimer}</small>
      </aside>
    </section>}
  </main>;
}

function Control({ title, children }: { title: string; children: React.ReactNode }) { return <section className="customer-control"><h3>{title}</h3>{children}</section>; }
