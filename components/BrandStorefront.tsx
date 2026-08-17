"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { brandArtworkUrl, chooseBrandVariant } from "@/lib/brand-designs";
import type { BrandMerchProduct } from "@/lib/brand-retail";
import type { BrandDesign, BrandStoreProduct, PublicBrandShop } from "@/lib/brand-types";
import type { SizeQuantity } from "@/lib/types";

const W = 800;
const H = 800;

function assetUrl(url?: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname.endsWith("ssactivewear.com")) return `/api/public/supplier-image?url=${encodeURIComponent(parsed.toString())}`;
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

function productConnections(shop: PublicBrandShop, merch: BrandMerchProduct | undefined) {
  if (!merch) return { garment: undefined, design: undefined, placement: undefined };
  const garment = shop.garments.find((item) => item.brandGarmentId === merch.brand_garment_id);
  const design = shop.brandDesigns.find((item) => item.id === merch.brand_design_id);
  const rule = design?.productRules.find((item) => item.productId === garment?.id);
  const placement = rule?.placements?.[merch.placement_key];
  return { garment, design, placement };
}

function displayPrice(product?: BrandMerchProduct) {
  return Number(product?.retail_price || 0);
}

export default function BrandStorefront({ shop }: { shop: PublicBrandShop }) {
  const compact = shop.presentation === "embed";
  const [collectionId, setCollectionId] = useState("All");
  const collection = shop.collections.find((item) => item.id === collectionId);

  const visibleProducts = useMemo(() => {
    if (!collection) return shop.merchProducts;
    return shop.merchProducts.filter((item) => collection.merchProductIds.includes(item.id));
  }, [shop.merchProducts, collection]);

  const [selectedId, setSelectedId] = useState(visibleProducts[0]?.id || shop.merchProducts[0]?.id || "");
  const merch = visibleProducts.find((item) => item.id === selectedId) || visibleProducts[0] || shop.merchProducts[0];
  const { garment, design, placement } = productConnections(shop, merch);

  const availableColors = garment?.configuration.colors.filter((item) => merch?.configuration.colorIds.includes(item.id)) || [];
  const [colorId, setColorId] = useState(availableColors[0]?.id || "");
  const color = availableColors.find((item) => item.id === colorId) || availableColors[0];

  const availableSizes = garment?.configuration.sizes.filter((size) => merch?.configuration.sizes.includes(size)) || [];
  const [sizes, setSizes] = useState<SizeQuantity[]>(availableSizes.map((size) => ({ size, quantity: 0 })));
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const variant = design ? chooseBrandVariant(design.variants, color as any) : null;
  const garmentImage = placement?.side === "back"
    ? color?.backImageUrl || garment?.configuration.mockupImageUrl
    : color?.frontImageUrl || garment?.configuration.mockupImageUrl;

  const totalQuantity = sizes.reduce((sum, item) => sum + item.quantity, 0);
  const unitPrice = displayPrice(merch);
  const totalPrice = unitPrice * totalQuantity;

  useEffect(() => {
    if (!compact) return;
    const send = () => window.parent.postMessage({ type: "printflow:resize", height: document.documentElement.scrollHeight }, "*");
    send();
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [compact]);

  useEffect(() => {
    const next = visibleProducts[0] || shop.merchProducts[0];
    if (!next) return;
    if (!visibleProducts.some((item) => item.id === selectedId)) chooseProduct(next.id);
  }, [collectionId]);

  function chooseProduct(id: string) {
    const next = shop.merchProducts.find((item) => item.id === id);
    if (!next) return;
    const links = productConnections(shop, next);
    const colors = links.garment?.configuration.colors.filter((item) => next.configuration.colorIds.includes(item.id)) || [];
    const sizeNames = links.garment?.configuration.sizes.filter((size) => next.configuration.sizes.includes(size)) || [];

    setSelectedId(id);
    setColorId(colors[0]?.id || "");
    setSizes(sizeNames.map((size) => ({ size, quantity: 0 })));
    setError("");
    if (compact) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateSize(size: string, quantity: number) {
    setSizes((current) => current.map((item) =>
      item.size === size ? { ...item, quantity: Math.max(0, Math.floor(quantity || 0)) } : item
    ));
  }

  async function renderPreview() {
    if (!garment || !color || !variant || !placement) throw new Error("Product preview is incomplete.");

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f5f5f1";
    ctx.fillRect(0, 0, W, H);

    const background = assetUrl(
      placement.side === "back"
        ? color.backImageUrl || garment.configuration.mockupImageUrl
        : color.frontImageUrl || garment.configuration.mockupImageUrl
    );

    if (background) {
      const image = await loadImage(background);
      const scale = Math.min(W / image.width, H / image.height) * 0.92;
      ctx.drawImage(image, (W - image.width * scale) / 2, (H - image.height * scale) / 2, image.width * scale, image.height * scale);
    }

    const art = await loadImage(brandArtworkUrl(variant.id));
    ctx.drawImage(art, placement.placement.x, placement.placement.y, placement.placement.width, placement.placement.height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to render product mockup.")), "image/png", 0.95)
    );
  }

  async function checkout() {
    setError("");

    if (!merch || !garment || !design || !placement || !variant || !color) return setError("This product is not fully configured.");
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
          brandProductId: merch.id,
          colorId: color.id,
          sizes,
          customer,
          notes
        })
      });

      const data = await start.json();
      if (!start.ok) throw new Error(data.error || "Unable to create Brand order.");

      const preview = await renderPreview();
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );

      const upload = data.previewUpload;
      const uploaded = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, preview, { contentType: "image/png" });

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

  if (!shop.active || !shop.merchProducts.length) {
    return (
      <main className={`retail-store ${compact ? "embed" : ""}`} style={{ "--surface": shop.business.settings.surfaceColor } as React.CSSProperties}>
        <section className="retail-empty">
          {shop.business.settings.logoUrl ? <img src={shop.business.settings.logoUrl} alt={shop.business.name} /> : <h1>{shop.business.name}</h1>}
          <p>The Brand store is being prepared. Please check back shortly.</p>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`retail-store ${compact ? "embed" : ""}`}
      style={{
        "--brand": shop.business.settings.primaryColor,
        "--brand-text": shop.business.settings.textColor,
        "--accent": shop.business.settings.accentColor,
        "--surface": shop.business.settings.surfaceColor
      } as React.CSSProperties}
    >
      {!compact && (
        <header className="retail-header">
          <div>
            {shop.business.settings.logoUrl
              ? <img src={shop.business.settings.logoUrl} alt={shop.business.name} />
              : <strong>{shop.business.name}</strong>}
          </div>
          <span>Merchandise</span>
        </header>
      )}

      <section className="retail-hero">
        {!compact && (
          <div>
            <p>{shop.business.settings.heroBadge}</p>
            <h1>{shop.business.settings.headline}</h1>
            <span>{shop.business.settings.introduction}</span>
          </div>
        )}

        {shop.collections.length > 0 && (
          <nav className="retail-collections" aria-label="Collections">
            <button className={collectionId === "All" ? "active" : ""} onClick={() => setCollectionId("All")}>All Products</button>
            {shop.collections.map((item) => (
              <button key={item.id} className={collectionId === item.id ? "active" : ""} onClick={() => setCollectionId(item.id)}>{item.name}</button>
            ))}
          </nav>
        )}
      </section>

      <div className="retail-layout">
        <section className="retail-catalog">
          <div className="catalog-heading">
            <span>{collection?.name || "Merchandise"}</span>
            <b>{visibleProducts.length} product{visibleProducts.length === 1 ? "" : "s"}</b>
          </div>

          <div className="retail-product-grid">
            {visibleProducts.map((item) => {
              const links = productConnections(shop, item);
              const firstColor = links.garment?.configuration.colors.find((candidate) => item.configuration.colorIds.includes(candidate.id));
              const image = links.placement?.side === "back"
                ? firstColor?.backImageUrl || links.garment?.configuration.mockupImageUrl
                : firstColor?.frontImageUrl || links.garment?.configuration.mockupImageUrl;
              const art = links.design ? chooseBrandVariant(links.design.variants, firstColor as any) : null;

              return (
                <button key={item.id} className={item.id === merch?.id ? "active" : ""} onClick={() => chooseProduct(item.id)}>
                  <div className="catalog-image">
                    <svg viewBox="0 0 800 800">
                      <rect width="800" height="800" fill="#f5f5f1" />
                      {image && <image href={assetUrl(image)} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet" />}
                      {art && links.placement && (
                        <image
                          href={brandArtworkUrl(art.id)}
                          x={links.placement.placement.x}
                          y={links.placement.placement.y}
                          width={links.placement.placement.width}
                          height={links.placement.placement.height}
                        />
                      )}
                    </svg>
                    {item.configuration.badge && <span>{item.configuration.badge}</span>}
                  </div>
                  <div className="catalog-copy">
                    <small>{links.garment?.configuration.customization.category || "Brand Product"}</small>
                    <h2>{item.name}</h2>
                    <div><strong>${displayPrice(item).toFixed(2)}</strong>{Number(item.compare_at_price || 0) > displayPrice(item) && <del>${Number(item.compare_at_price).toFixed(2)}</del>}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {merch && garment && design && placement && (
          <aside className="retail-buy-panel">
            <div className="retail-product-stage">
              <svg viewBox="0 0 800 800">
                <rect width="800" height="800" fill="#f5f5f1" />
                {garmentImage && <image href={assetUrl(garmentImage)} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet" />}
                {variant && <image href={brandArtworkUrl(variant.id)} x={placement.placement.x} y={placement.placement.y} width={placement.placement.width} height={placement.placement.height} />}
              </svg>
            </div>

            <div className="retail-product-info">
              <small>{garment.name}</small>
              <h2>{merch.name}</h2>
              {merch.description && <p>{merch.description}</p>}
              <div className="retail-price"><strong>${unitPrice.toFixed(2)}</strong>{Number(merch.compare_at_price || 0) > unitPrice && <del>${Number(merch.compare_at_price).toFixed(2)}</del>}</div>
            </div>

            {availableColors.length > 1 && (
              <section className="retail-option">
                <header><strong>Color</strong><span>{color?.name}</span></header>
                <div className="retail-colors">
                  {availableColors.map((item) => (
                    <button type="button" key={item.id} className={item.id === color?.id ? "active" : ""} onClick={() => setColorId(item.id)}>
                      <i style={{ background: item.hex }} /><span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="retail-option">
              <header><strong>Size & quantity</strong><span>{totalQuantity || 0} selected</span></header>
              <div className="retail-sizes">
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

            <section className="retail-customer">
              <input placeholder="Full name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
              <input type="email" placeholder="Email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
              <input placeholder="Phone (optional)" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
              <textarea rows={2} placeholder="Order note (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </section>

            {error && <div className="retail-error">{error}</div>}

            <button className="retail-checkout" disabled={busy || totalQuantity < 1 || !shop.paymentReady} onClick={checkout}>
              {busy ? "Preparing checkout…" : !shop.paymentReady ? "Checkout unavailable" : totalQuantity ? `Checkout · $${totalPrice.toFixed(2)}` : "Choose a size"}
            </button>

            <small className="retail-trust">{shop.business.settings.trustMessage}</small>
          </aside>
        )}
      </div>

      <style jsx>{`
        .retail-store{min-height:100vh;padding:16px;background:var(--surface);color:#171717}.retail-store.embed{min-height:0;padding:0;background:transparent}
        .retail-header{display:flex;align-items:center;justify-content:space-between;max-width:1400px;margin:0 auto;padding:12px 15px;border:1px solid rgba(0,0,0,.07);border-radius:13px;background:#fff}.retail-header img{max-height:34px;max-width:150px}.retail-header strong{font-size:14px}.retail-header>span{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#777}
        .retail-hero{max-width:1400px;margin:0 auto}.retail-hero>div{padding:32px 8px 22px}.retail-hero p{margin:0 0 7px;font-size:8px;font-weight:850;letter-spacing:.11em;color:var(--brand)}.retail-hero h1{margin:0;font-size:clamp(36px,5vw,68px);line-height:.92;letter-spacing:-.05em}.retail-hero>div>span{display:block;margin-top:10px;color:#666}.retail-collections{display:flex;gap:5px;overflow:auto;padding:0 0 12px}.retail-collections button{padding:7px 10px;border:1px solid rgba(0,0,0,.1);border-radius:99px;background:#fff;color:#444;white-space:nowrap;font-size:8px}.retail-collections button.active{background:var(--brand);color:var(--brand-text);border-color:var(--brand)}
        .retail-layout{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:12px;max-width:1400px;margin:0 auto;align-items:start}.retail-catalog{min-width:0;padding:14px;border:1px solid rgba(0,0,0,.07);border-radius:15px;background:rgba(255,255,255,.72)}.catalog-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.catalog-heading span{font-size:11px;font-weight:800}.catalog-heading b{font-size:8px;color:#777}
        .retail-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.retail-product-grid>button{min-width:0;padding:0;border:1px solid #e2e2dd;border-radius:12px;background:#fff;color:#171717;text-align:left;overflow:hidden}.retail-product-grid>button.active{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand)}.catalog-image{position:relative;background:#f5f5f1}.catalog-image svg{display:block;width:100%}.catalog-image>span{position:absolute;left:8px;top:8px;padding:4px 6px;border-radius:99px;background:#171717;color:#fff;font-size:6px;font-weight:800}.catalog-copy{padding:9px}.catalog-copy small{font-size:6px;color:#888;text-transform:uppercase;letter-spacing:.08em}.catalog-copy h2{min-height:28px;margin:3px 0 7px;font-size:10px;line-height:1.25}.catalog-copy div{display:flex;align-items:baseline;gap:5px}.catalog-copy strong{font-size:12px}.catalog-copy del{font-size:7px;color:#888}
        .retail-buy-panel{position:sticky;top:12px;display:grid;gap:10px;padding:12px;border:1px solid rgba(0,0,0,.08);border-radius:15px;background:#fff;box-shadow:0 12px 35px rgba(0,0,0,.06)}.retail-product-stage{overflow:hidden;border-radius:11px;background:#f5f5f1}.retail-product-stage svg{display:block;width:100%;max-height:390px}.retail-product-info small{font-size:7px;color:#888}.retail-product-info h2{margin:3px 0;font-size:20px;line-height:1.05}.retail-product-info p{margin:6px 0;color:#777;font-size:8px;line-height:1.45}.retail-price{display:flex;gap:6px;align-items:baseline;margin-top:7px}.retail-price strong{font-size:19px}.retail-price del{font-size:8px;color:#888}
        .retail-option{padding-top:10px;border-top:1px solid #eee}.retail-option>header{display:flex;justify-content:space-between;margin-bottom:7px}.retail-option>header strong{font-size:9px}.retail-option>header span{font-size:8px;color:#777}.retail-colors{display:flex;flex-wrap:wrap;gap:5px}.retail-colors button{display:flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #ddd;border-radius:7px;background:#fff;color:#333;font-size:7px}.retail-colors button.active{border-color:#171717;box-shadow:inset 0 0 0 1px #171717}.retail-colors i{width:13px;height:13px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}
        .retail-sizes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.retail-sizes label{display:grid;gap:4px;padding:6px;border-radius:7px;background:#f5f5f1}.retail-sizes label>span{font-size:8px;font-weight:800}.retail-sizes label>div{display:grid;grid-template-columns:22px minmax(0,1fr) 22px}.retail-sizes button{border:0;background:#fff}.retail-sizes input{min-width:0;width:100%;box-sizing:border-box;border:0;text-align:center}
        .retail-customer{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding-top:10px;border-top:1px solid #eee}.retail-customer input,.retail-customer textarea{min-width:0;width:100%;box-sizing:border-box}.retail-customer textarea{grid-column:1/-1}.retail-error{padding:8px;border-radius:7px;background:#fff1f1;color:#a32f2f;font-size:8px}.retail-checkout{width:100%;padding:12px;border:0;border-radius:9px;background:var(--brand);color:var(--brand-text);font-weight:850}.retail-checkout:disabled{opacity:.45}.retail-trust{text-align:center;color:#888;font-size:6px}
        .retail-empty{display:grid;justify-items:center;max-width:600px;margin:90px auto;padding:35px;border-radius:18px;background:#fff;text-align:center}.retail-empty img{max-height:55px;max-width:180px}.retail-empty p{color:#777}
        .embed .retail-hero>div{display:none}.embed .retail-layout{max-width:none;grid-template-columns:minmax(0,1fr) 390px}.embed .retail-catalog{border-radius:12px}.embed .retail-product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
        @media(max-width:1050px){.retail-layout,.embed .retail-layout{grid-template-columns:1fr}.retail-buy-panel{position:static;max-width:700px}.retail-product-grid,.embed .retail-product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:700px){.retail-store{padding:7px}.retail-product-grid,.embed .retail-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.retail-customer{grid-template-columns:1fr}.retail-customer textarea{grid-column:auto}.retail-buy-panel{padding:9px}.retail-sizes{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>
    </main>
  );
}
