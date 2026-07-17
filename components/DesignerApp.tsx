"use client";

import { createClient } from "@supabase/supabase-js";
import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  CatalogProduct,
  ProductPackage,
  PublicShop,
  ShirtColor,
  SizeQuantity
} from "@/lib/types";

type Props = {
  shop: PublicShop;
};

type ArtworkState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 900;
const PRINT_AREA = { x: 260, y: 235, width: 280, height: 390 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function shirtPath() {
  return [
    "M255 95",
    "L185 122",
    "L72 225",
    "L150 338",
    "L220 284",
    "L220 780",
    "Q400 830 580 780",
    "L580 284",
    "L650 338",
    "L728 225",
    "L615 122",
    "L545 95",
    "Q518 181 400 181",
    "Q282 181 255 95",
    "Z"
  ].join(" ");
}

export default function DesignerApp({ shop }: Props) {
  const initialProduct = shop.products[0];
  const [selectedProductId, setSelectedProductId] = useState(initialProduct.id);
  const selectedProduct = shop.products.find((item) => item.id === selectedProductId) || initialProduct;
  const settings = {
    ...shop.settings,
    product: { name: selectedProduct.name, description: selectedProduct.description || undefined },
    ...selectedProduct.configuration
  };
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    mode: "drag" | "resize";
    startX: number;
    startY: number;
    startArt: ArtworkState;
  } | null>(null);

  const [selectedColor, setSelectedColor] = useState<ShirtColor>(initialProduct.configuration.colors[0] || { id: "default", name: "Default", hex: "#777777" });
  const [selectedPackage, setSelectedPackage] = useState<ProductPackage>(initialProduct.configuration.packages[0]);
  const [printLocation, setPrintLocation] = useState(initialProduct.configuration.printLocations[0]);
  const [sizes, setSizes] = useState<SizeQuantity[]>(initialProduct.configuration.sizes.map((size) => ({ size, quantity: 0 })));
  const [artFile, setArtFile] = useState<File | null>(null);
  const [artDataUrl, setArtDataUrl] = useState<string>("");
  const [artwork, setArtwork] = useState<ArtworkState>({
    x: 310,
    y: 300,
    width: 180,
    height: 180
  });
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: ""
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState<{
    displayId: string;
    checkoutUrl: string;
  } | null>(null);


  function selectProduct(product: CatalogProduct) {
    setSelectedProductId(product.id);
    setSelectedColor(product.configuration.colors[0] || { id: "default", name: "Default", hex: "#777777" });
    setSelectedPackage(product.configuration.packages[0]);
    setPrintLocation(product.configuration.printLocations[0]);
    setSizes(product.configuration.sizes.map((size) => ({ size, quantity: 0 })));
    setCompleted(null);
    setError("");
  }

  const totalAssigned = useMemo(
    () => sizes.reduce((sum, item) => sum + item.quantity, 0),
    [sizes]
  );

  useEffect(() => {
    const sendHeight = () => {
      window.parent.postMessage(
        {
          type: "printflow:resize",
          height: document.documentElement.scrollHeight
        },
        "*"
      );
    };

    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  function svgPoint(event: ReactPointerEvent<SVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT
    };
  }

  function beginArtworkInteraction(
    mode: "drag" | "resize",
    event: ReactPointerEvent<SVGElement>
  ) {
    if (!artDataUrl) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = svgPoint(event);
    dragRef.current = {
      mode,
      startX: point.x,
      startY: point.y,
      startArt: { ...artwork }
    };
  }

  function moveArtwork(event: ReactPointerEvent<SVGElement>) {
    const interaction = dragRef.current;
    if (!interaction) return;

    const point = svgPoint(event);
    const dx = point.x - interaction.startX;
    const dy = point.y - interaction.startY;

    if (interaction.mode === "drag") {
      const nextX = clamp(
        interaction.startArt.x + dx,
        PRINT_AREA.x,
        PRINT_AREA.x + PRINT_AREA.width - interaction.startArt.width
      );
      const nextY = clamp(
        interaction.startArt.y + dy,
        PRINT_AREA.y,
        PRINT_AREA.y + PRINT_AREA.height - interaction.startArt.height
      );

      setArtwork((current) => ({ ...current, x: nextX, y: nextY }));
      return;
    }

    const aspect = interaction.startArt.width / interaction.startArt.height;
    const maxWidth =
      PRINT_AREA.x + PRINT_AREA.width - interaction.startArt.x;
    const maxHeight =
      PRINT_AREA.y + PRINT_AREA.height - interaction.startArt.y;

    let nextWidth = clamp(interaction.startArt.width + dx, 60, maxWidth);
    let nextHeight = nextWidth / aspect;

    if (nextHeight > maxHeight) {
      nextHeight = maxHeight;
      nextWidth = nextHeight * aspect;
    }

    setArtwork((current) => ({
      ...current,
      width: nextWidth,
      height: nextHeight
    }));
  }

  function endArtworkInteraction(event: ReactPointerEvent<SVGElement>) {
    if (dragRef.current) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released.
      }
    }
    dragRef.current = null;
  }

  async function handleArtwork(file: File | null) {
    setError("");
    setCompleted(null);

    if (!file) {
      setArtFile(null);
      setArtDataUrl("");
      return;
    }

    if (!settings.upload.acceptedTypes.includes(file.type)) {
      setError("That artwork file type is not accepted.");
      return;
    }

    if (file.size > settings.upload.maxBytes) {
      setError(
        `Artwork must be smaller than ${Math.round(
          settings.upload.maxBytes / 1024 / 1024
        )} MB.`
      );
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read artwork."));
      reader.readAsDataURL(file);
    });

    const image = new Image();
    image.src = dataUrl;
    await image.decode();

    const maxWidth = 210;
    const maxHeight = 260;
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * ratio;
    const height = image.height * ratio;

    setArtwork({
      x: PRINT_AREA.x + (PRINT_AREA.width - width) / 2,
      y: PRINT_AREA.y + (PRINT_AREA.height - height) / 2,
      width,
      height
    });
    setArtFile(file);
    setArtDataUrl(dataUrl);
  }

  function updateSize(size: string, value: number) {
    setSizes((current) =>
      current.map((item) =>
        item.size === size
          ? { ...item, quantity: Math.max(0, Math.floor(value || 0)) }
          : item
      )
    );
  }

  async function renderPreview() {
    const svg = svgRef.current;
    if (!svg) throw new Error("Preview is not ready.");

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(VIEWBOX_WIDTH));
    clone.setAttribute("height", String(VIEWBOX_HEIGHT));

    clone
      .querySelectorAll("[data-editor-only='true']")
      .forEach((element) => element.remove());

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    try {
      const image = new Image();
      image.src = url;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = VIEWBOX_WIDTH;
      canvas.height = VIEWBOX_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (previewBlob) =>
            previewBlob
              ? resolve(previewBlob)
              : reject(new Error("Unable to create preview.")),
          "image/png",
          0.92
        );
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function submitDesign() {
    setError("");

    if (!artFile || !artDataUrl) {
      setError("Upload artwork before continuing.");
      return;
    }

    if (!customer.name.trim() || !customer.email.trim()) {
      setError("Enter the customer name and email.");
      return;
    }

    if (totalAssigned !== selectedPackage.quantity) {
      setError(
        `The size quantities must total ${selectedPackage.quantity}. You currently have ${totalAssigned}.`
      );
      return;
    }

    setSubmitting(true);

    try {
      const previewBlob = await renderPreview();

      const startResponse = await fetch("/api/designs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopSlug: shop.slug,
          customer,
          configuration: {
            productId: selectedProduct.id,
            packageId: selectedPackage.id,
            colorId: selectedColor.id,
            printLocation,
            sizes,
            notes
          },
          artwork: {
            filename: artFile.name,
            mimeType: artFile.type,
            sizeBytes: artFile.size
          }
        })
      });

      const startData = await startResponse.json();
      if (!startResponse.ok) {
        throw new Error(startData.error || "Unable to begin submission.");
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        throw new Error("Public Supabase settings are missing.");
      }

      const supabase = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false }
      });

      const originalUpload = await supabase.storage
        .from(startData.uploads.original.bucket)
        .uploadToSignedUrl(
          startData.uploads.original.path,
          startData.uploads.original.token,
          artFile,
          { contentType: artFile.type }
        );

      if (originalUpload.error) throw originalUpload.error;

      const previewUpload = await supabase.storage
        .from(startData.uploads.preview.bucket)
        .uploadToSignedUrl(
          startData.uploads.preview.path,
          startData.uploads.preview.token,
          previewBlob,
          { contentType: "image/png" }
        );

      if (previewUpload.error) throw previewUpload.error;

      const completeResponse = await fetch("/api/designs/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: startData.designId })
      });

      const completeData = await completeResponse.json();
      if (!completeResponse.ok) {
        throw new Error(completeData.error || "Unable to finalize submission.");
      }

      setCompleted(completeData);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      console.error(caught);
      setError(
        caught instanceof Error ? caught.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function continueToCheckout() {
    if (!completed) return;
    window.open(completed.checkoutUrl, "_top");
  }

  return (
    <main
      className="designer-page"
      style={
        {
          "--brand": settings.brand.primaryColor,
          "--brand-text": settings.brand.textColor
        } as React.CSSProperties
      }
    >
      <header className="designer-header">
        <div>
          {settings.brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.brand.logoUrl}
              alt={`${shop.name} logo`}
              className="shop-logo"
            />
          ) : (
            <p className="eyebrow">{shop.name}</p>
          )}
          <h1>{settings.customerExperience?.headline || "Design your custom shirts"}</h1>
          <p>{settings.customerExperience?.introduction || "Upload your artwork, position it on the shirt, assign the sizes, then continue to secure checkout."}</p>
        </div>
        <div className="header-price">
          <span>{selectedPackage.label}</span>
          <strong>{money(selectedPackage.price)}</strong>
        </div>
      </header>

      {completed ? (
        <section className="success-card">
          <div className="success-icon">✓</div>
          <p className="eyebrow">DESIGN SAVED</p>
          <h2>Your design is attached.</h2>
          <p>{settings.customerExperience?.confirmationMessage || "Your design is attached and ready for checkout."}</p>
          <p className="success-reference">Reference <strong>{completed.displayId}</strong> will follow the order through checkout and into production.</p>
          <button className="primary-button" onClick={continueToCheckout}>
            Continue to secure checkout
          </button>
          <button
            className="text-button"
            onClick={() => setCompleted(null)}
          >
            Make another change
          </button>
        </section>
      ) : (
        <div className="designer-grid">
          <section className="preview-panel">
            <div className="preview-topline">
              <span>Live preview</span>
              <span>{printLocation}</span>
            </div>
            {selectedProduct.configuration.supplier && <div className="supplier-product-note">{selectedProduct.configuration.supplier.brandName} {selectedProduct.configuration.supplier.styleName} · live supplier blank</div>}

            <div className="shirt-stage">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                role="img"
                aria-label="T-shirt design preview"
                onPointerMove={moveArtwork}
                onPointerUp={endArtworkInteraction}
                onPointerCancel={endArtworkInteraction}
              >
                <rect width="800" height="900" fill="#f5f5f2" rx="32" />
                <ellipse
                  cx="400"
                  cy="812"
                  rx="250"
                  ry="32"
                  fill="rgba(0,0,0,.10)"
                />
                {selectedColor.frontImageUrl ? (
                  <image
                    href={`/api/public/supplier-image?url=${encodeURIComponent(selectedColor.frontImageUrl)}`}
                    x="115"
                    y="55"
                    width="570"
                    height="750"
                    preserveAspectRatio="xMidYMid meet"
                  />
                ) : (
                  <>
                    <path d={shirtPath()} fill={selectedColor.hex} stroke="rgba(0,0,0,.18)" strokeWidth="4" />
                    <path d="M319 118 Q400 200 481 118" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="18" strokeLinecap="round" />
                  </>
                )}
                <rect
                  data-editor-only="true"
                  x={PRINT_AREA.x}
                  y={PRINT_AREA.y}
                  width={PRINT_AREA.width}
                  height={PRINT_AREA.height}
                  rx="10"
                  fill="none"
                  stroke="rgba(80,80,80,.65)"
                  strokeWidth="3"
                  strokeDasharray="12 10"
                />
                {!artDataUrl && (
                  <g data-editor-only="true">
                    <text
                      x="400"
                      y="420"
                      textAnchor="middle"
                      fontSize="28"
                      fill="rgba(40,40,40,.65)"
                      fontFamily="Arial, sans-serif"
                    >
                      Upload artwork
                    </text>
                    <text
                      x="400"
                      y="458"
                      textAnchor="middle"
                      fontSize="18"
                      fill="rgba(40,40,40,.45)"
                      fontFamily="Arial, sans-serif"
                    >
                      Your printable area is shown here
                    </text>
                  </g>
                )}
                {artDataUrl && (
                  <>
                    <image
                      href={artDataUrl}
                      x={artwork.x}
                      y={artwork.y}
                      width={artwork.width}
                      height={artwork.height}
                      preserveAspectRatio="xMidYMid meet"
                      onPointerDown={(event) =>
                        beginArtworkInteraction("drag", event)
                      }
                      style={{ cursor: "grab", touchAction: "none" }}
                    />
                    <rect
                      data-editor-only="true"
                      x={artwork.x}
                      y={artwork.y}
                      width={artwork.width}
                      height={artwork.height}
                      fill="none"
                      stroke="#111111"
                      strokeWidth="3"
                      strokeDasharray="8 6"
                      pointerEvents="none"
                    />
                    <circle
                      data-editor-only="true"
                      cx={artwork.x + artwork.width}
                      cy={artwork.y + artwork.height}
                      r="15"
                      fill="#ffffff"
                      stroke="#111111"
                      strokeWidth="4"
                      onPointerDown={(event) =>
                        beginArtworkInteraction("resize", event)
                      }
                      style={{ cursor: "nwse-resize", touchAction: "none" }}
                    />
                  </>
                )}
              </svg>
            </div>

            <p className="preview-help">
              Drag the artwork to move it. Use the lower-right handle to resize
              it within the printable area.
            </p>
          </section>

          <section className="controls-panel">
            {shop.products.length > 1 && (
              <div className="control-section">
                <div className="section-heading">
                  <span>01</span>
                  <div><h2>Choose your product</h2><p>Select the garment you want to customize.</p></div>
                </div>
                <div className="package-grid">
                  {shop.products.map((product) => (
                    <button key={product.id} type="button" className={product.id === selectedProduct.id ? "package-card selected" : "package-card"} onClick={() => selectProduct(product)}>
                      <strong>{product.name}</strong><span>{product.description || `${product.configuration.colors.length} colors`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="control-section">
              <div className="section-heading">
                <span>{shop.products.length > 1 ? "02" : "01"}</span>
                <div>
                  <h2>Choose your package</h2>
                  <p>The checkout price is controlled by Squarespace.</p>
                </div>
              </div>
              <div className="package-grid">
                {settings.packages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      item.id === selectedPackage.id
                        ? "package-card selected"
                        : "package-card"
                    }
                    onClick={() => {
                      setSelectedPackage(item);
                      setSizes((current) =>
                        current.map((size) => ({ ...size, quantity: 0 }))
                      );
                    }}
                  >
                    <strong>{item.label}</strong>
                    <span>{money(item.price)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="control-section">
              <div className="section-heading">
                <span>02</span>
                <div>
                  <h2>Shirt color</h2>
                  <p>{selectedColor.name}</p>
                </div>
              </div>
              <div className="swatches">
                {settings.colors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    className={
                      color.id === selectedColor.id
                        ? "swatch selected"
                        : "swatch"
                    }
                    aria-label={color.name}
                    title={color.name}
                    onClick={() => setSelectedColor(color)}
                  >
                    <span style={{ backgroundColor: color.hex }} />
                  </button>
                ))}
              </div>
            </div>

            <div className="control-section">
              <div className="section-heading">
                <span>03</span>
                <div>
                  <h2>Upload artwork</h2>
                  <p>{settings.customerExperience?.uploadInstructions || "PNG, JPG, WEBP or SVG."}</p>
                </div>
              </div>
              <label className="upload-box">
                <input
                  type="file"
                  accept={settings.upload.acceptedTypes.join(",")}
                  onChange={(event) =>
                    handleArtwork(event.target.files?.[0] ?? null)
                  }
                />
                <strong>
                  {artFile ? artFile.name : "Choose your design file"}
                </strong>
                <span>
                  Maximum {Math.round(settings.upload.maxBytes / 1024 / 1024)} MB
                </span>
              </label>
            </div>

            <div className="control-section">
              <div className="section-heading">
                <span>04</span>
                <div>
                  <h2>Print location</h2>
                  <p>Additional locations can be configured per shop.</p>
                </div>
              </div>
              <select
                value={printLocation}
                onChange={(event) => setPrintLocation(event.target.value)}
              >
                {settings.printLocations.map((location) => (
                  <option value={location} key={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-section">
              <div className="section-heading">
                <span>05</span>
                <div>
                  <h2>Size breakdown</h2>
                  <p>
                    Assigned {totalAssigned} of {selectedPackage.quantity}
                  </p>
                </div>
              </div>
              <div className="size-grid">
                {sizes.map((item) => (
                  <label key={item.size}>
                    <span>{item.size}</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(event) =>
                        updateSize(item.size, Number(event.target.value))
                      }
                    />
                  </label>
                ))}
              </div>
              <div
                className={
                  totalAssigned === selectedPackage.quantity
                    ? "quantity-meter complete"
                    : "quantity-meter"
                }
              >
                <span
                  style={{
                    width: `${Math.min(
                      100,
                      (totalAssigned / selectedPackage.quantity) * 100
                    )}%`
                  }}
                />
              </div>
            </div>

            <div className="control-section">
              <div className="section-heading">
                <span>06</span>
                <div>
                  <h2>Customer information</h2>
                  <p>Used to protect and reconnect the design.</p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    autoComplete="name"
                    value={customer.name}
                    onChange={(event) =>
                      setCustomer((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={customer.email}
                    onChange={(event) =>
                      setCustomer((current) => ({
                        ...current,
                        email: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="full-field">
                  <span>Phone (optional)</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={customer.phone}
                    onChange={(event) =>
                      setCustomer((current) => ({
                        ...current,
                        phone: event.target.value
                      }))
                    }
                  />
                </label>
                <label className="full-field">
                  <span>Production notes (optional)</span>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Ink colors, placement notes, deadline, or anything the shop should know."
                  />
                </label>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="checkout-summary">
              <div>
                <span>{selectedPackage.label}</span>
                <strong>{money(selectedPackage.price)}</strong>
              </div>
              <p>Shipping and tax are calculated by the shop’s checkout.</p>
              {settings.customerExperience?.turnaroundTime && <p className="checkout-guidance"><strong>Turnaround:</strong> {settings.customerExperience.turnaroundTime}</p>}
              {settings.customerExperience?.artworkDisclaimer && <p className="checkout-guidance">{settings.customerExperience.artworkDisclaimer}</p>}
              <button
                className="primary-button"
                type="button"
                disabled={submitting}
                onClick={submitDesign}
              >
                {submitting ? "Saving your design…" : "Save design & continue"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
