"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { printAreaFor, pricingForPrintOrder } from "@/lib/catalog";
import type {
  ArtworkPlacement,
  CatalogProduct,
  DesignMode,
  DesignSide,
  PrintArea,
  PrintSize,
  PublicShop,
  ShirtColor,
  SizeQuantity
} from "@/lib/types";

const W = 800;
const H = 800;
const emptyPlacement: ArtworkPlacement = { x: 280, y: 260, width: 240, height: 240, rotation: 0 };
const ARTWORK_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml"
};

type SideState = { file: File | null; mimeType: string; dataUrl: string; placement: ArtworkPlacement };
const freshSide = (): SideState => ({ file: null, mimeType: "", dataUrl: "", placement: { ...emptyPlacement } });

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

function extension(filename: string) {
  return filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

function normalizedArtworkMime(file: File) {
  return ARTWORK_MIME_BY_EXTENSION[extension(file.name)] || (file.type === "image/jpg" ? "image/jpeg" : file.type);
}

function modeLabel(mode: DesignMode) {
  return mode === "front" ? "Front only" : mode === "back" ? "Back only" : "Front + back";
}

function printSizeLabel(size: PrintSize) {
  return size === "heart" ? "Heart Size" : "Full Size";
}

function safeFilename(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "printflow";
}

function formatMegabytes(bytes: number) {
  return Math.round(bytes / 1024 / 1024);
}

function loadImage(src: string, crossOrigin = false) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An image could not be loaded for the mockup."));
    image.src = src;
  });
}

function fitPlacementToArea(placement: ArtworkPlacement, area: PrintArea) {
  const maxWidth = Math.min(area.artworkWidth || area.width, area.width);
  const maxHeight = Math.min(area.artworkHeight || area.height, area.height);
  const ratio = Math.min(maxWidth / placement.width, maxHeight / placement.height, 1);
  const width = Math.max(40, placement.width * ratio);
  const height = Math.max(40, placement.height * ratio);
  return {
    ...placement,
    width,
    height,
    x: Math.max(area.x, Math.min(area.x + area.width - width, area.defaultX ?? area.x + (area.width - width) / 2)),
    y: Math.max(area.y, Math.min(area.y + area.height - height, area.defaultY ?? area.y + (area.height - height) / 2))
  };
}

export default function DesignerApp({ shop }: { shop: PublicShop }) {
  const products = shop.products.filter((item) => item.active);
  const firstProduct = products[0];
  const [step, setStep] = useState<"products" | "customize">("products");
  const [product, setProduct] = useState<CatalogProduct>(firstProduct);
  const [color, setColor] = useState<ShirtColor>(firstProduct?.configuration.colors[0]);
  const [mode, setMode] = useState<DesignMode>(firstProduct?.configuration.customization.designModes[0] || "front");
  const [side, setSide] = useState<DesignSide>("front");
  const [printSizes, setPrintSizes] = useState<Record<DesignSide, PrintSize>>({ front: "heart", back: "heart" });
  const [sizes, setSizes] = useState<SizeQuantity[]>(firstProduct?.configuration.sizes.map((size) => ({ size, quantity: 0 })) || []);
  const [decoration, setDecoration] = useState(firstProduct?.configuration.customization.decorationMethods[0] || "Screen Print");
  const [front, setFront] = useState<SideState>(freshSide());
  const [back, setBack] = useState<SideState>(freshSide());
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [mockupBusy, setMockupBusy] = useState<DesignSide | null>(null);
  const [completed, setCompleted] = useState<{ displayId: string; checkoutUrl: string } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<any>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const neededSides: DesignSide[] = mode === "front-back" ? ["front", "back"] : [mode];
  const sideState = side === "front" ? front : back;
  const setSideState = side === "front" ? setFront : setBack;
  const currentPrintSize = printSizes[side];
  const printArea = printAreaFor(product.configuration, side, currentPrintSize);
  const garmentUrl = assetUrl(
    side === "front" ? color?.frontImageUrl || product.configuration.mockupImageUrl : color?.backImageUrl || product.configuration.mockupImageUrl
  );
  const totalAssigned = useMemo(() => sizes.reduce((sum, item) => sum + item.quantity, 0), [sizes]);
  const minimum = product?.configuration.customization.minimumQuantity || 12;
  const selectedPrints = {
    front: neededSides.includes("front") ? printSizes.front : undefined,
    back: neededSides.includes("back") ? printSizes.back : undefined
  };
  const pricing = pricingForPrintOrder(product?.configuration.packages || [], totalAssigned || minimum, selectedPrints);
  const totalPrice = pricing.totalPrice;
  const uploadLimitMb = formatMegabytes(shop.settings.upload.maxBytes);

  useEffect(() => {
    const send = () => window.parent.postMessage({ type: "printflow:resize", height: document.documentElement.scrollHeight }, "*");
    send();
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    },
    []
  );

  function releaseSide(state: SideState) {
    if (state.dataUrl.startsWith("blob:")) {
      URL.revokeObjectURL(state.dataUrl);
      objectUrlsRef.current.delete(state.dataUrl);
    }
  }

  function clearSide(target: DesignSide) {
    const current = target === "front" ? front : back;
    releaseSide(current);
    (target === "front" ? setFront : setBack)(freshSide());
  }

  function chooseProduct(next: CatalogProduct) {
    releaseSide(front);
    releaseSide(back);
    setProduct(next);
    setColor(next.configuration.colors.find((item) => item.active !== false) || next.configuration.colors[0]);
    const nextMode = next.configuration.customization.designModes[0] || "front";
    setMode(nextMode);
    setSide(nextMode === "back" ? "back" : "front");
    setPrintSizes({ front: "heart", back: "heart" });
    setSizes(next.configuration.sizes.map((size) => ({ size, quantity: 0 })));
    setDecoration(next.configuration.customization.decorationMethods[0] || "Screen Print");
    setFront(freshSide());
    setBack(freshSide());
    setError("");
    setCompleted(null);
    setStep("customize");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseMode(next: DesignMode) {
    setMode(next);
    setSide(next === "back" ? "back" : "front");
  }

  function choosePrintSize(target: DesignSide, nextSize: PrintSize) {
    setPrintSizes((current) => ({ ...current, [target]: nextSize }));
    const state = target === "front" ? front : back;
    if (state.file) {
      const area = printAreaFor(product.configuration, target, nextSize);
      (target === "front" ? setFront : setBack)((current) => ({ ...current, placement: fitPlacementToArea(current.placement, area) }));
    }
  }

  async function handleArtwork(target: DesignSide, file?: File) {
    if (!file) return;
    setError("");
    const mimeType = normalizedArtworkMime(file);
    if (!shop.settings.upload.acceptedTypes.includes(mimeType)) return setError("Use PNG, JPG, WEBP, or SVG artwork.");
    if (file.size > shop.settings.upload.maxBytes) return setError(`Artwork must be ${uploadLimitMb} MB or smaller.`);

    try {
      const objectUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(objectUrl);
      const image = await loadImage(objectUrl);
      const area = printAreaFor(product.configuration, target, printSizes[target]);
      const maxWidth = Math.min(area.artworkWidth || area.width, area.width) * 0.92;
      const maxHeight = Math.min(area.artworkHeight || area.height, area.height) * 0.92;
      const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const width = image.width * ratio;
      const height = image.height * ratio;
      const placement = {
        x: Math.max(area.x, Math.min(area.x + area.width - width, area.defaultX ?? area.x + (area.width - width) / 2)),
        y: Math.max(area.y, Math.min(area.y + area.height - height, area.defaultY ?? area.y + (area.height - height) / 2)),
        width,
        height,
        rotation: 0
      };
      const previous = target === "front" ? front : back;
      releaseSide(previous);
      (target === "front" ? setFront : setBack)({ file, mimeType, dataUrl: objectUrl, placement });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to preview that artwork file.");
    }
  }

  function point(event: ReactPointerEvent<SVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
  }

  function begin(kind: "drag" | "resize", event: ReactPointerEvent<SVGElement>) {
    if (!sideState.dataUrl) return;
    event.preventDefault();
    const p = point(event);
    dragRef.current = { kind, p, placement: { ...sideState.placement } };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: ReactPointerEvent<SVGElement>) {
    if (!dragRef.current) return;
    const current = point(event);
    const dx = current.x - dragRef.current.p.x;
    const dy = current.y - dragRef.current.p.y;
    const start = dragRef.current.placement;
    if (dragRef.current.kind === "drag") {
      setSideState((state) => ({
        ...state,
        placement: {
          ...state.placement,
          x: Math.max(printArea.x, Math.min(printArea.x + printArea.width - start.width, start.x + dx)),
          y: Math.max(printArea.y, Math.min(printArea.y + printArea.height - start.height, start.y + dy))
        }
      }));
    } else {
      const maxWidth = Math.min(printArea.artworkWidth || printArea.width, printArea.x + printArea.width - start.x);
      const maxHeight = Math.min(printArea.artworkHeight || printArea.height, printArea.y + printArea.height - start.y);
      let width = Math.max(40, Math.min(maxWidth, start.width + dx));
      let height = width * (start.height / start.width);
      if (height > maxHeight) {
        height = maxHeight;
        width = height * (start.width / start.height);
      }
      setSideState((state) => ({ ...state, placement: { ...state.placement, width, height } }));
    }
  }

  function end() {
    dragRef.current = null;
  }

  function updateSize(size: string, quantity: number) {
    setSizes((current) => current.map((item) => (item.size === size ? { ...item, quantity: Math.max(0, Math.floor(quantity || 0)) } : item)));
  }

  function drawFallbackGarment(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = color.hex || "#d8d8d8";
    ctx.strokeStyle = "#b5b5b5";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(255, 150);
    ctx.lineTo(110, 245);
    ctx.lineTo(185, 380);
    ctx.lineTo(263, 338);
    ctx.lineTo(263, 668);
    ctx.lineTo(537, 668);
    ctx.lineTo(537, 338);
    ctx.lineTo(615, 380);
    ctx.lineTo(690, 245);
    ctx.lineTo(545, 150);
    ctx.lineTo(480, 205);
    ctx.lineTo(320, 205);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  async function renderSide(target: DesignSide) {
    const state = target === "front" ? front : back;
    const url = assetUrl(target === "front" ? color.frontImageUrl || product.configuration.mockupImageUrl : color.backImageUrl || product.configuration.mockupImageUrl);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#f5f5f2";
    ctx.fillRect(0, 0, W, H);

    if (url) {
      const garment = await loadImage(url, true);
      const scale = Math.min(W / garment.width, H / garment.height) * 0.92;
      ctx.drawImage(garment, (W - garment.width * scale) / 2, (H - garment.height * scale) / 2, garment.width * scale, garment.height * scale);
    } else {
      drawFallbackGarment(ctx);
    }

    if (state.dataUrl) {
      const art = await loadImage(state.dataUrl);
      ctx.drawImage(art, state.placement.x, state.placement.y, state.placement.width, state.placement.height);
    }

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Mockup rendering failed."))), "image/png", 0.96)
    );
  }

  async function downloadMockup(target: DesignSide) {
    const state = target === "front" ? front : back;
    if (!state.file) return setError(`Upload ${target} artwork before saving the mockup.`);
    setError("");
    setMockupBusy(target);
    try {
      const blob = await renderSide(target);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFilename(product.name)}-${safeFilename(color.name)}-${target}-${printSizes[target]}-mockup.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the mockup.");
    } finally {
      setMockupBusy(null);
    }
  }

  async function submit() {
    setError("");
    if (neededSides.some((target) => !(target === "front" ? front.file : back.file))) return setError(`Upload artwork for ${neededSides.join(" and ")}.`);
    if (!customer.name.trim() || !customer.email.trim()) return setError("Enter your name and email.");
    if (totalAssigned < minimum) return setError(`Your order must include at least ${minimum} items. You currently have ${totalAssigned}.`);
    setSubmitting(true);
    setSubmissionStatus("Preparing your order…");

    try {
      const sideUploads: Record<string, any> = {};
      for (const target of neededSides) {
        const state = target === "front" ? front : back;
        sideUploads[target] = {
          filename: state.file!.name,
          mimeType: state.mimeType,
          sizeBytes: state.file!.size,
          placement: state.placement,
          printSize: printSizes[target]
        };
      }

      const startResponse = await fetch("/api/designs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug: shop.slug,
          customer,
          configuration: {
            productId: product.id,
            packageId: pricing.tier?.id || "",
            colorId: color.id,
            designMode: mode,
            decorationMethod: decoration,
            printSizes: selectedPrints,
            sizes,
            notes,
            totalPrice,
            quantity: totalAssigned
          },
          artworks: sideUploads
        })
      });
      const startData = await startResponse.json();
      if (!startResponse.ok) throw new Error(startData.error || "Unable to begin submission.");

      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
      let completedSides = 0;
      for (const target of neededSides) {
        const state = target === "front" ? front : back;
        setSubmissionStatus(`Uploading ${target} production artwork…`);
        const preview = await renderSide(target);
        const upload = startData.uploads[target];
        const originalResult = await supabase.storage
          .from(upload.original.bucket)
          .uploadToSignedUrl(upload.original.path, upload.original.token, state.file!, { contentType: state.mimeType });
        if (originalResult.error) throw originalResult.error;
        setSubmissionStatus(`Saving ${target} mockup…`);
        const previewResult = await supabase.storage
          .from(upload.preview.bucket)
          .uploadToSignedUrl(upload.preview.path, upload.preview.token, preview, { contentType: "image/png" });
        if (previewResult.error) throw previewResult.error;
        completedSides += 1;
        setSubmissionStatus(`${completedSides} of ${neededSides.length} side${neededSides.length === 1 ? "" : "s"} saved…`);
      }

      setSubmissionStatus("Finalizing your design…");
      const finishResponse = await fetch("/api/designs/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: startData.designId })
      });
      const finishData = await finishResponse.json();
      if (!finishResponse.ok) throw new Error(finishData.error || "Unable to complete submission.");
      setCompleted({ displayId: startData.displayId, checkoutUrl: finishData.checkoutUrl });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit design.");
    } finally {
      setSubmitting(false);
      setSubmissionStatus("");
    }
  }

  if (!products.length) return <main className="designer-empty"><h1>No products are available yet.</h1></main>;

  if (completed)
    return (
      <main className="designer-complete modern-complete">
        <span>✓</span>
        <h1>Your design is ready.</h1>
        <p>Reference {completed.displayId}</p>
        <div className="complete-mockup-actions">
          {neededSides.map((target) => (
            <button key={target} onClick={() => downloadMockup(target)}>
              Save {target} mockup
            </button>
          ))}
        </div>
        <a className="designer-primary" href={completed.checkoutUrl}>
          Continue to payment · ${totalPrice.toFixed(2)}
        </a>
      </main>
    );

  return (
    <main
      className="designer-shell modern-customer-shell"
      style={{ "--brand": shop.settings.brand.primaryColor, "--brand-text": shop.settings.brand.textColor } as React.CSSProperties}
    >
      <header className="customer-header modern">
        {shop.settings.brand.logoUrl ? <img src={shop.settings.brand.logoUrl} alt={shop.name} /> : <strong>{shop.name}</strong>}
        <div>
          <small>Custom order studio</small>
          <b>{step === "products" ? "Choose a product" : product.name}</b>
        </div>
        {step === "customize" && <button onClick={() => setStep("products")}>← Products</button>}
      </header>

      {step === "products" ? (
        <section className="product-first-flow modern">
          <div className="customer-intro">
            <p className="eyebrow">START YOUR ORDER</p>
            <h1>{shop.settings.customerExperience?.headline || "Choose your blank. Make it yours."}</h1>
            <p>{shop.settings.customerExperience?.introduction || "Select a product to see colors, print options, and live pricing."}</p>
          </div>
          <div className="customer-product-grid modern">
            {products.map((item) => {
              const firstColor = item.configuration.colors.find((candidate) => candidate.active !== false) || item.configuration.colors[0];
              const min = item.configuration.customization.minimumQuantity;
              const price = pricingForPrintOrder(item.configuration.packages, min, { front: "heart" });
              return (
                <button className="customer-product-card modern" key={item.id} onClick={() => chooseProduct(item)}>
                  <div className="customer-product-image">
                    {firstColor?.frontImageUrl || item.configuration.mockupImageUrl ? (
                      <img src={assetUrl(firstColor?.frontImageUrl || item.configuration.mockupImageUrl)} alt={item.name} />
                    ) : (
                      <div className="product-placeholder">T</div>
                    )}
                    <span className="product-card-arrow">→</span>
                  </div>
                  <div>
                    <span>{item.configuration.customization.category}</span>
                    <h2>{item.name}</h2>
                    <p>{item.description}</p>
                    <div className="product-card-meta">
                      <small>{item.configuration.colors.filter((candidate) => candidate.active !== false).length} colors</small>
                      <small>{item.configuration.sizes.length} sizes</small>
                      <small>Min. {min}</small>
                    </div>
                    <strong>From ${price.unitPrice.toFixed(2)} each with print</strong>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="modern-designer-layout">
          <aside className="designer-step-panel">
            <div className="designer-step-heading">
              <p className="eyebrow">CUSTOMIZE</p>
              <h1>{product.name}</h1>
              <p>{product.description}</p>
            </div>
            <WizardSection number="1" title="Print sides">
              <div className="radio-card-grid">
                {product.configuration.customization.designModes.map((value) => (
                  <label key={value} className={mode === value ? "radio-card selected" : "radio-card"}>
                    <input type="radio" name="mode" checked={mode === value} onChange={() => chooseMode(value)} />
                    <span>
                      <b>{modeLabel(value)}</b>
                      <small>{value === "front-back" ? "Choose a separate print size and design for both sides." : `Artwork on the ${value} only.`}</small>
                    </span>
                    <i />
                  </label>
                ))}
              </div>
            </WizardSection>
            <WizardSection number="2" title="Print sizes">
              <div className="side-print-size-stack">
                {neededSides.map((target) => (
                  <div className="side-print-size-group" key={target}>
                    <span>{target === "front" ? "Front" : "Back"}</span>
                    <div className="print-size-choice-grid">
                      {(["heart", "full"] as PrintSize[]).map((value) => {
                        const area = printAreaFor(product.configuration, target, value);
                        return (
                          <label key={value} className={printSizes[target] === value ? "print-size-choice selected" : "print-size-choice"}>
                            <input type="radio" name={`${target}-print-size`} checked={printSizes[target] === value} onChange={() => choosePrintSize(target, value)} />
                            <span>
                              <b>{printSizeLabel(value)}</b>
                              <small>{area.widthInches}″ × {area.heightInches}″ max</small>
                            </span>
                            <em>{value === "heart" ? `$${pricing.tier ? Number(pricing.tier.heartPrintUnitPrice || 0).toFixed(2) : "0.00"}` : `$${pricing.tier ? Number(pricing.tier.fullPrintUnitPrice || 0).toFixed(2) : "0.00"}`}</em>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </WizardSection>
            <WizardSection number="3" title="Garment color">
              <div className="modern-color-picker">
                {product.configuration.colors
                  .filter((item) => item.active !== false)
                  .map((item) => (
                    <button key={item.id} className={color.id === item.id ? "selected" : ""} onClick={() => setColor(item)} title={item.name}>
                      <i style={{ background: item.hex }} />
                      <span>{item.name}</span>
                    </button>
                  ))}
              </div>
            </WizardSection>
            <WizardSection number="4" title="Decoration">
              <select className="modern-select" value={decoration} onChange={(event) => setDecoration(event.target.value)}>
                {product.configuration.customization.decorationMethods.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </WizardSection>
          </aside>

          <div className="modern-stage-column">
            <div className="stage-topbar">
              <div className="side-tabs modern">
                {neededSides.map((target) => (
                  <button key={target} className={side === target ? "selected" : ""} onClick={() => setSide(target)}>
                    {target === "front" ? "Front" : "Back"}
                    {(target === "front" ? front.file : back.file) ? <i>✓</i> : null}
                  </button>
                ))}
              </div>
              <div className="stage-topbar-actions">
                <span>
                  {printSizeLabel(currentPrintSize)} · {printArea.widthInches?.toFixed(1)}″ × {printArea.heightInches?.toFixed(1)}″ max
                </span>
                <button className="save-mockup-button" disabled={!sideState.file || mockupBusy !== null} onClick={() => downloadMockup(side)}>
                  {mockupBusy === side ? "Saving…" : "Save mockup"}
                </button>
              </div>
            </div>
            <div className="design-stage modern">
              <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
                <rect width={W} height={H} fill="#f6f6f3" />
                {garmentUrl ? (
                  <image href={garmentUrl} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet" />
                ) : (
                  <path d="M255 150 110 245l75 135 78-42v330h274V338l78 42 75-135-145-95-65 55H320z" fill={color.hex} stroke="#bbb" strokeWidth="3" />
                )}
                <rect
                  x={printArea.x}
                  y={printArea.y}
                  width={printArea.width}
                  height={printArea.height}
                  rx="8"
                  fill="rgba(255,255,255,.07)"
                  stroke="rgba(0,0,0,.48)"
                  strokeWidth="2"
                  strokeDasharray="11 9"
                />
                {!sideState.dataUrl && (
                  <rect
                    x={printArea.defaultX}
                    y={printArea.defaultY}
                    width={printArea.artworkWidth}
                    height={printArea.artworkHeight}
                    rx="6"
                    fill="rgba(255,255,255,.16)"
                    stroke="rgba(0,0,0,.28)"
                    strokeWidth="2"
                  />
                )}
                {sideState.dataUrl && (
                  <g>
                    <image
                      href={sideState.dataUrl}
                      x={sideState.placement.x}
                      y={sideState.placement.y}
                      width={sideState.placement.width}
                      height={sideState.placement.height}
                      onPointerDown={(event) => begin("drag", event)}
                      style={{ cursor: "move" }}
                    />
                    <rect
                      x={sideState.placement.x}
                      y={sideState.placement.y}
                      width={sideState.placement.width}
                      height={sideState.placement.height}
                      fill="none"
                      stroke="#111"
                      strokeWidth="2"
                      pointerEvents="none"
                    />
                    <circle
                      cx={sideState.placement.x + sideState.placement.width}
                      cy={sideState.placement.y + sideState.placement.height}
                      r="13"
                      fill="#111"
                      onPointerDown={(event) => begin("resize", event)}
                      style={{ cursor: "nwse-resize" }}
                    />
                  </g>
                )}
              </svg>
              <div className="stage-upload modern">
                <label>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(event) => {
                      const input = event.currentTarget;
                      void handleArtwork(side, input.files?.[0]).finally(() => {
                        input.value = "";
                      });
                    }}
                  />
                  {sideState.file ? `Replace ${side} artwork` : `Upload ${side} artwork`}
                </label>
                {sideState.file && <button onClick={() => clearSide(side)}>Remove</button>}
              </div>
            </div>
            <div className="stage-guidance">
              <p>{product.configuration.customization.customerInstructions}</p>
              <small>
                {printSizeLabel(currentPrintSize)} is limited to {printArea.widthInches}″ × {printArea.heightInches}″. Move the design anywhere inside the dashed placement zone and resize it up to the configured maximum. PNG, JPG, WEBP, or SVG · up to {uploadLimitMb} MB.
              </small>
            </div>
          </div>

          <aside className="modern-order-panel">
            <div>
              <p className="eyebrow">ORDER DETAILS</p>
              <h2>Choose quantities</h2>
              <p>Order any amount. The minimum is {minimum} items.</p>
            </div>
            <div className="modern-size-grid">
              {sizes.map((item) => (
                <label key={item.size}>
                  <span>{item.size}</span>
                  <div>
                    <button aria-label={`Decrease ${item.size}`} onClick={() => updateSize(item.size, item.quantity - 1)}>−</button>
                    <input type="number" min="0" inputMode="numeric" value={item.quantity || ""} onChange={(event) => updateSize(item.size, Number(event.target.value))} />
                    <button aria-label={`Increase ${item.size}`} onClick={() => updateSize(item.size, item.quantity + 1)}>+</button>
                  </div>
                </label>
              ))}
            </div>
            <div className={totalAssigned >= minimum ? "modern-quantity-status good" : "modern-quantity-status"}>
              <span>Total quantity</span>
              <b>{totalAssigned}</b>
              <small>{totalAssigned >= minimum ? "Minimum reached" : `${minimum - totalAssigned} more needed`}</small>
            </div>
            <div className="live-price-card component-breakdown">
              <div><span>Blank garment</span><b>${pricing.garmentUnitPrice.toFixed(2)} / shirt</b></div>
              {neededSides.includes("front") && <div><span>Front · {printSizeLabel(printSizes.front)}</span><b>${pricing.frontPrintUnitPrice.toFixed(2)} / shirt</b></div>}
              {neededSides.includes("back") && <div><span>Back · {printSizeLabel(printSizes.back)}</span><b>${pricing.backPrintUnitPrice.toFixed(2)} / shirt</b></div>}
              <div className="unit"><span>Unit price</span><b>${pricing.unitPrice.toFixed(2)} each</b></div>
              <div><span>{totalAssigned || minimum} garments</span><b>${pricing.totalPrice.toFixed(2)}</b></div>
              <div className="total"><span>Estimated total</span><b>${totalPrice.toFixed(2)}</b></div>
            </div>
            <details className="customer-details" open>
              <summary>Contact & notes</summary>
              <div>
                <input placeholder="Full name" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
                <input type="email" placeholder="Email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
                <input placeholder="Phone (optional)" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
                <textarea rows={3} placeholder="Order notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
            </details>
            {error && <div className="error-message">{error}</div>}
            {submissionStatus && <div className="submission-status"><i /><span>{submissionStatus}</span></div>}
            <button className="designer-primary full modern" disabled={submitting || totalAssigned < minimum} onClick={submit}>
              {submitting ? "Saving your order…" : `Continue · $${totalPrice.toFixed(2)}`}
            </button>
            <small className="disclaimer">{shop.settings.customerExperience?.artworkDisclaimer}</small>
          </aside>
        </section>
      )}
    </main>
  );
}

function WizardSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="wizard-section">
      <header>
        <span>{number}</span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}
