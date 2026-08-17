"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { brandArtworkUrl } from "@/lib/brand-designs";
import {
  builderUnitPrice,
  compatibleDesign,
  designArtworkVariant,
  designOffer,
  designPlacementLabel,
  garmentRetailPrice,
  lockedPlacementFor
} from "@/lib/brand-builder";
import type { BrandDesign, BrandStoreProduct, PublicBrandShop } from "@/lib/brand-types";
import type { DesignSide, SizeQuantity } from "@/lib/types";

const W = 800;
const H = 800;

function assetUrl(url?: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname.endsWith("ssactivewear.com")) {
      return `/api/public/supplier-image?url=${encodeURIComponent(parsed.toString())}`;
    }
    return url;
  } catch {
    return url;
  }
}

function garmentImage(garment: BrandStoreProduct, colorId: string, side: DesignSide) {
  const color = garment.configuration.colors.find((item) => item.id === colorId) || garment.configuration.colors[0];
  return assetUrl(side === "back"
    ? color?.backImageUrl || garment.configuration.mockupImageUrl
    : color?.frontImageUrl || garment.configuration.mockupImageUrl);
}

function Composite({
  garment,
  colorId,
  side,
  design
}: {
  garment: BrandStoreProduct;
  colorId: string;
  side: DesignSide;
  design?: BrandDesign;
}) {
  const color = garment.configuration.colors.find((item) => item.id === colorId) || garment.configuration.colors[0];
  const placement = design ? lockedPlacementFor(design, garment) : undefined;
  const variant = design ? designArtworkVariant(design, color) : undefined;

  return (
    <div className="brand-builder-composite">
      <svg viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#f3f3ef" />
        {garmentImage(garment, color?.id || "", side) && (
          <image href={garmentImage(garment, color?.id || "", side)} x="28" y="28" width="744" height="744" preserveAspectRatio="xMidYMid meet" />
        )}
        {placement && placement.side === side && variant && (
          <image
            href={brandArtworkUrl(variant.id)}
            x={placement.placement.x}
            y={placement.placement.y}
            width={placement.placement.width}
            height={placement.placement.height}
          />
        )}
      </svg>
    </div>
  );
}

export default function BrandStorefront({ shop }: { shop: PublicBrandShop }) {
  const preview = shop.presentation === "preview";
  const compact = shop.presentation === "embed";
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [garmentId, setGarmentId] = useState("");
  const garment = shop.garments.find((item) => item.brandGarmentId === garmentId);
  const [colorId, setColorId] = useState("");
  const [frontDesignId, setFrontDesignId] = useState("");
  const [backDesignId, setBackDesignId] = useState("");
  const [previewSide, setPreviewSide] = useState<DesignSide>("front");
  const [sizes, setSizes] = useState<SizeQuantity[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const frontDesign = shop.brandDesigns.find((item) => item.id === frontDesignId);
  const backDesign = shop.brandDesigns.find((item) => item.id === backDesignId);

  const compatible = useMemo(
    () => garment ? shop.brandDesigns.filter((design) => compatibleDesign(design, garment)) : [],
    [shop.brandDesigns, garment]
  );
  const frontDesigns = compatible.filter((design) => designOffer(design).side === "front");
  const backDesigns = compatible.filter((design) => designOffer(design).side === "back");
  const unitPrice = garment ? builderUnitPrice(garment, frontDesign, backDesign) : 0;
  const totalQty = sizes.reduce((sum, item) => sum + item.quantity, 0);
  const total = unitPrice * totalQty;
  const selectedColor = garment?.configuration.colors.find((item) => item.id === colorId) || garment?.configuration.colors[0];

  useEffect(() => {
    if (!compact) return;
    const send = () => window.parent.postMessage({ type: "printflow:resize", height: document.documentElement.scrollHeight }, "*");
    send();
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [compact, step, garmentId, frontDesignId, backDesignId]);

  function chooseGarment(item: BrandStoreProduct) {
    const firstColor = item.configuration.colors.find((color) => color.active !== false) || item.configuration.colors[0];
    setGarmentId(item.brandGarmentId);
    setColorId(firstColor?.id || "");
    setFrontDesignId("");
    setBackDesignId("");
    setPreviewSide("front");
    setSizes(item.configuration.sizes.map((size) => ({ size, quantity: 0 })));
    setStep(2);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseDesign(design: BrandDesign) {
    const offer = designOffer(design);
    if (offer.side === "back") {
      setBackDesignId((current) => current === design.id ? "" : design.id);
      setPreviewSide("back");
    } else {
      setFrontDesignId((current) => current === design.id ? "" : design.id);
      setPreviewSide("front");
    }
  }

  function updateSize(size: string, quantity: number) {
    setSizes((current) => current.map((item) => item.size === size
      ? { ...item, quantity: Math.max(0, Math.floor(quantity || 0)) }
      : item));
  }

  async function renderSide(side: DesignSide) {
    if (!garment || !selectedColor) throw new Error("Choose a garment and color.");
    const design = side === "front" ? frontDesign : backDesign;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f3f3ef";
    ctx.fillRect(0, 0, W, H);

    const background = garmentImage(garment, selectedColor.id, side);
    if (background) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Unable to load ${side} garment mockup.`));
        img.src = background;
      });
      const scale = Math.min(W / img.width, H / img.height) * .92;
      ctx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale);
    }

    if (design) {
      const placement = lockedPlacementFor(design, garment);
      const variant = designArtworkVariant(design, selectedColor);
      if (placement && variant) {
        const art = new Image();
        art.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          art.onload = () => resolve();
          art.onerror = () => reject(new Error(`Unable to load ${side} design artwork.`));
          art.src = brandArtworkUrl(variant.id);
        });
        ctx.drawImage(art, placement.placement.x, placement.placement.y, placement.placement.width, placement.placement.height);
      }
    }

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to create mockup.")), "image/png", .95)
    );
  }

  async function checkout() {
    setError("");
    if (preview) return setError("Preview Mode does not create real orders.");
    if (!garment || !selectedColor) return setError("Choose a garment.");
    if (!frontDesign && !backDesign) return setError("Choose at least one design.");
    if (totalQty < 1) return setError("Choose at least one size.");
    if (!customer.name.trim() || !customer.email.trim()) return setError("Enter your name and email.");
    if (!shop.paymentReady) return setError("Checkout is not connected.");

    setBusy(true);
    try {
      const start = await fetch("/api/brand-orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug: shop.slug,
          brandGarmentId: garment.brandGarmentId,
          colorId: selectedColor.id,
          frontDesignId: frontDesign?.id || null,
          backDesignId: backDesign?.id || null,
          sizes,
          customer,
          notes
        })
      });
      const data = await start.json();
      if (!start.ok) throw new Error(data.error || "Unable to create Brand order.");

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );

      for (const side of ["front", "back"] as DesignSide[]) {
        const upload = data.previewUploads?.[side];
        if (!upload) continue;
        const mockup = await renderSide(side);
        const result = await supabase.storage
          .from(upload.bucket)
          .uploadToSignedUrl(upload.path, upload.token, mockup, { contentType: "image/png" });
        if (result.error) throw result.error;
      }

      const finish = await fetch("/api/designs/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: data.designId })
      });
      const complete = await finish.json();
      if (!finish.ok) throw new Error(complete.error || "Unable to prepare checkout.");
      window.location.href = complete.checkoutUrl;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
      setBusy(false);
    }
  }

  if (!shop.active && !preview) {
    return <main className="brand-builder-store"><section className="brand-builder-empty"><h1>{shop.business.name}</h1><p>This Brand store is currently unavailable.</p></section></main>;
  }

  return (
    <main className={`brand-builder-store ${compact ? "embed" : ""}`} style={{
      "--brand": shop.business.settings.primaryColor,
      "--brandText": shop.business.settings.textColor,
      "--surface": shop.business.settings.surfaceColor
    } as React.CSSProperties}>
      {preview && <div className="builder-preview-banner"><strong>PREVIEW MODE</strong><span>Draft Brand experience · checkout disabled</span><a href="/dashboard/brand-storefront">Store controls</a></div>}

      {!compact && <header className="builder-store-header">
        <div>{shop.business.settings.logoUrl ? <img src={shop.business.settings.logoUrl} alt={shop.business.name}/> : <strong>{shop.business.name}</strong>}</div>
        <span>Build Your Own</span>
      </header>}

      {!compact && <section className="builder-hero">
        <p>{shop.business.settings.heroBadge || "BUILD YOUR OWN"}</p>
        <h1>{shop.business.settings.headline || "Choose the garment. Choose the design. Make it yours."}</h1>
        <span>{shop.business.settings.introduction || "Start with a garment, then add an approved Brand design and see the finished piece before checkout."}</span>
      </section>}

      <nav className="builder-steps">
        <button className={step === 1 ? "active" : step > 1 ? "done" : ""} onClick={() => setStep(1)}><span>{step > 1 ? "✓" : "1"}</span><div><strong>Garment</strong><small>Choose your blank</small></div></button>
        <i/>
        <button className={step === 2 ? "active" : step > 2 ? "done" : ""} disabled={!garment} onClick={() => garment && setStep(2)}><span>{step > 2 ? "✓" : "2"}</span><div><strong>Design</strong><small>Build front & back</small></div></button>
        <i/>
        <button className={step === 3 ? "active" : ""} disabled={!garment || (!frontDesign && !backDesign)} onClick={() => garment && (frontDesign || backDesign) && setStep(3)}><span>3</span><div><strong>Order</strong><small>Sizes & checkout</small></div></button>
      </nav>

      {step === 1 && <section className="builder-step-panel garment-step">
        <header><div><small>STEP 01</small><h2>Choose a garment</h2><p>The garment price is the base of your item. You will add a design next.</p></div></header>
        <div className="builder-garment-grid">
          {shop.garments.map((item) => {
            const first = item.configuration.colors[0];
            return <button key={item.brandGarmentId} onClick={() => chooseGarment(item)}>
              <div className="garment-card-image">{first?.frontImageUrl || item.configuration.mockupImageUrl ? <img src={assetUrl(first?.frontImageUrl || item.configuration.mockupImageUrl)} alt={item.name}/> : <span>GARMENT</span>}</div>
              <div className="garment-card-copy"><small>{item.configuration.customization.category}</small><h3>{item.name}</h3><p>{item.description}</p><div><strong>${garmentRetailPrice(item).toFixed(2)}</strong><span>{item.configuration.colors.length} colors · {item.configuration.sizes.length} sizes</span></div></div>
            </button>;
          })}
        </div>
      </section>}

      {step === 2 && garment && <section className="builder-design-layout">
        <div className="builder-live-preview">
          <div className="preview-top">
            <button onClick={() => setStep(1)}>← Change garment</button>
            <div><button className={previewSide === "front" ? "active" : ""} onClick={() => setPreviewSide("front")}>Front</button><button className={previewSide === "back" ? "active" : ""} onClick={() => setPreviewSide("back")}>Back</button></div>
          </div>
          <Composite garment={garment} colorId={colorId} side={previewSide} design={previewSide === "front" ? frontDesign : backDesign}/>
          <div className="preview-color-row">
            <span>Garment color</span>
            <div>{garment.configuration.colors.map((item) => <button key={item.id} className={selectedColor?.id === item.id ? "active" : ""} title={item.name} onClick={() => setColorId(item.id)}><i style={{background:item.hex}}/></button>)}</div>
            <strong>{selectedColor?.name}</strong>
          </div>
          <div className="builder-price-summary">
            <div><span>{garment.name}</span><b>${garmentRetailPrice(garment).toFixed(2)}</b></div>
            {frontDesign && <div><span>{frontDesign.name} · {designPlacementLabel(frontDesign)}</span><b>+${designOffer(frontDesign).retailPrice.toFixed(2)}</b></div>}
            {backDesign && <div><span>{backDesign.name} · Back</span><b>+${designOffer(backDesign).retailPrice.toFixed(2)}</b></div>}
            <div className="total"><span>Price per item</span><b>${unitPrice.toFixed(2)}</b></div>
          </div>
        </div>

        <div className="builder-design-picker">
          <header><small>STEP 02</small><h2>Add your design</h2><p>Choose a front design, a back design, or both. Selecting another design for the same side replaces the previous one.</p></header>

          <section>
            <div className="design-section-title"><div><strong>Front designs</strong><small>Heart Size or Full Size</small></div>{frontDesign && <button onClick={() => setFrontDesignId("")}>Remove front</button>}</div>
            <div className="builder-design-grid">
              {frontDesigns.map((design) => {
                const offer = designOffer(design);
                const variant = designArtworkVariant(design, selectedColor);
                return <button key={design.id} className={frontDesignId === design.id ? "selected" : ""} onClick={() => chooseDesign(design)}>
                  <div className="design-art">{variant ? <img src={brandArtworkUrl(variant.id)} alt={design.name}/> : <span>No artwork</span>}</div>
                  <div><small>{offer.printSize === "heart" ? "HEART SIZE" : "FULL FRONT"}</small><h3>{design.name}</h3><strong>+${offer.retailPrice.toFixed(2)}</strong></div>
                </button>;
              })}
              {!frontDesigns.length && <p className="design-empty">No front designs are approved for this garment yet.</p>}
            </div>
          </section>

          {garment.configuration.customization.backEnabled !== false && <section>
            <div className="design-section-title"><div><strong>Back designs</strong><small>Full Back</small></div>{backDesign && <button onClick={() => setBackDesignId("")}>Remove back</button>}</div>
            <div className="builder-design-grid">
              {backDesigns.map((design) => {
                const offer = designOffer(design);
                const variant = designArtworkVariant(design, selectedColor);
                return <button key={design.id} className={backDesignId === design.id ? "selected" : ""} onClick={() => chooseDesign(design)}>
                  <div className="design-art">{variant ? <img src={brandArtworkUrl(variant.id)} alt={design.name}/> : <span>No artwork</span>}</div>
                  <div><small>FULL BACK</small><h3>{design.name}</h3><strong>+${offer.retailPrice.toFixed(2)}</strong></div>
                </button>;
              })}
              {!backDesigns.length && <p className="design-empty">No back designs are approved for this garment yet.</p>}
            </div>
          </section>}

          <button className="builder-primary" disabled={!frontDesign && !backDesign} onClick={() => setStep(3)}>Continue with this design · ${unitPrice.toFixed(2)}</button>
        </div>
      </section>}

      {step === 3 && garment && (frontDesign || backDesign) && <section className="builder-review-layout">
        <div className="review-mockups">
          <div className="review-side-tabs"><button className={previewSide === "front" ? "active":""} onClick={() => setPreviewSide("front")}>Front</button><button className={previewSide === "back" ? "active":""} onClick={() => setPreviewSide("back")}>Back</button></div>
          <Composite garment={garment} colorId={colorId} side={previewSide} design={previewSide === "front" ? frontDesign : backDesign}/>
          <small>This mockup is saved with your order for production review.</small>
        </div>
        <div className="review-order">
          <header><small>STEP 03</small><h2>Finish your order</h2><p>{garment.name} · {selectedColor?.name}</p></header>
          <section><strong>Sizes & quantities</strong><div className="builder-size-grid">{sizes.map((item) => <label key={item.size}><span>{item.size}</span><div><button onClick={() => updateSize(item.size,item.quantity-1)}>−</button><input type="number" min="0" value={item.quantity||""} onChange={(e)=>updateSize(item.size,Number(e.target.value))}/><button onClick={()=>updateSize(item.size,item.quantity+1)}>+</button></div></label>)}</div></section>
          <section className="order-contact"><strong>Contact</strong><input placeholder="Full name" value={customer.name} onChange={(e)=>setCustomer({...customer,name:e.target.value})}/><input type="email" placeholder="Email" value={customer.email} onChange={(e)=>setCustomer({...customer,email:e.target.value})}/><input placeholder="Phone (optional)" value={customer.phone} onChange={(e)=>setCustomer({...customer,phone:e.target.value})}/><textarea rows={2} placeholder="Order note (optional)" value={notes} onChange={(e)=>setNotes(e.target.value)}/></section>
          <section className="final-price"><div><span>Garment</span><b>${garmentRetailPrice(garment).toFixed(2)}</b></div>{frontDesign&&<div><span>{frontDesign.name}</span><b>+${designOffer(frontDesign).retailPrice.toFixed(2)}</b></div>}{backDesign&&<div><span>{backDesign.name}</span><b>+${designOffer(backDesign).retailPrice.toFixed(2)}</b></div>}<div><span>Unit price</span><b>${unitPrice.toFixed(2)}</b></div><div><span>{totalQty} item{totalQty===1?"":"s"}</span><b>${total.toFixed(2)}</b></div></section>
          {error && <div className="builder-error">{error}</div>}
          <button className="builder-primary" disabled={busy || totalQty<1 || (!preview&&!shop.paymentReady)} onClick={checkout}>{preview?"Preview Mode · Checkout disabled":busy?"Preparing checkout…":`Checkout · $${total.toFixed(2)}`}</button>
          <button className="builder-link" onClick={()=>setStep(2)}>← Edit designs</button>
        </div>
      </section>}

      <style jsx>{`
        .brand-builder-store{min-height:100vh;padding:14px;background:var(--surface,#f3f3ef);color:#171717}.brand-builder-store.embed{min-height:0;padding:0;background:transparent}.builder-preview-banner{display:flex;justify-content:space-between;align-items:center;gap:12px;max-width:1380px;margin:0 auto 8px;padding:9px 12px;border-radius:9px;background:#1f2947;color:#fff}.builder-preview-banner strong{font-size:7px;letter-spacing:.12em}.builder-preview-banner span{font-size:7px;color:#ccd2e3}.builder-preview-banner a{color:#fff;font-size:7px}.builder-store-header{display:flex;justify-content:space-between;align-items:center;max-width:1380px;margin:0 auto;padding:12px 14px;border-radius:12px;background:#fff}.builder-store-header img{max-height:34px;max-width:160px}.builder-store-header>span{font-size:7px;letter-spacing:.12em;color:#888}.builder-hero{max-width:1380px;margin:8px auto;padding:clamp(28px,6vw,70px);border-radius:16px;background:#fff}.builder-hero p{margin:0 0 8px;color:var(--brand);font-size:8px;font-weight:900;letter-spacing:.12em}.builder-hero h1{max-width:900px;margin:0;font-size:clamp(42px,6vw,78px);line-height:.92;letter-spacing:-.055em}.builder-hero>span{display:block;max-width:650px;margin-top:12px;color:#717171;line-height:1.5}.builder-steps{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;max-width:900px;margin:10px auto;padding:5px;border-radius:12px;background:#e9e9e4}.builder-steps>i{width:24px;height:1px;background:#c9c9c4}.builder-steps button{display:grid;grid-template-columns:26px 1fr;gap:7px;align-items:center;padding:8px;border:0;border-radius:8px;background:transparent;color:#777;text-align:left}.builder-steps button.active,.builder-steps button.done{background:#fff;color:#171717}.builder-steps button>span{display:grid;place-items:center;width:25px;height:25px;border-radius:99px;background:#d9d9d4;font-size:7px;font-weight:900}.builder-steps button.active>span{background:var(--brand);color:var(--brandText)}.builder-steps strong,.builder-steps small{display:block}.builder-steps strong{font-size:8px}.builder-steps small{font-size:6px}.builder-step-panel,.builder-design-layout,.builder-review-layout{max-width:1380px;margin:0 auto}.builder-step-panel{padding:18px;border-radius:15px;background:#fff}.builder-step-panel>header small,.builder-design-picker header small,.review-order header small{font-size:7px;font-weight:900;letter-spacing:.11em;color:#888}.builder-step-panel h2,.builder-design-picker h2,.review-order h2{margin:3px 0;font-size:27px}.builder-step-panel header p,.builder-design-picker header p,.review-order header p{margin:0;color:#777}.builder-garment-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.builder-garment-grid>button{padding:0;border:1px solid #e2e2dd;border-radius:12px;background:#fff;color:#171717;text-align:left;overflow:hidden}.garment-card-image{height:270px;background:#f3f3ef}.garment-card-image img{width:100%;height:100%;object-fit:contain}.garment-card-image span{display:grid;place-items:center;height:100%;color:#aaa}.garment-card-copy{padding:10px}.garment-card-copy small{font-size:6px;color:#888}.garment-card-copy h3{margin:3px 0;font-size:13px}.garment-card-copy p{min-height:28px;margin:3px 0 9px;color:#777;font-size:7px}.garment-card-copy>div{display:flex;justify-content:space-between;align-items:baseline}.garment-card-copy strong{font-size:15px}.garment-card-copy span{font-size:7px;color:#888}.builder-design-layout{display:grid;grid-template-columns:minmax(360px,.8fr) minmax(0,1.2fr);gap:10px;align-items:start}.builder-live-preview,.builder-design-picker,.review-mockups,.review-order{border-radius:15px;background:#fff}.builder-live-preview{position:sticky;top:10px;padding:10px}.preview-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}.preview-top>button,.preview-top div button{padding:6px 8px;border:0;border-radius:7px;background:#f1f1ed;font-size:7px}.preview-top div{display:flex;gap:4px}.preview-top div button.active{background:#171717;color:#fff}:global(.brand-builder-composite svg){display:block;width:100%;max-height:560px}.preview-color-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:8px 2px}.preview-color-row>span,.preview-color-row>strong{font-size:7px}.preview-color-row>div{display:flex;gap:4px;flex-wrap:wrap}.preview-color-row button{display:grid;place-items:center;width:22px;height:22px;border:1px solid #ddd;border-radius:99px;background:#fff}.preview-color-row button.active{border:2px solid #171717}.preview-color-row i{width:14px;height:14px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}.builder-price-summary{padding:9px;border-radius:9px;background:#f4f4f0}.builder-price-summary>div{display:flex;justify-content:space-between;padding:4px 0;font-size:8px}.builder-price-summary .total{margin-top:4px;padding-top:8px;border-top:1px solid #ddd;font-weight:900}.builder-design-picker{padding:18px}.builder-design-picker>section{margin-top:18px;padding-top:15px;border-top:1px solid #eee}.design-section-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.design-section-title strong,.design-section-title small{display:block}.design-section-title strong{font-size:10px}.design-section-title small{font-size:7px;color:#888}.design-section-title>button{border:0;background:transparent;color:#9a4d43;font-size:7px}.builder-design-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.builder-design-grid>button{padding:0;border:1px solid #e1e1dc;border-radius:10px;background:#fff;color:#171717;text-align:left;overflow:hidden}.builder-design-grid>button.selected{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand)}.design-art{height:150px;padding:15px;background:#f3f3ef}.design-art img{width:100%;height:100%;object-fit:contain}.builder-design-grid>button>div:last-child{padding:8px}.builder-design-grid small{font-size:6px;color:#888}.builder-design-grid h3{min-height:25px;margin:3px 0;font-size:10px}.builder-design-grid strong{font-size:10px}.design-empty{grid-column:1/-1;padding:18px;border-radius:9px;background:#f3f3ef;color:#777;font-size:8px}.builder-primary{width:100%;margin-top:15px;padding:12px;border:0;border-radius:9px;background:var(--brand);color:var(--brandText);font-weight:900}.builder-primary:disabled{opacity:.4}.builder-review-layout{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:10px;align-items:start}.review-mockups{position:sticky;top:10px;padding:10px}.review-side-tabs{display:flex;gap:4px;margin-bottom:6px}.review-side-tabs button{padding:6px 12px;border:0;border-radius:7px;background:#eee;font-size:7px}.review-side-tabs button.active{background:#171717;color:#fff}.review-mockups>small{display:block;padding:8px;color:#888;text-align:center;font-size:6px}.review-order{display:grid;gap:13px;padding:18px}.review-order>section{display:grid;gap:7px;padding-top:12px;border-top:1px solid #eee}.review-order>section>strong{font-size:9px}.builder-size-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.builder-size-grid label{display:grid;gap:4px;padding:6px;border-radius:8px;background:#f3f3ef}.builder-size-grid label>span{font-size:8px;font-weight:850}.builder-size-grid label>div{display:grid;grid-template-columns:22px 1fr 22px}.builder-size-grid button{border:0;background:#fff}.builder-size-grid input{min-width:0;width:100%;border:0;text-align:center}.order-contact input,.order-contact textarea{width:100%;box-sizing:border-box}.final-price>div{display:flex;justify-content:space-between;font-size:8px}.final-price>div:last-child{padding-top:8px;border-top:1px solid #ddd;font-size:11px}.builder-error{padding:8px;border-radius:7px;background:#fff0ef;color:#9a3830;font-size:8px}.builder-link{border:0;background:transparent;color:#777;font-size:7px}.brand-builder-empty{display:grid;place-items:center;min-height:60vh;text-align:center}.embed .builder-steps{margin-top:0}.embed .builder-step-panel,.embed .builder-design-layout,.embed .builder-review-layout{max-width:none}
        @media(max-width:950px){.builder-design-layout,.builder-review-layout{grid-template-columns:1fr}.builder-live-preview,.review-mockups{position:static}.builder-garment-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:650px){.brand-builder-store{padding:6px}.builder-store-header{padding:9px}.builder-hero{padding:30px 20px}.builder-hero h1{font-size:44px}.builder-steps{grid-template-columns:1fr 1fr 1fr}.builder-steps>i{display:none}.builder-steps button{grid-template-columns:22px 1fr}.builder-garment-grid{grid-template-columns:repeat(2,1fr);gap:5px}.garment-card-image{height:190px}.builder-design-grid{grid-template-columns:repeat(2,1fr)}.builder-design-picker{padding:12px}.builder-size-grid{grid-template-columns:repeat(2,1fr)}}
      `}</style>
    </main>
  );
}
