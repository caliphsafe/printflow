"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { calculateResolvedOrderPricing } from "@/lib/pricing-settings";
import { brandArtworkUrl, chooseBrandVariant, compatiblePlacements, resolveLockedPlacement } from "@/lib/brand-designs";
import type { PublicBrandShop } from "@/lib/brand-types";
import type { SizeQuantity } from "@/lib/types";

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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load preview image."));
    image.src = src;
  });
}

export default function BrandStorefront({ shop }: { shop: PublicBrandShop }) {
  const compact = shop.presentation === "embed";
  const [collectionId, setCollectionId] = useState("All");
  const activeCollection = shop.collections.find((item) => item.id === collectionId);
  const availableProducts = activeCollection
    ? shop.products.filter((item) => activeCollection.productIds.includes(item.id))
    : shop.products;

  const [category, setCategory] = useState("All");
  const [productId, setProductId] = useState(availableProducts[0]?.id || shop.products[0]?.id || "");
  const product = availableProducts.find((item) => item.id === productId) || availableProducts[0] || shop.products[0];

  const activeColors = product?.configuration.colors.filter((item) => item.active !== false) || [];
  const defaultColor = activeColors.find((item) => item.id === product?.configuration.defaultColorId) || activeColors[0];
  const [colorId, setColorId] = useState(defaultColor?.id || "");
  const color = activeColors.find((item) => item.id === colorId) || defaultColor;

  const designsForProduct = useMemo(
    () => shop.brandDesigns.filter((design) =>
      design.productIds.includes(product?.id || "") &&
      (category === "All" || design.category_id === category) &&
      (!activeCollection || activeCollection.designIds.includes(design.id))
    ),
    [shop.brandDesigns, product?.id, category, activeCollection]
  );

  const [designId, setDesignId] = useState("");
  const design = designsForProduct.find((item) => item.id === designId) || designsForProduct[0];

  const placements = design && product ? compatiblePlacements(product, design.placements) : [];
  const [placementKey, setPlacementKey] = useState("");
  const placement = placements.find((item) => `${item.side}-${item.placement_type}` === placementKey) || placements[0];

  const variant = design ? chooseBrandVariant(design.variants, color as any) : null;
  const resolved = product && placement ? resolveLockedPlacement(product, placement) : null;

  const [sizes, setSizes] = useState<SizeQuantity[]>(
    product?.configuration.sizes.map((size) => ({ size, quantity: 0 })) || []
  );

  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = sizes.reduce((sum, item) => sum + item.quantity, 0);
  const minimum = Math.max(1, Number(design?.metadata?.minimumQuantity || 1));

  useEffect(() => {
    if (!compact) return;
    const send = () => window.parent.postMessage(
      { type: "printflow:resize", height: document.documentElement.scrollHeight },
      "*"
    );
    send();
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    if (!availableProducts.length) return;
    if (!availableProducts.some((item) => item.id === productId)) {
      chooseProduct(availableProducts[0].id);
    }
  }, [collectionId]);

  const pricing = product && color && placement
    ? calculateResolvedOrderPricing({
        profile: shop.pricing,
        product,
        sizes: total
          ? sizes
          : sizes.map((item, index) => ({ ...item, quantity: index === 0 ? minimum : 0 })),
        color,
        printSelections: {
          [placement.side]: {
            printSize: placement.placement_type,
            placement: resolved?.placement,
            inkColors: 1
          }
        },
        decorationMethod: placement.decoration_method || product.configuration.customization.decorationMethods[0] || "Screen Print",
        designOptimizationRequested: false,
        selectedAddOnIds: []
      })
    : null;

  const quantityForPrice = total || minimum;
  const surcharge = Number(placement?.surcharge || 0) * quantityForPrice;
  const finalPrice = Number(pricing?.totalPrice || 0) + surcharge;

  function chooseProduct(id: string) {
    const next = shop.products.find((item) => item.id === id);
    if (!next) return;

    setProductId(id);
    const colors = next.configuration.colors.filter((item) => item.active !== false);
    const nextColor = colors.find((item) => item.id === next.configuration.defaultColorId) || colors[0];
    setColorId(nextColor?.id || "");
    setDesignId("");
    setPlacementKey("");
    setSizes(next.configuration.sizes.map((size) => ({ size, quantity: 0 })));
    setError("");
  }

  function updateSize(size: string, quantity: number) {
    setSizes((current) => current.map((item) =>
      item.size === size ? { ...item, quantity: Math.max(0, Math.floor(quantity || 0)) } : item
    ));
  }

  async function renderPreview() {
    if (!product || !color || !variant || !resolved || !placement) {
      throw new Error("Preview is incomplete.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f6f6f3";
    ctx.fillRect(0, 0, W, H);

    const garmentUrl = assetUrl(
      placement.side === "back"
        ? color.backImageUrl || product.configuration.mockupImageUrl
        : color.frontImageUrl || product.configuration.mockupImageUrl
    );

    if (garmentUrl) {
      const garment = await loadImage(garmentUrl);
      const scale = Math.min(W / garment.width, H / garment.height) * 0.92;
      ctx.drawImage(
        garment,
        (W - garment.width * scale) / 2,
        (H - garment.height * scale) / 2,
        garment.width * scale,
        garment.height * scale
      );
    }

    const art = await loadImage(brandArtworkUrl(variant.id));
    ctx.drawImage(
      art,
      resolved.placement.x,
      resolved.placement.y,
      resolved.placement.width,
      resolved.placement.height
    );

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Unable to render preview.")),
        "image/png",
        0.95
      )
    );
  }

  async function checkout() {
    setError("");

    if (!product || !color || !design || !variant || !placement || !pricing) {
      return setError("Choose a garment, design and placement.");
    }
    if (!customer.name.trim() || !customer.email.trim()) {
      return setError("Enter your name and email.");
    }
    if (total < minimum) {
      return setError(`Choose at least ${minimum} item${minimum === 1 ? "" : "s"}.`);
    }
    if (!shop.paymentReady) {
      return setError("Checkout is not connected yet.");
    }

    setBusy(true);

    try {
      const start = await fetch("/api/brand-orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug: shop.slug,
          productId: product.id,
          colorId: color.id,
          designId: design.id,
          variantId: variant.id,
          placementId: placement.id,
          sizes,
          customer,
          notes
        })
      });

      const startData = await start.json();
      if (!start.ok) throw new Error(startData.error || "Unable to create order.");

      const preview = await renderPreview();

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );

      const upload = startData.previewUpload;
      const uploadResult = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, preview, { contentType: "image/png" });

      if (uploadResult.error) throw uploadResult.error;

      const finish = await fetch("/api/designs/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: startData.designId })
      });

      const completed = await finish.json();
      if (!finish.ok) throw new Error(completed.error || "Unable to create checkout.");

      window.location.href = completed.checkoutUrl;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue to checkout.");
      setBusy(false);
    }
  }

  if (!shop.products.length || !shop.brandDesigns.length) {
    return (
      <main className={`brand-store-shell ${compact ? "compact" : ""}`}>
        <section className="brand-empty">
          <h1>{shop.name}</h1>
          <p>This Brand storefront is still being prepared.</p>
        </section>
      </main>
    );
  }

  const garmentUrl = assetUrl(
    placement?.side === "back"
      ? color?.backImageUrl || product?.configuration.mockupImageUrl
      : color?.frontImageUrl || product?.configuration.mockupImageUrl
  );

  return (
    <main
      className={`brand-store-shell ${compact ? "compact" : ""}`}
      style={{
        "--brand": shop.settings.brand.primaryColor,
        "--accent": shop.settings.brand.accentColor || "#d8ff5f",
        "--surface": shop.settings.brand.surfaceColor || "#f4f4ef",
        "--onbrand": shop.settings.brand.textColor
      } as React.CSSProperties}
    >
      {!compact && (
        <header className="brand-store-header">
          {shop.settings.brand.logoUrl
            ? <img src={shop.settings.brand.logoUrl} alt={shop.name} />
            : <strong>{shop.name}</strong>}
          <div><span>Brand / Merch</span><b>Shop approved designs</b></div>
        </header>
      )}

      <div className="brand-store-grid">
        <section className="brand-stage">
          {!compact && (
            <div className="brand-intro">
              <p>{shop.settings.customerExperience?.heroBadge || "BRAND MERCH"}</p>
              <h1>{shop.settings.customerExperience?.headline || "Build your piece."}</h1>
              <span>Choose a garment, color and approved design.</span>
            </div>
          )}

          <div className="brand-preview">
            <svg viewBox="0 0 800 800">
              <rect width="800" height="800" fill="#f6f6f3" />
              {garmentUrl && (
                <image href={garmentUrl} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet" />
              )}
              {variant && resolved && (
                <image
                  href={brandArtworkUrl(variant.id)}
                  x={resolved.placement.x}
                  y={resolved.placement.y}
                  width={resolved.placement.width}
                  height={resolved.placement.height}
                />
              )}
            </svg>

            <div>
              <span>{product.name}</span>
              <b>{color?.name} · {design?.name}</b>
              {placement && (
                <small>{placement.side === "front" ? "Front" : "Back"} · {placement.placement_type === "heart" ? "Heart Size" : "Full Size"}</small>
              )}
            </div>
          </div>
        </section>

        <aside className="brand-config">
          {shop.collections.length > 0 && (
            <section className="collection-filter">
              <span>Collection</span>
              <div>
                <button className={collectionId === "All" ? "active" : ""} onClick={() => { setCollectionId("All"); setCategory("All"); setDesignId(""); }}>All</button>
                {shop.collections.map((item) => (
                  <button key={item.id} className={collectionId === item.id ? "active" : ""} onClick={() => { setCollectionId(item.id); setCategory("All"); setDesignId(""); }}>
                    {item.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          <Step n="1" title="Garment">
            <div className="garment-grid">
              {availableProducts.map((item) => (
                <button type="button" key={item.id} className={item.id === product.id ? "active" : ""} onClick={() => chooseProduct(item.id)}>
                  <span>{item.name}</span>
                  <small>{item.configuration.customization.category}</small>
                </button>
              ))}
            </div>
          </Step>

          <Step n="2" title="Color">
            <div className="color-grid">
              {activeColors.map((item) => (
                <button type="button" key={item.id} className={item.id === color?.id ? "active" : ""} onClick={() => setColorId(item.id)} title={item.name}>
                  <i style={{ background: item.hex }} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </Step>

          <Step n="3" title="Design">
            {shop.categories.length > 0 && (
              <div className="category-row">
                <button className={category === "All" ? "active" : ""} onClick={() => { setCategory("All"); setDesignId(""); }}>All</button>
                {shop.categories.map((item) => (
                  <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => { setCategory(item.id); setDesignId(""); }}>
                    {item.name}
                  </button>
                ))}
              </div>
            )}

            <div className="design-grid">
              {designsForProduct.map((item) => {
                const itemVariant = chooseBrandVariant(item.variants, color as any);
                return (
                  <button type="button" key={item.id} className={item.id === design?.id ? "active" : ""} onClick={() => { setDesignId(item.id); setPlacementKey(""); }}>
                    <div>{itemVariant && <img src={brandArtworkUrl(itemVariant.id)} alt="" />}</div>
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </Step>

          {placements.length > 1 && (
            <Step n="4" title="Placement">
              <div className="placement-row">
                {placements.map((item) => (
                  <button type="button" key={item.id} className={item.id === placement?.id ? "active" : ""} onClick={() => setPlacementKey(`${item.side}-${item.placement_type}`)}>
                    {item.side === "front" ? "Front" : "Back"} · {item.placement_type === "heart" ? "Heart" : "Full"}
                  </button>
                ))}
              </div>
            </Step>
          )}

          <Step n={placements.length > 1 ? "5" : "4"} title="Size & quantity">
            <div className="size-grid">
              {sizes.map((item) => (
                <label key={item.size}>
                  <span>{item.size}</span>
                  <div>
                    <button onClick={() => updateSize(item.size, item.quantity - 1)}>−</button>
                    <input type="number" min="0" value={item.quantity || ""} onChange={(event) => updateSize(item.size, Number(event.target.value))} />
                    <button onClick={() => updateSize(item.size, item.quantity + 1)}>+</button>
                  </div>
                </label>
              ))}
            </div>
            <small className="minimum-note">Minimum: {minimum}</small>
          </Step>

          <section className="brand-checkout">
            <div className="brand-price">
              <span>{total || minimum} item{(total || minimum) === 1 ? "" : "s"}</span>
              <strong>${finalPrice.toFixed(2)}</strong>
              {placement?.surcharge ? <small>Includes design placement surcharge</small> : null}
            </div>

            <div className="customer-fields">
              <input placeholder="Full name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
              <input type="email" placeholder="Email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
              <input placeholder="Phone (optional)" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
              <textarea rows={2} placeholder="Order notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button className="brand-pay" disabled={busy || !shop.paymentReady || total < minimum} onClick={checkout}>
              {busy ? "Preparing checkout…" : shop.paymentReady ? `Continue · $${finalPrice.toFixed(2)}` : "Checkout unavailable"}
            </button>
          </section>
        </aside>
      </div>

      <style jsx>{`
        .brand-store-shell{min-height:100vh;background:var(--surface);color:#171717;padding:20px}
        .brand-store-shell.compact{min-height:0;padding:0;background:transparent}
        .brand-store-header{display:flex;align-items:center;justify-content:space-between;gap:20px;max-width:1320px;margin:0 auto 16px;padding:13px 16px;border-radius:15px;background:#fff;border:1px solid rgba(0,0,0,.08)}
        .brand-store-header img{max-height:36px;max-width:150px}
        .brand-store-header div{text-align:right}
        .brand-store-header span{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#777}
        .brand-store-header b{font-size:11px}
        .brand-store-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(360px,.8fr);gap:14px;max-width:1320px;margin:auto}
        .compact .brand-store-grid{max-width:none;grid-template-columns:minmax(0,1fr) minmax(330px,.8fr)}
        .brand-stage,.brand-config{min-width:0}
        .brand-intro{padding:28px 10px 22px}
        .brand-intro p{margin:0 0 6px;font-size:8px;font-weight:850;letter-spacing:.12em;color:var(--brand)}
        .brand-intro h1{margin:0;font-size:clamp(34px,5vw,62px);line-height:.95;letter-spacing:-.05em}
        .brand-intro span{display:block;margin-top:9px;color:#686868}
        .brand-preview{border-radius:20px;overflow:hidden;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 14px 40px rgba(0,0,0,.06)}
        .brand-preview svg{display:block;width:100%;aspect-ratio:1/1;max-height:720px}
        .brand-preview>div{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:12px 15px;border-top:1px solid #eee}
        .brand-preview span{font-size:9px;color:#777}
        .brand-preview b{font-size:11px}
        .brand-preview small{margin-left:auto;font-size:8px;color:#777}
        .brand-config{display:grid;gap:9px;align-content:start}
        .collection-filter{padding:9px 10px;border-radius:11px;background:rgba(255,255,255,.72);border:1px solid rgba(0,0,0,.07)}
        .collection-filter>span{display:block;margin-bottom:6px;font-size:7px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#777}
        .collection-filter>div{display:flex;gap:5px;overflow:auto}
        .collection-filter button{padding:6px 9px;border:1px solid #ddd;border-radius:8px;background:#fff;white-space:nowrap;font-size:8px;color:#333}
        .collection-filter button.active{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand)}
        .garment-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
        .garment-grid button,.placement-row button,.category-row button{border:1px solid #ddd;border-radius:9px;background:#fff;color:#333;cursor:pointer}
        .garment-grid button{padding:9px;text-align:left}
        .garment-grid button.active,.placement-row button.active,.category-row button.active{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand)}
        .garment-grid span{display:block;font-size:9px;font-weight:750}
        .garment-grid small{display:block;font-size:7px;color:#777;margin-top:2px}
        .color-grid{display:flex;flex-wrap:wrap;gap:5px}
        .color-grid button{display:flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #ddd;border-radius:8px;background:#fff}
        .color-grid button.active{border-color:#111;box-shadow:inset 0 0 0 1px #111}
        .color-grid i{width:15px;height:15px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}
        .color-grid span{font-size:8px}
        .category-row{display:flex;gap:5px;overflow:auto;margin-bottom:7px}
        .category-row button{padding:5px 8px;white-space:nowrap;font-size:8px}
        .design-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
        .design-grid button{min-width:0;padding:6px;border:1px solid #ddd;border-radius:10px;background:#fff;color:#333;text-align:left}
        .design-grid button.active{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand)}
        .design-grid button>div{height:80px;display:grid;place-items:center;border-radius:7px;background:#f3f3ef;overflow:hidden}
        .design-grid img{max-width:78%;max-height:78%;object-fit:contain}
        .design-grid span{display:block;margin-top:5px;font-size:8px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .placement-row{display:flex;flex-wrap:wrap;gap:5px}
        .placement-row button{padding:7px 9px;font-size:8px}
        .size-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
        .size-grid label{display:grid;gap:4px;padding:7px;border-radius:8px;background:#f6f6f2}
        .size-grid label>span{font-size:8px;font-weight:750}
        .size-grid label>div{display:grid;grid-template-columns:24px minmax(0,1fr) 24px}
        .size-grid button{border:0;background:#fff}
        .size-grid input{min-width:0;width:100%;box-sizing:border-box;text-align:center;border:0}
        .minimum-note{display:block;margin-top:6px;color:#777;font-size:8px}
        .brand-checkout{padding:14px;border-radius:15px;background:#171717;color:#fff}
        .brand-price{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:end;margin-bottom:10px}
        .brand-price span{font-size:8px;color:#aaa}
        .brand-price strong{grid-row:1/span 2;grid-column:2;font-size:24px}
        .brand-price small{font-size:7px;color:#aaa}
        .customer-fields{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .customer-fields input,.customer-fields textarea{min-width:0;width:100%;box-sizing:border-box;border:1px solid #444;background:#242424;color:#fff}
        .customer-fields textarea{grid-column:1/-1}
        .brand-pay{width:100%;margin-top:8px;padding:13px;border:0;border-radius:10px;background:var(--brand);color:var(--onbrand);font-weight:800}
        .brand-pay:disabled{opacity:.45}
        .brand-empty{max-width:680px;margin:100px auto;padding:30px;border-radius:20px;background:#fff;text-align:center}
        @media(max-width:900px){.brand-store-grid,.compact .brand-store-grid{grid-template-columns:1fr}.compact .brand-preview{max-width:620px;margin:auto;width:100%}}
        @media(max-width:600px){.brand-store-shell{padding:8px}.brand-store-grid{gap:8px}.brand-preview{border-radius:14px}.design-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.size-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.customer-fields{grid-template-columns:1fr}.customer-fields textarea{grid-column:auto}.brand-checkout{position:sticky;bottom:6px;z-index:5}}
      `}</style>
    </main>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="brand-step">
      <header><span>{n}</span><h2>{title}</h2></header>
      {children}
      <style jsx>{`
        .brand-step{padding:12px;border-radius:13px;background:#fff;border:1px solid rgba(0,0,0,.08)}
        .brand-step>header{display:flex;align-items:center;gap:7px;margin-bottom:9px}
        .brand-step>header span{display:grid;place-items:center;width:21px;height:21px;border-radius:99px;background:#171717;color:#fff;font-size:7px;font-weight:850}
        .brand-step h2{margin:0;font-size:11px}
      `}</style>
    </section>
  );
}
