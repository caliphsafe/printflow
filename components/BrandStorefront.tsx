"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { brandArtworkUrl, chooseBrandVariant } from "@/lib/brand-designs";
import { brandProductReadiness } from "@/lib/brand-readiness";
import type { BrandMerchProduct } from "@/lib/brand-retail";
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
    image.onerror = () => reject(new Error("Unable to load product preview."));
    image.src = src;
  });
}

function linksFor(shop: PublicBrandShop, product?: BrandMerchProduct) {
  if (!product) return { garment: undefined, design: undefined, placement: undefined };
  const garment = shop.garments.find((item) => item.brandGarmentId === product.brand_garment_id);
  const design = shop.brandDesigns.find((item) => item.id === product.brand_design_id);
  const rule = design?.productRules.find((item) => item.productId === garment?.id);
  return { garment, design, placement: rule?.placements?.[product.placement_key] };
}

function ProductVisual({ shop, product, colorId, className = "" }: { shop: PublicBrandShop; product: BrandMerchProduct; colorId?: string; className?: string }) {
  const { garment, design, placement } = linksFor(shop, product);
  const colors = garment?.configuration.colors.filter((item) => product.configuration.colorIds.includes(item.id)) || [];
  const color = colors.find((item) => item.id === colorId) || colors[0];
  const variant = design ? chooseBrandVariant(design.variants, color as any) : null;
  const garmentImage = placement?.side === "back"
    ? color?.backImageUrl || garment?.configuration.mockupImageUrl
    : color?.frontImageUrl || garment?.configuration.mockupImageUrl;

  return (
    <div className={`brand-product-visual ${className}`}>
      <svg viewBox="0 0 800 800" aria-label={`${product.name} product preview`}>
        <rect width="800" height="800" fill="#f3f3ef" />
        {garmentImage && <image href={assetUrl(garmentImage)} x="28" y="28" width="744" height="744" preserveAspectRatio="xMidYMid meet" />}
        {variant && placement && (
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
  const [collectionId, setCollectionId] = useState("All");
  const [selectedId, setSelectedId] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [colorId, setColorId] = useState("");
  const [sizes, setSizes] = useState<SizeQuantity[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const collection = shop.collections.find((item) => item.id === collectionId);
  const visibleProducts = useMemo(() => {
    const products = collection
      ? shop.merchProducts.filter((item) => collection.merchProductIds.includes(item.id))
      : shop.merchProducts;
    return preview ? products : products.filter((item) => brandProductReadiness(item, shop.garments, shop.brandDesigns).ready);
  }, [shop.merchProducts, shop.garments, shop.brandDesigns, collection, preview]);

  const selected = shop.merchProducts.find((item) => item.id === selectedId);
  const { garment, design, placement } = linksFor(shop, selected);
  const availableColors = garment?.configuration.colors.filter((item) => selected?.configuration.colorIds.includes(item.id)) || [];
  const color = availableColors.find((item) => item.id === colorId) || availableColors[0];
  const variant = design ? chooseBrandVariant(design.variants, color as any) : null;
  const totalQuantity = sizes.reduce((sum, item) => sum + item.quantity, 0);
  const unitPrice = Number(selected?.retail_price || 0);
  const totalPrice = unitPrice * totalQuantity;

  useEffect(() => {
    if (!compact) return;
    const send = () => window.parent.postMessage({ type: "printflow:resize", height: document.documentElement.scrollHeight }, "*");
    send();
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [compact, detailOpen, selectedId]);

  function openProduct(product: BrandMerchProduct) {
    const links = linksFor(shop, product);
    const colors = links.garment?.configuration.colors.filter((item) => product.configuration.colorIds.includes(item.id)) || [];
    const sizeNames = links.garment?.configuration.sizes.filter((size) => product.configuration.sizes.includes(size)) || [];

    setSelectedId(product.id);
    setColorId(colors[0]?.id || "");
    setSizes(sizeNames.map((size) => ({ size, quantity: 0 })));
    setError("");
    setDetailOpen(true);

    if (compact) {
      setTimeout(() => document.getElementById("brand-product-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
    }
  }

  function updateSize(size: string, quantity: number) {
    setSizes((current) => current.map((item) =>
      item.size === size ? { ...item, quantity: Math.max(0, Math.floor(quantity || 0)) } : item
    ));
  }

  async function renderPreview() {
    if (!selected || !garment || !color || !variant || !placement) throw new Error("Product preview is incomplete.");

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f3f3ef";
    ctx.fillRect(0, 0, W, H);

    const background = assetUrl(
      placement.side === "back"
        ? color.backImageUrl || garment.configuration.mockupImageUrl
        : color.frontImageUrl || garment.configuration.mockupImageUrl
    );

    if (background) {
      const image = await loadImage(background);
      const scale = Math.min(W / image.width, H / image.height) * .92;
      ctx.drawImage(image, (W - image.width * scale) / 2, (H - image.height * scale) / 2, image.width * scale, image.height * scale);
    }

    const art = await loadImage(brandArtworkUrl(variant.id));
    ctx.drawImage(art, placement.placement.x, placement.placement.y, placement.placement.width, placement.placement.height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to render product mockup.")), "image/png", .95)
    );
  }

  async function checkout() {
    setError("");
    if (preview) return setError("Preview mode does not create real orders.");
    if (!selected || !garment || !design || !placement || !variant || !color) return setError("This product is not fully configured.");
    if (totalQuantity < 1) return setError("Choose at least one size.");
    if (!customer.name.trim() || !customer.email.trim()) return setError("Enter your name and email.");
    if (!shop.paymentReady) return setError("Checkout is not connected yet.");

    setBusy(true);
    try {
      const start = await fetch("/api/brand-orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug: shop.slug,
          brandProductId: selected.id,
          colorId: color.id,
          sizes,
          customer,
          notes
        })
      });
      const data = await start.json();
      if (!start.ok) throw new Error(data.error || "Unable to create Brand order.");

      const previewBlob = await renderPreview();
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );

      const upload = data.previewUpload;
      const uploaded = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, previewBlob, { contentType: "image/png" });

      if (uploaded.error) throw uploaded.error;

      const finish = await fetch("/api/designs/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: data.designId })
      });

      const completed = await finish.json();
      if (!finish.ok) throw new Error(completed.error || "Unable to prepare secure checkout.");
      window.location.href = completed.checkoutUrl;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue to checkout.");
      setBusy(false);
    }
  }

  return (
    <main
      className={`brand-commerce-store ${compact ? "embed" : ""} ${preview ? "preview" : ""}`}
      style={{
        "--brand": shop.business.settings.primaryColor,
        "--brand-text": shop.business.settings.textColor,
        "--accent": shop.business.settings.accentColor,
        "--surface": shop.business.settings.surfaceColor
      } as React.CSSProperties}
    >
      {preview && (
        <div className="brand-preview-banner">
          <div><strong>PREVIEW MODE</strong><span>This is the private Brand storefront preview. Draft products are visible here but customers cannot purchase them.</span></div>
          <a href="/dashboard/brand-storefront">Store controls</a>
        </div>
      )}

      {!compact && (
        <header className="brand-store-header">
          <div className="brand-mark">
            {shop.business.settings.logoUrl
              ? <img src={shop.business.settings.logoUrl} alt={shop.business.name} />
              : <strong>{shop.business.name}</strong>}
          </div>
          <nav><a href="#shop">Shop</a>{shop.collections.slice(0, 3).map((item) => <button key={item.id} onClick={() => setCollectionId(item.id)}>{item.name}</button>)}</nav>
          <span>Merchandise</span>
        </header>
      )}

      {!compact && (
        <section className="brand-store-hero">
          <div>
            <p>{shop.business.settings.heroBadge}</p>
            <h1>{shop.business.settings.headline}</h1>
            <span>{shop.business.settings.introduction}</span>
            <a href="#shop">Shop merchandise ↓</a>
          </div>
          {visibleProducts[0] && <ProductVisual shop={shop} product={visibleProducts[0]} className="hero-product" />}
        </section>
      )}

      <section id="shop" className="brand-shop-section">
        <header>
          <div><small>MERCHANDISE</small><h2>{collection?.name || "Shop All"}</h2></div>
          <strong>{visibleProducts.length} product{visibleProducts.length === 1 ? "" : "s"}</strong>
        </header>

        {shop.collections.length > 0 && (
          <nav className="brand-collection-tabs">
            <button className={collectionId === "All" ? "active" : ""} onClick={() => setCollectionId("All")}>All</button>
            {shop.collections.map((item) => (
              <button key={item.id} className={collectionId === item.id ? "active" : ""} onClick={() => setCollectionId(item.id)}>{item.name}</button>
            ))}
          </nav>
        )}

        {visibleProducts.length ? (
          <div className="brand-product-grid">
            {visibleProducts.map((product) => {
              const state = brandProductReadiness(product, shop.garments, shop.brandDesigns);
              const linked = linksFor(shop, product);
              return (
                <button key={product.id} className="brand-store-card" onClick={() => openProduct(product)}>
                  <div className="card-art">
                    <ProductVisual shop={shop} product={product} />
                    {preview && <span className={state.ready ? "ready" : "issue"}>{product.active ? state.label : "DRAFT"}</span>}
                    {product.configuration.badge && <em>{product.configuration.badge}</em>}
                  </div>
                  <div className="card-copy">
                    <small>{linked.garment?.configuration.customization.category || "Brand Product"}</small>
                    <h3>{product.name}</h3>
                    <div><strong>${Number(product.retail_price || 0).toFixed(2)}</strong>{Number(product.compare_at_price || 0) > Number(product.retail_price || 0) && <del>${Number(product.compare_at_price).toFixed(2)}</del>}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="brand-store-empty">
            <span>01</span>
            <h2>{preview ? "No previewable Brand products yet." : "The collection is being prepared."}</h2>
            <p>{preview ? "Build a product from a Brand garment, approved design, placement, colors, sizes, and retail price." : "Please check back shortly."}</p>
            {preview && <a href="/dashboard/brand-products">Build Brand Product</a>}
          </div>
        )}
      </section>

      {selected && detailOpen && (
        <div className={compact ? "brand-product-detail inline" : "brand-product-detail-backdrop"} onClick={(event) => { if (!compact && event.currentTarget === event.target) setDetailOpen(false); }}>
          <section id="brand-product-detail" className="brand-product-detail">
            <button className="detail-close" onClick={() => setDetailOpen(false)}>×</button>

            <div className="detail-visual-wrap">
              <ProductVisual shop={shop} product={selected} colorId={color?.id} className="detail-visual" />
              <div className="detail-visual-caption"><span>{garment?.name}</span><small>{placement ? `${placement.side} · ${placement.printSize}` : "Brand product"}</small></div>
            </div>

            <div className="detail-buy">
              <div className="detail-heading">
                <small>{garment?.configuration.customization.category || "MERCHANDISE"}</small>
                <h2>{selected.name}</h2>
                {selected.description && <p>{selected.description}</p>}
                <div className="detail-price"><strong>${unitPrice.toFixed(2)}</strong>{Number(selected.compare_at_price || 0) > unitPrice && <del>${Number(selected.compare_at_price).toFixed(2)}</del>}</div>
              </div>

              {availableColors.length > 1 && (
                <section className="detail-option">
                  <header><strong>Color</strong><span>{color?.name}</span></header>
                  <div className="detail-colors">
                    {availableColors.map((item) => (
                      <button key={item.id} className={item.id === color?.id ? "active" : ""} onClick={() => setColorId(item.id)} title={item.name}>
                        <i style={{ background: item.hex }} /><span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="detail-option">
                <header><strong>Size & quantity</strong><span>{totalQuantity} selected</span></header>
                <div className="detail-sizes">
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
              </section>

              <section className="detail-customer">
                <input placeholder="Full name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
                <input type="email" placeholder="Email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
                <input placeholder="Phone (optional)" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
                <textarea rows={2} placeholder="Order note (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </section>

              {error && <div className="detail-error">{error}</div>}
              <button className="detail-checkout" disabled={busy || totalQuantity < 1 || (!preview && !shop.paymentReady)} onClick={checkout}>
                {preview ? "Preview mode · checkout disabled" : busy ? "Preparing checkout…" : !shop.paymentReady ? "Checkout unavailable" : totalQuantity ? `Checkout · $${totalPrice.toFixed(2)}` : "Choose size & quantity"}
              </button>
              <small className="detail-trust">{shop.business.settings.trustMessage}</small>
            </div>
          </section>
        </div>
      )}

      {!compact && <footer className="brand-store-footer"><strong>{shop.business.name}</strong><span>Powered by PrintFlow Brand Commerce</span></footer>}

      <style jsx>{`
        .brand-commerce-store{min-height:100vh;padding:14px;background:var(--surface);color:#171717}.brand-commerce-store.embed{min-height:0;padding:0;background:transparent}
        .brand-preview-banner{position:sticky;top:0;z-index:90;display:flex;justify-content:space-between;gap:14px;align-items:center;max-width:1440px;margin:0 auto 8px;padding:9px 12px;border-radius:10px;background:#1f2947;color:#fff}.brand-preview-banner strong,.brand-preview-banner span{display:block}.brand-preview-banner strong{font-size:7px;letter-spacing:.1em}.brand-preview-banner span{margin-top:2px;font-size:7px;color:#cfd5e8}.brand-preview-banner a{color:#fff;font-size:8px;font-weight:800}
        .brand-store-header{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;max-width:1440px;margin:0 auto;padding:12px 14px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff}.brand-mark img{max-width:160px;max-height:34px}.brand-mark strong{font-size:15px}.brand-store-header nav{display:flex;gap:14px;align-items:center}.brand-store-header nav a,.brand-store-header nav button{border:0;background:transparent;color:#333;text-decoration:none;font-size:8px}.brand-store-header>span{text-align:right;font-size:7px;letter-spacing:.09em;text-transform:uppercase;color:#888}
        .brand-store-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,.7fr);gap:10px;max-width:1440px;margin:10px auto;background:#fff;border-radius:16px;overflow:hidden}.brand-store-hero>div:first-child{display:flex;flex-direction:column;justify-content:center;padding:clamp(28px,6vw,80px)}.brand-store-hero p{margin:0 0 8px;font-size:8px;font-weight:900;letter-spacing:.12em;color:var(--brand)}.brand-store-hero h1{max-width:760px;margin:0;font-size:clamp(45px,7vw,96px);line-height:.88;letter-spacing:-.055em}.brand-store-hero>div:first-child>span{max-width:600px;margin-top:15px;color:#676767;line-height:1.5}.brand-store-hero a{align-self:flex-start;margin-top:20px;color:#171717;font-size:9px;font-weight:850;text-decoration:none}.hero-product{height:100%;min-height:440px;background:#f1f1ed}
        .brand-shop-section{max-width:1440px;margin:0 auto;padding:18px;border-radius:16px;background:rgba(255,255,255,.82)}.brand-shop-section>header{display:flex;justify-content:space-between;gap:16px;align-items:end}.brand-shop-section>header small{font-size:7px;font-weight:900;letter-spacing:.12em;color:#888}.brand-shop-section>header h2{margin:2px 0 0;font-size:28px}.brand-shop-section>header>strong{font-size:8px;color:#888}.brand-collection-tabs{display:flex;gap:5px;overflow:auto;margin:12px 0}.brand-collection-tabs button{padding:7px 10px;border:1px solid #deded9;border-radius:99px;background:#fff;color:#444;white-space:nowrap;font-size:8px}.brand-collection-tabs button.active{background:var(--brand);border-color:var(--brand);color:var(--brand-text)}
        .brand-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.brand-store-card{min-width:0;padding:0;border:1px solid #e2e2dd;border-radius:12px;background:#fff;color:#171717;text-align:left;overflow:hidden}.brand-store-card:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(0,0,0,.06)}.card-art{position:relative}.card-art>span,.card-art>em{position:absolute;top:8px;padding:4px 6px;border-radius:99px;font-size:6px;font-style:normal;font-weight:900}.card-art>span{left:8px;background:#171717;color:#fff}.card-art>span.issue{background:#8e6427}.card-art>span.ready{background:#2b7b50}.card-art>em{right:8px;background:#fff;color:#171717}.card-copy{padding:10px}.card-copy small{font-size:6px;text-transform:uppercase;letter-spacing:.08em;color:#8a8a8a}.card-copy h3{min-height:31px;margin:3px 0 9px;font-size:12px;line-height:1.25}.card-copy>div{display:flex;gap:6px;align-items:baseline}.card-copy strong{font-size:14px}.card-copy del{font-size:8px;color:#999}
        :global(.brand-product-visual){background:#f3f3ef}.brand-store-card :global(.brand-product-visual svg){display:block;width:100%}.hero-product :global(svg){display:block;width:100%;height:100%}
        .brand-store-empty{display:grid;justify-items:center;padding:55px 20px;text-align:center}.brand-store-empty>span{display:grid;place-items:center;width:36px;height:36px;border-radius:99px;background:#171717;color:#fff;font-size:8px}.brand-store-empty h2{margin:12px 0 4px}.brand-store-empty p{max-width:520px;margin:0;color:#777}.brand-store-empty a{margin-top:12px;color:#171717;font-size:9px;font-weight:850}
        .brand-product-detail-backdrop{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:18px;background:rgba(12,14,18,.58);backdrop-filter:blur(5px)}.brand-product-detail{position:relative;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(330px,.7fr);width:min(1060px,100%);max-height:92vh;border-radius:18px;background:#fff;overflow:auto;box-shadow:0 30px 90px rgba(0,0,0,.3)}.brand-product-detail.inline{position:static;width:100%;max-height:none;margin-top:10px;border:1px solid #ddd;box-shadow:none}.detail-close{position:absolute;right:10px;top:10px;z-index:3;display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:99px;background:#fff;font-size:18px;box-shadow:0 3px 12px rgba(0,0,0,.08)}.detail-visual-wrap{min-height:560px;background:#f3f3ef}.detail-visual :global(svg){display:block;width:100%;height:100%;max-height:650px}.detail-visual-caption{display:flex;justify-content:space-between;padding:10px 14px;font-size:7px;color:#777}.detail-buy{display:grid;align-content:start;gap:13px;padding:28px 24px}.detail-heading>small{font-size:7px;letter-spacing:.1em;color:#888}.detail-heading h2{margin:4px 0;font-size:30px;line-height:.98}.detail-heading p{margin:8px 0;color:#777;font-size:9px;line-height:1.5}.detail-price{display:flex;gap:7px;align-items:baseline;margin-top:9px}.detail-price strong{font-size:24px}.detail-price del{font-size:9px;color:#999}.detail-option{padding-top:12px;border-top:1px solid #eee}.detail-option>header{display:flex;justify-content:space-between;margin-bottom:8px}.detail-option>header strong{font-size:9px}.detail-option>header span{font-size:8px;color:#777}.detail-colors{display:flex;flex-wrap:wrap;gap:5px}.detail-colors button{display:flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;background:#fff;color:#333;font-size:7px}.detail-colors button.active{border-color:#171717;box-shadow:inset 0 0 0 1px #171717}.detail-colors i{width:13px;height:13px;border:1px solid rgba(0,0,0,.15);border-radius:99px}.detail-sizes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.detail-sizes label{display:grid;gap:4px;padding:6px;border-radius:8px;background:#f4f4f0}.detail-sizes label>span{font-size:8px;font-weight:850}.detail-sizes label>div{display:grid;grid-template-columns:23px minmax(0,1fr) 23px}.detail-sizes button{border:0;background:#fff}.detail-sizes input{min-width:0;width:100%;box-sizing:border-box;border:0;text-align:center}.detail-customer{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding-top:12px;border-top:1px solid #eee}.detail-customer input,.detail-customer textarea{width:100%;box-sizing:border-box}.detail-customer textarea{grid-column:1/-1}.detail-error{padding:8px;border-radius:8px;background:#fff0f0;color:#982f2f;font-size:8px}.detail-checkout{width:100%;padding:13px;border:0;border-radius:9px;background:var(--brand);color:var(--brand-text);font-weight:900}.detail-checkout:disabled{opacity:.45}.detail-trust{text-align:center;color:#888;font-size:6px}.brand-store-footer{display:flex;justify-content:space-between;max-width:1440px;margin:10px auto 0;padding:22px 8px;color:#666}.brand-store-footer strong{font-size:10px}.brand-store-footer span{font-size:7px}
        .embed .brand-shop-section{padding:12px;border-radius:12px}.embed .brand-product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.embed .brand-product-detail.inline{grid-template-columns:minmax(0,1fr) minmax(300px,.8fr)}
        @media(max-width:980px){.brand-store-hero{grid-template-columns:1fr}.hero-product{min-height:360px}.brand-product-detail{grid-template-columns:1fr 1fr}.detail-visual-wrap{min-height:430px}}
        @media(max-width:760px){.brand-commerce-store{padding:6px}.brand-store-header{grid-template-columns:1fr auto}.brand-store-header nav{display:none}.brand-store-hero>div:first-child{padding:35px 22px}.brand-store-hero h1{font-size:50px}.brand-product-grid,.embed .brand-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.brand-product-detail,.embed .brand-product-detail.inline{grid-template-columns:1fr}.detail-visual-wrap{min-height:0}.detail-buy{padding:18px 14px}.detail-customer{grid-template-columns:1fr}.detail-customer textarea{grid-column:auto}}
        @media(max-width:480px){.brand-preview-banner{display:grid}.brand-product-grid,.embed .brand-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.card-copy{padding:8px}.card-copy h3{font-size:10px}.detail-sizes{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>
    </main>
  );
}
