"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { brandArtworkUrl } from "@/lib/brand-designs";
import {
  builderUnitPrice,
  compatibleDesignsForPlacement,
  defaultDecoratedSelection,
  designArtworkVariant,
  placementDefinition,
  placementLabel
} from "@/lib/brand-builder";
import type {
  BrandDesign,
  BrandPlacementKey,
  BrandStoreProduct,
  PublicBrandShop
} from "@/lib/brand-types";
import type { DesignSide, SizeQuantity } from "@/lib/types";

const W = 800;
const H = 800;
type FrontPlacementKey = Extract<BrandPlacementKey, "front-heart" | "front-full">;

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
  design,
  placementKey
}: {
  garment: BrandStoreProduct;
  colorId: string;
  side: DesignSide;
  design?: BrandDesign;
  placementKey?: BrandPlacementKey;
}) {
  const color = garment.configuration.colors.find((item) => item.id === colorId) || garment.configuration.colors[0];
  const placement = design && placementKey
    ? design.productRules.find((item) => item.productId === garment.id)?.placements?.[placementKey]
    : undefined;
  const variant = design ? designArtworkVariant(design, color) : undefined;

  return (
    <div className="brand-builder-composite">
      <svg viewBox="0 0 800 800">
        <rect width="800" height="800" fill="#f5f5f2" />
        {garmentImage(garment, color?.id || "", side) && (
          <image href={garmentImage(garment, color?.id || "", side)} x="28" y="28" width="744" height="744" preserveAspectRatio="xMidYMid meet" />
        )}
        {placement?.enabled && placement.side === side && variant && (
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
  const [activePlacement, setActivePlacement] = useState<BrandPlacementKey>("front-full");
  const [frontDesignId, setFrontDesignId] = useState("");
  const [frontPlacement, setFrontPlacement] = useState<FrontPlacementKey | undefined>();
  const [backDesignId, setBackDesignId] = useState("");
  const [previewSide, setPreviewSide] = useState<DesignSide>("front");
  const [sizes, setSizes] = useState<SizeQuantity[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const frontDesign = shop.brandDesigns.find((item) => item.id === frontDesignId);
  const backDesign = shop.brandDesigns.find((item) => item.id === backDesignId);
  const selectedColor = garment?.configuration.colors.find((item) => item.id === colorId) || garment?.configuration.colors[0];

  const designsForPlacement = useMemo(() => {
    if (!garment) return [];
    return compatibleDesignsForPlacement(shop.brandDesigns, garment, activePlacement);
  }, [shop.brandDesigns, garment, activePlacement]);

  const placementAvailability = useMemo(() => {
    if (!garment) return { "front-heart": false, "front-full": false, "back-full": false };
    return {
      "front-heart": compatibleDesignsForPlacement(shop.brandDesigns, garment, "front-heart").length > 0,
      "front-full": compatibleDesignsForPlacement(shop.brandDesigns, garment, "front-full").length > 0,
      "back-full": compatibleDesignsForPlacement(shop.brandDesigns, garment, "back-full").length > 0
    };
  }, [shop.brandDesigns, garment]);

  const hasDesign = Boolean(frontDesign || backDesign);
  const unitPrice = garment && hasDesign
    ? builderUnitPrice({ garment, frontDesign, frontPlacement, backDesign })
    : 0;
  const totalQty = sizes.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = unitPrice * totalQty;

  useEffect(() => {
    if (!compact) return;
    const send = () => window.parent.postMessage({ type: "printflow:resize", height: document.documentElement.scrollHeight }, "*");
    send();
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [compact, step, garmentId, frontDesignId, backDesignId, frontPlacement]);

  function chooseGarment(item: BrandStoreProduct) {
    const firstColor = item.configuration.colors.find((color) => color.active !== false) || item.configuration.colors[0];
    const firstPlacement: BrandPlacementKey =
      compatibleDesignsForPlacement(shop.brandDesigns, item, "front-full").length ? "front-full"
      : compatibleDesignsForPlacement(shop.brandDesigns, item, "front-heart").length ? "front-heart"
      : "back-full";

    setGarmentId(item.brandGarmentId);
    setColorId(firstColor?.id || "");
    setActivePlacement(firstPlacement);
    setFrontDesignId("");
    setFrontPlacement(undefined);
    setBackDesignId("");
    setPreviewSide(placementDefinition(firstPlacement).side);
    setSizes(item.configuration.sizes.map((size) => ({ size, quantity: 0 })));
    setStep(2);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseDesign(design: BrandDesign) {
    if (activePlacement === "back-full") {
      setBackDesignId((current) => current === design.id ? "" : design.id);
      setPreviewSide("back");
      return;
    }

    if (frontDesignId === design.id && frontPlacement === activePlacement) {
      setFrontDesignId("");
      setFrontPlacement(undefined);
    } else {
      setFrontDesignId(design.id);
      setFrontPlacement(activePlacement);
    }
    setPreviewSide("front");
  }

  function updateSize(size: string, quantity: number) {
    setSizes((current) => current.map((item) =>
      item.size === size ? { ...item, quantity: Math.max(0, Math.floor(quantity || 0)) } : item
    ));
  }

  async function renderSide(side: DesignSide) {
    if (!garment || !selectedColor) throw new Error("Choose a garment and color.");

    const design = side === "front" ? frontDesign : backDesign;
    const placementKey = side === "front" ? frontPlacement : backDesign ? "back-full" : undefined;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f5f5f2";
    ctx.fillRect(0, 0, W, H);

    const background = garmentImage(garment, selectedColor.id, side);
    if (background) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Unable to load ${side} garment mockup.`));
        image.src = background;
      });
      const scale = Math.min(W / image.width, H / image.height) * .92;
      ctx.drawImage(image, (W - image.width * scale) / 2, (H - image.height * scale) / 2, image.width * scale, image.height * scale);
    }

    if (design && placementKey) {
      const placement = design.productRules.find((item) => item.productId === garment.id)?.placements?.[placementKey];
      const variant = designArtworkVariant(design, selectedColor);

      if (placement?.enabled && variant) {
        const artwork = new Image();
        artwork.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          artwork.onload = () => resolve();
          artwork.onerror = () => reject(new Error(`Unable to load ${side} design artwork.`));
          artwork.src = brandArtworkUrl(variant.id);
        });
        ctx.drawImage(artwork, placement.placement.x, placement.placement.y, placement.placement.width, placement.placement.height);
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
    if (frontDesign && !frontPlacement) return setError("Choose the front placement.");
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
          frontSelection: frontDesign && frontPlacement ? { designId: frontDesign.id, placementKey: frontPlacement } : null,
          backSelection: backDesign ? { designId: backDesign.id, placementKey: "back-full" } : null,
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
    return <main className="brand-webstore"><section className="store-empty"><h1>{shop.business.name}</h1><p>This store is currently unavailable.</p></section></main>;
  }

  return (
    <main className={`brand-webstore ${compact ? "embed" : ""}`} style={{
      "--brand": shop.business.settings.primaryColor,
      "--brand-text": shop.business.settings.textColor,
      "--accent": shop.business.settings.accentColor,
      "--surface": shop.business.settings.surfaceColor
    } as React.CSSProperties}>
      {preview && <div className="preview-bar"><strong>PREVIEW MODE</strong><span>Draft storefront · checkout disabled</span><a href="/dashboard/brand-storefront">Store controls</a></div>}

      {!compact && (
        <>
          <div className="announcement">{shop.business.settings.trustMessage}</div>
          <header className="webstore-header">
            <div className="store-logo">{shop.business.settings.logoUrl ? <img src={shop.business.settings.logoUrl} alt={shop.business.name} /> : <strong>{shop.business.name}</strong>}</div>
            <nav><button onClick={() => setStep(1)}>Shop</button><span>Build Your Own</span></nav>
            <button className="header-action" onClick={() => setStep(1)}>Shop garments</button>
          </header>

          {step === 1 && (
            <section className="store-hero">
              <div>
                <small>{shop.business.settings.heroBadge || "BUILD YOUR OWN"}</small>
                <h1>{shop.business.settings.headline || "Choose your piece. Make it yours."}</h1>
                <p>{shop.business.settings.introduction || "Shop the garment first, then choose from approved designs and placements."}</p>
                <a href="#catalog">Shop garments ↓</a>
              </div>
              {shop.garments[0] && (() => {
                const sample = defaultDecoratedSelection(shop.garments[0], shop.brandDesigns);
                const side = sample ? placementDefinition(sample.placementKey).side : "front";
                const color = shop.garments[0].configuration.colors[0]?.id || "";
                return <Composite garment={shop.garments[0]} colorId={color} side={side} design={sample?.design} placementKey={sample?.placementKey} />;
              })()}
            </section>
          )}
        </>
      )}

      {step === 1 && (
        <section id="catalog" className="store-catalog">
          <header>
            <div><small>SHOP</small><h2>Choose your garment</h2><p>Pick the piece you want to customize. You will choose the design and placement next.</p></div>
            <strong>{shop.garments.length} styles</strong>
          </header>

          <div className="store-product-grid">
            {shop.garments.map((item) => {
              const sample = defaultDecoratedSelection(item, shop.brandDesigns);
              const side = sample ? placementDefinition(sample.placementKey).side : "front";
              const firstColor = item.configuration.colors[0]?.id || "";
              return (
                <button key={item.brandGarmentId} className="store-product-card" onClick={() => chooseGarment(item)}>
                  <div className="product-image">
                    <Composite garment={item} colorId={firstColor} side={side} design={sample?.design} placementKey={sample?.placementKey} />
                    <span>{sample ? "CUSTOMIZABLE" : "GARMENT"}</span>
                  </div>
                  <div className="product-copy">
                    <small>{item.configuration.customization.category}</small>
                    <h3>{item.name}</h3>
                    <p>{item.configuration.colors.length} colors · {item.configuration.sizes.length} sizes</p>
                    <strong>Customize →</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && garment && (
        <section className="product-builder-page">
          <div className="product-gallery">
            <div className="gallery-toolbar">
              <button onClick={() => setStep(1)}>← Shop</button>
              <div><button className={previewSide === "front" ? "active" : ""} onClick={() => setPreviewSide("front")}>Front</button><button className={previewSide === "back" ? "active" : ""} onClick={() => setPreviewSide("back")}>Back</button></div>
            </div>

            <Composite
              garment={garment}
              colorId={colorId}
              side={previewSide}
              design={previewSide === "front" ? frontDesign : backDesign}
              placementKey={previewSide === "front" ? frontPlacement : backDesign ? "back-full" : undefined}
            />

            <div className="color-line">
              <strong>{selectedColor?.name}</strong>
              <div>{garment.configuration.colors.map((item) => <button key={item.id} className={selectedColor?.id === item.id ? "active" : ""} title={item.name} onClick={() => setColorId(item.id)}><i style={{ background: item.hex }} /></button>)}</div>
            </div>
          </div>

          <div className="product-options">
            <header>
              <small>{garment.configuration.customization.category}</small>
              <h1>{garment.name}</h1>
              <p>{garment.description}</p>
              {hasDesign ? <strong className="final-unit-price">${unitPrice.toFixed(2)} <span>each</span></strong> : <span className="price-prompt">Choose a design and placement to see your price.</span>}
            </header>

            <section className="selected-build">
              <div><span>Front</span><strong>{frontDesign ? `${frontDesign.name} · ${frontPlacement === "front-heart" ? "Heart Size" : "Full Size"}` : "No front design"}</strong></div>
              <div><span>Back</span><strong>{backDesign ? `${backDesign.name} · Full Size` : "No back design"}</strong></div>
            </section>

            <section className="placement-section">
              <div className="option-heading"><div><span>1</span><strong>Choose placement</strong></div><small>Available for this garment</small></div>
              <div className="placement-pills">
                {(["front-heart", "front-full", "back-full"] as BrandPlacementKey[]).map((placementKey) => (
                  <button
                    key={placementKey}
                    disabled={!placementAvailability[placementKey]}
                    className={activePlacement === placementKey ? "active" : ""}
                    onClick={() => {
                      setActivePlacement(placementKey);
                      setPreviewSide(placementDefinition(placementKey).side);
                    }}
                  >
                    {placementKey === "front-heart" ? "Front · Heart Size" : placementKey === "front-full" ? "Front · Full Size" : "Back · Full Size"}
                  </button>
                ))}
              </div>
            </section>

            <section className="design-shop-section">
              <div className="option-heading"><div><span>2</span><strong>Choose a design</strong></div><small>{designsForPlacement.length} options</small></div>
              <div className="store-design-grid">
                {designsForPlacement.map((design) => {
                  const variant = designArtworkVariant(design, selectedColor);
                  const selected = activePlacement === "back-full"
                    ? backDesignId === design.id
                    : frontDesignId === design.id && frontPlacement === activePlacement;

                  return (
                    <button key={design.id} className={selected ? "selected" : ""} onClick={() => chooseDesign(design)}>
                      <div>{variant ? <img src={brandArtworkUrl(variant.id)} alt={design.name} /> : <span>No preview</span>}</div>
                      <strong>{design.name}</strong>
                      <small>{placementLabel(activePlacement)}</small>
                    </button>
                  );
                })}
              </div>
            </section>

            {hasDesign && (
              <button className="store-primary" onClick={() => setStep(3)}>
                Continue · ${unitPrice.toFixed(2)} each
              </button>
            )}
          </div>
        </section>
      )}

      {step === 3 && garment && hasDesign && (
        <section className="checkout-builder">
          <div className="checkout-gallery">
            <div className="front-back-pair">
              <div><span>FRONT</span><Composite garment={garment} colorId={colorId} side="front" design={frontDesign} placementKey={frontPlacement} /></div>
              <div><span>BACK</span><Composite garment={garment} colorId={colorId} side="back" design={backDesign} placementKey={backDesign ? "back-full" : undefined} /></div>
            </div>
            <p>Front and back mockups are saved with the order for production review.</p>
          </div>

          <div className="checkout-panel">
            <button className="back-link" onClick={() => setStep(2)}>← Edit design</button>
            <small>YOUR ITEM</small>
            <h1>{garment.name}</h1>
            <strong className="checkout-unit">${unitPrice.toFixed(2)} each</strong>

            <section>
              <div className="option-heading"><div><span>3</span><strong>Sizes & quantities</strong></div><small>{totalQty} selected</small></div>
              <div className="size-grid">
                {sizes.map((item) => (
                  <label key={item.size}>
                    <span>{item.size}</span>
                    <div><button onClick={() => updateSize(item.size, item.quantity - 1)}>−</button><input type="number" min="0" value={item.quantity || ""} onChange={(event) => updateSize(item.size, Number(event.target.value))} /><button onClick={() => updateSize(item.size, item.quantity + 1)}>+</button></div>
                  </label>
                ))}
              </div>
            </section>

            <section className="contact-form">
              <div className="option-heading"><div><span>4</span><strong>Contact</strong></div></div>
              <input placeholder="Full name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
              <input type="email" placeholder="Email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
              <input placeholder="Phone (optional)" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
              <textarea rows={2} placeholder="Order note (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </section>

            <div className="order-total">
              <span>{totalQty || 0} item{totalQty === 1 ? "" : "s"}</span>
              <strong>${totalPrice.toFixed(2)}</strong>
            </div>

            {error && <div className="store-error">{error}</div>}

            <button className="store-primary" disabled={busy || totalQty < 1 || (!preview && !shop.paymentReady)} onClick={checkout}>
              {preview ? "Preview Mode · Checkout disabled" : busy ? "Preparing checkout…" : !shop.paymentReady ? "Checkout unavailable" : `Checkout · $${totalPrice.toFixed(2)}`}
            </button>

            <small className="trust-line">{shop.business.settings.trustMessage}</small>
          </div>
        </section>
      )}

      {!compact && <footer className="store-footer"><strong>{shop.business.name}</strong><span>Made to order with PrintFlow</span></footer>}

      <style jsx>{`
        .brand-webstore{min-height:100vh;padding:10px;background:var(--surface,#f4f4ef);color:#171717}.brand-webstore.embed{min-height:0;padding:0;background:transparent}.preview-bar{display:flex;justify-content:space-between;gap:12px;align-items:center;max-width:1440px;margin:0 auto 6px;padding:8px 11px;border-radius:8px;background:#1f2947;color:#fff}.preview-bar strong{font-size:7px;letter-spacing:.12em}.preview-bar span,.preview-bar a{font-size:7px;color:#d5daea}.announcement{max-width:1440px;margin:0 auto;padding:7px;text-align:center;background:var(--brand);color:var(--brand-text);font-size:7px;letter-spacing:.04em}.webstore-header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;max-width:1440px;margin:0 auto;padding:12px 16px;background:#fff;border-bottom:1px solid #eee}.store-logo img{max-width:155px;max-height:34px}.store-logo strong{font-size:16px}.webstore-header nav{display:flex;gap:18px;align-items:center}.webstore-header nav button,.webstore-header nav span,.header-action{border:0;background:transparent;color:#333;font-size:8px}.header-action{justify-self:end;font-weight:850}.store-hero{display:grid;grid-template-columns:1.1fr .9fr;max-width:1440px;min-height:520px;margin:0 auto;background:#fff}.store-hero>div:first-child{display:flex;flex-direction:column;justify-content:center;padding:clamp(35px,7vw,90px)}.store-hero small{font-size:7px;font-weight:900;letter-spacing:.12em;color:var(--brand)}.store-hero h1{max-width:800px;margin:8px 0;font-size:clamp(50px,7vw,92px);line-height:.88;letter-spacing:-.055em}.store-hero p{max-width:570px;color:#707070;line-height:1.55}.store-hero a{align-self:flex-start;margin-top:17px;color:#171717;font-size:9px;font-weight:850;text-decoration:none}.store-hero :global(.brand-builder-composite){height:100%;background:#f5f5f2}.store-hero :global(svg){width:100%;height:100%}
        .store-catalog{max-width:1440px;margin:8px auto 0;padding:24px 18px;background:#fff}.store-catalog>header{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:14px}.store-catalog>header small{font-size:7px;font-weight:900;letter-spacing:.1em;color:#888}.store-catalog>header h2{margin:2px 0;font-size:28px}.store-catalog>header p{max-width:600px;margin:0;color:#777}.store-catalog>header>strong{font-size:8px;color:#888}.store-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.store-product-card{padding:0;border:1px solid #e4e4df;background:#fff;color:#171717;text-align:left;overflow:hidden}.store-product-card:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.07)}.product-image{position:relative;background:#f5f5f2}.product-image :global(svg){display:block;width:100%}.product-image>span{position:absolute;left:9px;top:9px;padding:4px 6px;background:#fff;font-size:6px;font-weight:900;letter-spacing:.08em}.product-copy{padding:11px}.product-copy small{font-size:6px;color:#888;text-transform:uppercase;letter-spacing:.08em}.product-copy h3{margin:4px 0;font-size:13px}.product-copy p{margin:0 0 11px;color:#888;font-size:7px}.product-copy strong{font-size:8px}
        .product-builder-page{display:grid;grid-template-columns:minmax(420px,.95fr) minmax(0,1.05fr);gap:8px;max-width:1340px;margin:8px auto;background:#fff}.product-gallery{position:sticky;top:8px;align-self:start;padding:10px;background:#f5f5f2}.gallery-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.gallery-toolbar>button,.gallery-toolbar div button{padding:6px 9px;border:0;background:#fff;font-size:7px}.gallery-toolbar div{display:flex;gap:3px}.gallery-toolbar div button.active{background:#171717;color:#fff}.product-gallery :global(svg){display:block;width:100%;max-height:650px}.color-line{display:flex;justify-content:space-between;gap:9px;align-items:center;padding:9px}.color-line>strong{font-size:8px}.color-line>div{display:flex;gap:4px;flex-wrap:wrap}.color-line button{display:grid;place-items:center;width:24px;height:24px;border:1px solid #ddd;border-radius:99px;background:#fff}.color-line button.active{border:2px solid #171717}.color-line i{width:15px;height:15px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}.product-options{padding:28px 24px}.product-options>header>small{font-size:7px;color:#888;text-transform:uppercase;letter-spacing:.08em}.product-options>header h1{margin:4px 0;font-size:36px;line-height:.95}.product-options>header p{max-width:600px;color:#777;line-height:1.5}.final-unit-price{display:block;margin-top:13px;font-size:27px}.final-unit-price span{font-size:9px;color:#777}.price-prompt{display:block;margin-top:13px;color:#777;font-size:9px}.selected-build{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:18px 0;padding:8px;background:#f4f4f0}.selected-build>div{padding:8px;background:#fff}.selected-build span,.selected-build strong{display:block}.selected-build span{font-size:6px;color:#888;text-transform:uppercase}.selected-build strong{margin-top:3px;font-size:8px}.placement-section,.design-shop-section{padding-top:17px;margin-top:17px;border-top:1px solid #eee}.option-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.option-heading>div{display:flex;gap:7px;align-items:center}.option-heading>div>span{display:grid;place-items:center;width:24px;height:24px;border-radius:99px;background:#171717;color:#fff;font-size:7px}.option-heading strong{font-size:9px}.option-heading small{font-size:7px;color:#888}.placement-pills{display:flex;gap:5px;flex-wrap:wrap}.placement-pills button{padding:8px 10px;border:1px solid #ddd;background:#fff;font-size:8px}.placement-pills button.active{background:var(--brand);border-color:var(--brand);color:var(--brand-text)}.placement-pills button:disabled{opacity:.3}.store-design-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.store-design-grid>button{padding:0;border:1px solid #ddd;background:#fff;color:#171717;text-align:left}.store-design-grid>button.selected{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand)}.store-design-grid>button>div{height:140px;padding:15px;background:#f5f5f2}.store-design-grid img{width:100%;height:100%;object-fit:contain}.store-design-grid>button>strong,.store-design-grid>button>small{display:block;padding:0 8px}.store-design-grid>button>strong{padding-top:8px;font-size:9px}.store-design-grid>button>small{padding-top:2px;padding-bottom:8px;font-size:6px;color:#888}.store-primary{width:100%;margin-top:16px;padding:13px;border:0;background:var(--brand);color:var(--brand-text);font-weight:900}.store-primary:disabled{opacity:.4}
        .checkout-builder{display:grid;grid-template-columns:minmax(0,1fr) 430px;gap:8px;max-width:1340px;margin:8px auto}.checkout-gallery,.checkout-panel{background:#fff}.checkout-gallery{padding:10px}.front-back-pair{display:grid;grid-template-columns:1fr 1fr;gap:5px}.front-back-pair>div{position:relative;background:#f5f5f2}.front-back-pair>div>span{position:absolute;z-index:2;left:8px;top:8px;padding:4px 6px;background:#fff;font-size:6px;font-weight:900}.front-back-pair :global(svg){display:block;width:100%}.checkout-gallery>p{text-align:center;color:#888;font-size:7px}.checkout-panel{padding:24px}.back-link{padding:0;border:0;background:transparent;font-size:7px;color:#777}.checkout-panel>small{display:block;margin-top:18px;font-size:7px;color:#888}.checkout-panel h1{margin:4px 0;font-size:28px}.checkout-unit{display:block;margin:8px 0 18px;font-size:23px}.checkout-panel>section{padding-top:14px;margin-top:14px;border-top:1px solid #eee}.size-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.size-grid label{padding:6px;background:#f4f4f0}.size-grid label>span{display:block;margin-bottom:4px;font-size:8px;font-weight:850}.size-grid label>div{display:grid;grid-template-columns:23px 1fr 23px}.size-grid button{border:0;background:#fff}.size-grid input{min-width:0;width:100%;border:0;text-align:center}.contact-form{display:grid;gap:6px}.contact-form .option-heading{margin-bottom:2px}.contact-form input,.contact-form textarea{width:100%;box-sizing:border-box}.order-total{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:13px;background:#f3f3ef}.order-total span{font-size:8px}.order-total strong{font-size:20px}.store-error{margin-top:9px;padding:8px;background:#fff0ef;color:#993d34;font-size:8px}.trust-line{display:block;margin-top:8px;text-align:center;color:#888;font-size:6px}.store-footer{display:flex;justify-content:space-between;max-width:1440px;margin:8px auto 0;padding:25px 8px;color:#777}.store-footer strong{font-size:10px}.store-footer span{font-size:7px}.store-empty{display:grid;place-items:center;min-height:70vh;text-align:center}.embed .store-catalog,.embed .product-builder-page,.embed .checkout-builder{max-width:none;margin-top:0}
        @media(max-width:950px){.store-hero{grid-template-columns:1fr}.store-hero :global(.brand-builder-composite){max-height:480px}.product-builder-page,.checkout-builder{grid-template-columns:1fr}.product-gallery{position:static}.checkout-panel{padding:18px}.front-back-pair{grid-template-columns:1fr 1fr}}@media(max-width:700px){.brand-webstore{padding:4px}.webstore-header{grid-template-columns:1fr auto}.webstore-header nav{display:none}.store-hero>div:first-child{padding:40px 22px}.store-hero h1{font-size:50px}.store-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.store-catalog{padding:15px 9px}.product-options{padding:18px 13px}.store-design-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.selected-build{grid-template-columns:1fr}.front-back-pair{grid-template-columns:1fr 1fr}.size-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:430px){.store-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.product-copy{padding:8px}.product-copy h3{font-size:10px}.front-back-pair{grid-template-columns:1fr}.store-hero h1{font-size:43px}}
      `}</style>
    </main>
  );
}
