"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type {
  CatalogProduct,
  DesignSide,
  PrintArea,
  PrintSize,
  ProductConfiguration,
  ProductPackage,
  ProductPricingOverrides,
  ShirtColor,
  ShopPricingProfile
} from "@/lib/types";
import {
  DEFAULT_CONFIGURATION,
  normalizePrintArea,
  pricingForPrintOrder,
  slugify,
  tierFullUnitPrice,
  tierGarmentUnitPrice,
  tierHeartUnitPrice
} from "@/lib/catalog";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const TABS = ["Basics", "Options", "Colors", "Print zones", "Pricing"] as const;
type Tab = (typeof TABS)[number];
type UploadState = { busy: boolean; error?: string; success?: string };
type ZoneKey = "frontHeartArea" | "frontFullArea" | "backHeartArea" | "backFullArea";

const PRODUCT_IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml"
};

function blankProduct(index: number): CatalogProduct {
  return {
    id: `new-${Date.now()}`,
    slug: `new-product-${index}`,
    name: "New custom product",
    description: "",
    active: true,
    configuration: copy(DEFAULT_CONFIGURATION)
  };
}

function fileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

function normalizedProductImageMime(file: File) {
  return PRODUCT_IMAGE_MIME[fileExtension(file.name)] || (file.type === "image/jpg" ? "image/jpeg" : file.type);
}

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

function zoneKey(side: DesignSide, size: PrintSize): ZoneKey {
  return `${side}${size === "heart" ? "Heart" : "Full"}Area` as ZoneKey;
}

function sizeTitle(size: PrintSize) {
  return size === "heart" ? "Heart size" : "Full size";
}

export default function ProductCatalogManager({ initialProducts, pricingProfile }: { initialProducts: CatalogProduct[]; pricingProfile: ShopPricingProfile }) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState(initialProducts[0]?.id || "");
  const [draft, setDraft] = useState<CatalogProduct | null>(initialProducts[0] ? copy(initialProducts[0]) : null);
  const [tab, setTab] = useState<Tab>("Basics");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [previewColorId, setPreviewColorId] = useState(initialProducts[0]?.configuration.colors[0]?.id || "");
  const [previewSide, setPreviewSide] = useState<DesignSide>("front");
  const [previewSize, setPreviewSize] = useState<PrintSize>("full");

  const selected = useMemo(() => products.find((item) => item.id === selectedId), [products, selectedId]);
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((item) =>
      `${item.name} ${item.configuration.customization.category} ${item.configuration.supplier?.brandName || ""} ${item.configuration.supplier?.styleName || ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [products, search]);

  function choose(product: CatalogProduct) {
    setSelectedId(product.id);
    setDraft(copy(product));
    setPreviewColorId(product.configuration.colors[0]?.id || "");
    setMessage("");
    setTab("Basics");
  }

  function updateConfiguration(next: Partial<ProductConfiguration>) {
    if (draft) setDraft({ ...draft, configuration: { ...draft.configuration, ...next } });
  }

  function updateCustomization(next: Partial<ProductConfiguration["customization"]>) {
    if (draft) updateConfiguration({ customization: { ...draft.configuration.customization, ...next } });
  }

  function updateZone(side: DesignSide, size: PrintSize, value: PrintArea) {
    const key = zoneKey(side, size);
    const next = normalizePrintArea(value, draft!.configuration.customization[key]);
    updateCustomization({
      [key]: next,
      ...(side === "front" && size === "full" ? { frontPrintArea: next } : {}),
      ...(side === "back" && size === "full" ? { backPrintArea: next } : {})
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMessage("");
    try {
      const isNew = draft.id.startsWith("new-");
      const response = await fetch(isNew ? "/api/admin/products" : `/api/admin/products/${draft.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, slug: slugify(draft.slug || draft.name) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save product.");
      const saved = data.product as CatalogProduct;
      setProducts((current) => (isNew ? [...current, saved] : current.map((item) => (item.id === saved.id ? saved : item))));
      setSelectedId(saved.id);
      setDraft(copy(saved));
      setMessage("Saved. Pricing, print zones, and customer options are live.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft || draft.id.startsWith("new-") || !confirm(`Delete ${draft.name}?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/products/${draft.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete product.");
      const remaining = products.filter((item) => item.id !== draft.id);
      setProducts(remaining);
      setSelectedId(remaining[0]?.id || "");
      setDraft(remaining[0] ? copy(remaining[0]) : null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete product.");
    } finally {
      setBusy(false);
    }
  }

  const previewColor = draft?.configuration.colors.find((item) => item.id === previewColorId) || draft?.configuration.colors[0];
  const previewImage = previewSide === "front" ? previewColor?.frontImageUrl : previewColor?.backImageUrl;
  const activeZone = draft ? draft.configuration.customization[zoneKey(previewSide, previewSize)] : null;

  return (
    <div className="product-admin-shell">
      <aside className="product-library admin-card">
        <div className="product-library-head">
          <div>
            <p className="eyebrow">PRODUCTS</p>
            <h2>Catalog</h2>
          </div>
          <button
            className="secondary-button compact"
            onClick={() => {
              const item = blankProduct(products.length + 1);
              setDraft(item);
              setSelectedId(item.id);
              setPreviewColorId(item.configuration.colors[0]?.id || "");
              setTab("Basics");
              setMessage("");
            }}
          >
            New product
          </button>
        </div>
        <div className="product-search">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" />
        </div>
        <div className="product-library-list">
          {visibleProducts.map((product) => (
            <button
              key={product.id}
              className={selectedId === product.id ? "product-library-item active" : "product-library-item"}
              onClick={() => choose(product)}
            >
              <span className="product-thumb">
                {product.configuration.colors[0]?.frontImageUrl ? <img src={assetUrl(product.configuration.colors[0].frontImageUrl)} alt="" /> : product.name.slice(0, 1)}
              </span>
              <span>
                <strong>{product.name}</strong>
                <small>
                  {product.configuration.supplier ? product.configuration.supplier.supplierName || product.configuration.supplier.provider : "Manual"} · {product.configuration.colors.length} colors
                </small>
              </span>
              <i className={product.active ? "live" : ""} />
            </button>
          ))}
          {!visibleProducts.length && <div className="library-empty">No matching products.</div>}
        </div>
      </aside>

      <section className="product-editor admin-card">
        {!draft ? (
          <div className="empty-state">
            <h2>Add your first product</h2>
          </div>
        ) : (
          <>
            <div className="product-editor-top">
              <div>
                <p className="eyebrow">{draft.configuration.supplier ? "SUPPLIER PRODUCT" : "CUSTOM PRODUCT"}</p>
                <h1>{draft.name}</h1>
                <p>{selected?.configuration.supplier?.partNumber || "Build a production-ready customer product."}</p>
              </div>
              <label className="modern-switch">
                <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
                <span />
                <b>{draft.active ? "Live" : "Hidden"}</b>
              </label>
            </div>

            <nav className="product-editor-tabs" aria-label="Product setup sections">
              {TABS.map((item) => (
                <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
                  {item}
                </button>
              ))}
            </nav>

            <div className="product-editor-body">
              {tab === "Basics" && (
                <Panel title="Product basics" description="The information customers use to understand and choose this product.">
                  <div className="clean-form-grid">
                    <Field label="Product name">
                      <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value, slug: slugify(event.target.value) })} />
                    </Field>
                    <Field label="Category">
                      <select value={draft.configuration.customization.category} onChange={(event) => updateCustomization({ category: event.target.value })}>
                        <option>T-Shirts</option>
                        <option>Hoodies</option>
                        <option>Sweatshirts</option>
                        <option>Polos</option>
                        <option>Jackets</option>
                        <option>Totes</option>
                        <option>Other</option>
                      </select>
                    </Field>
                    <Field label="Product URL">
                      <input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: slugify(event.target.value) })} />
                    </Field>
                    <Field label="Minimum order">
                      <div className="input-suffix">
                        <input
                          type="number"
                          min="12"
                          value={draft.configuration.customization.minimumQuantity}
                          onChange={(event) => updateCustomization({ minimumQuantity: Math.max(12, Number(event.target.value)) })}
                        />
                        <span>items</span>
                      </div>
                      <small>Customers can order any quantity at or above this number.</small>
                    </Field>
                    <Field label="Description" wide>
                      <textarea rows={4} value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                    </Field>
                    <Field label="Artwork guidance" wide>
                      <textarea
                        rows={3}
                        value={draft.configuration.customization.customerInstructions || ""}
                        onChange={(event) => updateCustomization({ customerInstructions: event.target.value })}
                      />
                    </Field>
                  </div>
                </Panel>
              )}

              {tab === "Options" && (
                <>
                  <Panel title="Design choices" description="Select every side combination customers can use for this product.">
                    <div className="selection-card-grid">
                      <CheckCard
                        title="Front only"
                        text="The customer selects Heart Size or Full Size for the front."
                        checked={draft.configuration.customization.designModes.includes("front")}
                        onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "front", checked) })}
                      />
                      <CheckCard
                        title="Back only"
                        text="The customer selects Heart Size or Full Size for the back."
                        checked={draft.configuration.customization.designModes.includes("back")}
                        onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "back", checked) })}
                      />
                      <CheckCard
                        title="Front + back"
                        text="Each side receives its own artwork and print-size choice."
                        checked={draft.configuration.customization.designModes.includes("front-back")}
                        onChange={(checked) => updateCustomization({ designModes: toggleValue(draft.configuration.customization.designModes, "front-back", checked) })}
                      />
                    </div>
                  </Panel>
                  <Panel title="Decoration methods" description="These appear as a compact dropdown in the customer designer.">
                    <TagEditor
                      values={draft.configuration.customization.decorationMethods}
                      placeholder="Add method"
                      onChange={(decorationMethods) => updateCustomization({ decorationMethods })}
                    />
                  </Panel>
                  <Panel title="Available sizes" description="Customers enter exactly how many garments they need in each size.">
                    <TagEditor values={draft.configuration.sizes} placeholder="Add size" onChange={(sizes) => updateConfiguration({ sizes })} />
                  </Panel>
                </>
              )}

              {tab === "Colors" && (
                <Panel title="Color variations" description="Upload real front and back garment images for each color. These exact images power the print-zone editor and customer mockups.">
                  <ColorImageEditor values={draft.configuration.colors} onChange={(colors) => updateConfiguration({ colors })} />
                </Panel>
              )}

              {tab === "Print zones" && activeZone && (
                <Panel
                  title="Visual print-zone setup"
                  description="Use the real garment photo to define where Heart Size and Full Size artwork may move. The solid inner box is the largest print; the dashed outer box is the movement boundary."
                >
                  <div className="zone-toolbar">
                    <Field label="Reference color">
                      <select value={previewColor?.id || ""} onChange={(event) => setPreviewColorId(event.target.value)}>
                        {draft.configuration.colors.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="segmented-control" aria-label="Garment side">
                      {(["front", "back"] as DesignSide[]).map((item) => (
                        <button key={item} className={previewSide === item ? "active" : ""} onClick={() => setPreviewSide(item)}>
                          {item === "front" ? "Front" : "Back"}
                        </button>
                      ))}
                    </div>
                    <div className="segmented-control" aria-label="Print size">
                      {(["heart", "full"] as PrintSize[]).map((item) => (
                        <button key={item} className={previewSize === item ? "active" : ""} onClick={() => setPreviewSize(item)}>
                          {sizeTitle(item)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="visual-zone-layout">
                    <PrintZoneCanvas
                      color={previewColor}
                      side={previewSide}
                      size={previewSize}
                      imageUrl={previewImage}
                      value={activeZone}
                      onChange={(value) => updateZone(previewSide, previewSize, value)}
                    />
                    <PrintZoneControls
                      side={previewSide}
                      size={previewSize}
                      value={activeZone}
                      onChange={(value) => updateZone(previewSide, previewSize, value)}
                      onReset={() => updateZone(previewSide, previewSize, copy(DEFAULT_CONFIGURATION.customization[zoneKey(previewSide, previewSize)]))}
                    />
                  </div>
                </Panel>
              )}

              {tab === "Pricing" && (
                <>
                  <Panel
                    title="Global fees & product overrides"
                    description="This product inherits the shop-wide setup, design optimization, decoration, and add-on rules unless you override them here."
                  >
                    <ProductPricingOverridesEditor
                      profile={pricingProfile}
                      decorationMethods={draft.configuration.customization.decorationMethods}
                      value={draft.configuration.customization.pricingOverrides}
                      onChange={(pricingOverrides) => updateCustomization({ pricingOverrides })}
                    />
                  </Panel>
                  <Panel
                    title="Per-shirt pricing formula"
                    description="Every unit is calculated as blank garment + front print + back print. A side only adds cost when the customer prints on it."
                  >
                    <PricingFormulaExample tiers={draft.configuration.packages} minimum={draft.configuration.customization.minimumQuantity} />
                  </Panel>
                  <Panel
                    title="Quantity pricing tiers"
                    description="Set the blank cost and both print costs per shirt at each quantity threshold. PrintFlow always applies the best eligible tier."
                  >
                    <ComponentTierEditor
                      values={draft.configuration.packages}
                      minimum={draft.configuration.customization.minimumQuantity}
                      onChange={(packages) => updateConfiguration({ packages })}
                    />
                  </Panel>
                </>
              )}
            </div>

            {message && <div className={message.startsWith("Saved") ? "success-message" : "error-message"}>{message}</div>}
            <div className="sticky-editor-actions">
              {!draft.id.startsWith("new-") && (
                <button className="danger-button" disabled={busy} onClick={remove}>
                  Delete
                </button>
              )}
              <span>{draft.active ? "Changes will appear in the customer catalog." : "This product is hidden from customers."}</span>
              <button className="primary-button fit-button" disabled={busy} onClick={save}>
                {busy ? "Saving…" : "Save product"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="editor-panel">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div>{children}</div>
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? "clean-field wide" : "clean-field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function CheckCard({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={checked ? "selection-card selected" : "selection-card"}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="fake-check">✓</span>
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </label>
  );
}

function toggleValue<T>(values: T[], value: T, checked: boolean) {
  return checked ? Array.from(new Set([...values, value])) : values.filter((item) => item !== value);
}

function TagEditor({ values, placeholder, onChange }: { values: string[]; placeholder: string; onChange: (values: string[]) => void }) {
  const [entry, setEntry] = useState("");
  return (
    <div className="modern-tag-editor">
      <div>
        {values.map((item) => (
          <span key={item}>
            {item}
            <button onClick={() => onChange(values.filter((value) => value !== item))}>×</button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = entry.trim();
          if (value && !values.includes(value)) onChange([...values, value]);
          setEntry("");
        }}
      >
        <input value={entry} onChange={(event) => setEntry(event.target.value)} placeholder={placeholder} />
        <button>Add</button>
      </form>
    </div>
  );
}

function ColorImageEditor({ values, onChange }: { values: ShirtColor[]; onChange: (values: ShirtColor[]) => void }) {
  const [states, setStates] = useState<Record<string, UploadState>>({});

  async function upload(index: number, side: DesignSide, file?: File) {
    if (!file) return;
    const key = `${values[index]?.id || index}-${side}`;
    const contentType = normalizedProductImageMime(file);
    if (!Object.values(PRODUCT_IMAGE_MIME).includes(contentType)) {
      setStates((current) => ({ ...current, [key]: { busy: false, error: "Use PNG, JPG, WEBP, or SVG." } }));
      return;
    }

    setStates((current) => ({ ...current, [key]: { busy: true } }));
    try {
      const prepare = await fetch("/api/admin/products/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: contentType, sizeBytes: file.size })
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Unable to prepare the image upload.");

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const keyValue = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !keyValue) throw new Error("Public Supabase settings are missing.");
      const supabase = createClient(url, keyValue, { auth: { persistSession: false } });
      const result = await supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: prepared.contentType || contentType });
      if (result.error) throw result.error;

      onChange(
        values.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [side === "front" ? "frontImageUrl" : "backImageUrl"]: prepared.publicUrl } : item
        )
      );
      setStates((current) => ({ ...current, [key]: { busy: false, success: "Uploaded. Save product to publish." } }));
    } catch (error) {
      setStates((current) => ({
        ...current,
        [key]: { busy: false, error: error instanceof Error ? error.message : "Unable to upload image." }
      }));
    }
  }

  return (
    <div className="modern-color-list">
      {values.map((color, index) => (
        <article key={color.id} className="modern-color-card">
          <div className="color-card-header">
            <input
              type="color"
              value={color.hex}
              aria-label={`${color.name} color`}
              onChange={(event) => onChange(values.map((item, itemIndex) => (itemIndex === index ? { ...item, hex: event.target.value } : item)))}
            />
            <input
              value={color.name}
              aria-label="Color name"
              onChange={(event) =>
                onChange(values.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value, id: slugify(event.target.value) } : item)))
              }
            />
            <label className="modern-switch small">
              <input
                type="checkbox"
                checked={color.active !== false}
                onChange={(event) => onChange(values.map((item, itemIndex) => (itemIndex === index ? { ...item, active: event.target.checked } : item)))}
              />
              <span />
              <b>Visible</b>
            </label>
            <button className="icon-delete" aria-label={`Delete ${color.name}`} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>
              ×
            </button>
          </div>
          <div className="side-photo-grid">
            <PhotoField
              title="Front image"
              url={color.frontImageUrl}
              state={states[`${color.id}-front`]}
              onUrl={(url) => onChange(values.map((item, itemIndex) => (itemIndex === index ? { ...item, frontImageUrl: url } : item)))}
              onFile={(file) => upload(index, "front", file)}
              onRemove={() => onChange(values.map((item, itemIndex) => (itemIndex === index ? { ...item, frontImageUrl: undefined } : item)))}
            />
            <PhotoField
              title="Back image"
              url={color.backImageUrl}
              state={states[`${color.id}-back`]}
              onUrl={(url) => onChange(values.map((item, itemIndex) => (itemIndex === index ? { ...item, backImageUrl: url } : item)))}
              onFile={(file) => upload(index, "back", file)}
              onRemove={() => onChange(values.map((item, itemIndex) => (itemIndex === index ? { ...item, backImageUrl: undefined } : item)))}
            />
          </div>
        </article>
      ))}
      <button className="add-outline-button" onClick={() => onChange([...values, { id: `color-${Date.now()}`, name: "New color", hex: "#888888", active: true }])}>
        + Add color
      </button>
    </div>
  );
}

function PhotoField({
  title,
  url,
  state,
  onUrl,
  onFile,
  onRemove
}: {
  title: string;
  url?: string;
  state?: UploadState;
  onUrl: (value: string) => void;
  onFile: (file?: File) => Promise<void>;
  onRemove: () => void;
}) {
  return (
    <div className="photo-field enhanced">
      <div className="photo-preview">
        {url ? (
          <img src={assetUrl(url)} alt={`${title} preview`} />
        ) : (
          <span>
            <b>No image</b>
            <small>Upload a centered garment mockup</small>
          </span>
        )}
      </div>
      <div className="photo-field-controls">
        <div className="photo-field-title">
          <strong>{title}</strong>
          <small>PNG, JPG, WEBP, or SVG · up to 25 MB</small>
        </div>
        <div className="photo-actions">
          <label className={state?.busy ? "upload-outline disabled" : "upload-outline"}>
            {state?.busy ? "Uploading…" : url ? "Replace image" : "Upload image"}
            <input
              disabled={state?.busy}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => {
                const input = event.currentTarget;
                void onFile(input.files?.[0]).finally(() => {
                  input.value = "";
                });
              }}
            />
          </label>
          {url && (
            <button className="text-button photo-remove" type="button" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
        <label className="image-url-field">
          <span>Image URL</span>
          <input placeholder="Paste an image URL" value={url || ""} onChange={(event) => onUrl(event.target.value)} />
        </label>
        {state?.error && <small className="upload-feedback error">{state.error}</small>}
        {state?.success && <small className="upload-feedback success">{state.success}</small>}
      </div>
    </div>
  );
}

function PrintZoneCanvas({
  color,
  side,
  size,
  imageUrl,
  value,
  onChange
}: {
  color?: ShirtColor;
  side: DesignSide;
  size: PrintSize;
  imageUrl?: string;
  value: PrintArea;
  onChange: (value: PrintArea) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<any>(null);
  const area = normalizePrintArea(value, value);

  function point(event: ReactPointerEvent<SVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * 800, y: ((event.clientY - rect.top) / rect.height) * 800 };
  }

  function begin(kind: "zone-move" | "zone-resize" | "art-move" | "art-resize", event: ReactPointerEvent<SVGElement>) {
    event.preventDefault();
    dragRef.current = { kind, p: point(event), area: { ...area } };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: ReactPointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const current = point(event);
    const dx = current.x - drag.p.x;
    const dy = current.y - drag.p.y;
    const start: PrintArea = drag.area;
    const artworkWidth = start.artworkWidth || 100;
    const artworkHeight = start.artworkHeight || 100;
    let next: PrintArea = { ...start };

    if (drag.kind === "zone-move") {
      const x = Math.max(0, Math.min(800 - start.width, start.x + dx));
      const y = Math.max(0, Math.min(800 - start.height, start.y + dy));
      next = {
        ...start,
        x,
        y,
        defaultX: x + ((start.defaultX || start.x) - start.x),
        defaultY: y + ((start.defaultY || start.y) - start.y)
      };
    }

    if (drag.kind === "zone-resize") {
      const width = Math.max(Math.max(120, artworkWidth), Math.min(800 - start.x, start.width + dx));
      const height = Math.max(Math.max(120, artworkHeight), Math.min(800 - start.y, start.height + dy));
      next = {
        ...start,
        width,
        height,
        defaultX: Math.min(start.defaultX || start.x, start.x + width - artworkWidth),
        defaultY: Math.min(start.defaultY || start.y, start.y + height - artworkHeight)
      };
    }

    if (drag.kind === "art-move") {
      next = {
        ...start,
        defaultX: Math.max(start.x, Math.min(start.x + start.width - artworkWidth, (start.defaultX || start.x) + dx)),
        defaultY: Math.max(start.y, Math.min(start.y + start.height - artworkHeight, (start.defaultY || start.y) + dy))
      };
    }

    if (drag.kind === "art-resize") {
      const aspect = (start.widthInches || 4) / (start.heightInches || 4);
      let width = Math.max(45, Math.min(start.x + start.width - (start.defaultX || start.x), artworkWidth + dx));
      let height = width / aspect;
      if (height > start.y + start.height - (start.defaultY || start.y)) {
        height = start.y + start.height - (start.defaultY || start.y);
        width = height * aspect;
      }
      next = { ...start, artworkWidth: width, artworkHeight: height };
    }

    onChange(normalizePrintArea(next, start));
  }

  return (
    <div className="print-zone-canvas-card">
      <div className="zone-canvas-labels">
        <span>
          {side === "front" ? "Front" : "Back"} · {sizeTitle(size)}
        </span>
        <small>{color?.name || "Reference garment"}</small>
      </div>
      <svg ref={svgRef} viewBox="0 0 800 800" onPointerMove={move} onPointerUp={() => (dragRef.current = null)} onPointerCancel={() => (dragRef.current = null)}>
        <rect width="800" height="800" fill="#f1f1ed" />
        {imageUrl ? (
          <image href={assetUrl(imageUrl)} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <path d="M255 150 110 245l75 135 78-42v330h274V338l78 42 75-135-145-95-65 55H320z" fill={color?.hex || "#ddd"} stroke="#bbb" strokeWidth="3" />
        )}
        <g>
          <rect
            x={area.x}
            y={area.y}
            width={area.width}
            height={area.height}
            rx="10"
            fill="rgba(30,30,30,.06)"
            stroke="#161616"
            strokeWidth="3"
            strokeDasharray="13 10"
            onPointerDown={(event) => begin("zone-move", event)}
            style={{ cursor: "move" }}
          />
          <circle
            cx={area.x + area.width}
            cy={area.y + area.height}
            r="15"
            fill="#fff"
            stroke="#111"
            strokeWidth="3"
            onPointerDown={(event) => begin("zone-resize", event)}
            style={{ cursor: "nwse-resize" }}
          />
        </g>
        <g>
          <rect
            x={area.defaultX}
            y={area.defaultY}
            width={area.artworkWidth}
            height={area.artworkHeight}
            rx="8"
            fill={size === "heart" ? "rgba(34,106,255,.24)" : "rgba(21,153,88,.22)"}
            stroke={size === "heart" ? "#226aff" : "#159958"}
            strokeWidth="4"
            onPointerDown={(event) => begin("art-move", event)}
            style={{ cursor: "move" }}
          />
          <text
            x={(area.defaultX || 0) + (area.artworkWidth || 0) / 2}
            y={(area.defaultY || 0) + (area.artworkHeight || 0) / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="20"
            fontWeight="800"
            fill="#111"
            pointerEvents="none"
          >
            {area.widthInches} × {area.heightInches} in
          </text>
          <circle
            cx={(area.defaultX || 0) + (area.artworkWidth || 0)}
            cy={(area.defaultY || 0) + (area.artworkHeight || 0)}
            r="15"
            fill="#111"
            onPointerDown={(event) => begin("art-resize", event)}
            style={{ cursor: "nwse-resize" }}
          />
        </g>
      </svg>
      <div className="zone-legend">
        <span><i className="outer" /> Allowed movement zone</span>
        <span><i className={size === "heart" ? "heart" : "full"} /> Maximum printed artwork</span>
      </div>
    </div>
  );
}

function PrintZoneControls({
  side,
  size,
  value,
  onChange,
  onReset
}: {
  side: DesignSide;
  size: PrintSize;
  value: PrintArea;
  onChange: (value: PrintArea) => void;
  onReset: () => void;
}) {
  const current = normalizePrintArea(value, value);

  function updateDimensions(next: Partial<PrintArea>) {
    const widthInches = Number(next.widthInches ?? current.widthInches ?? 4);
    const heightInches = Number(next.heightInches ?? current.heightInches ?? 4);
    const aspect = widthInches / heightInches;
    let artworkWidth = current.artworkWidth || 100;
    let artworkHeight = artworkWidth / aspect;
    if (artworkHeight > current.height) {
      artworkHeight = current.height;
      artworkWidth = artworkHeight * aspect;
    }
    onChange(
      normalizePrintArea(
        {
          ...current,
          ...next,
          artworkWidth,
          artworkHeight,
          defaultX: Math.min(current.defaultX || current.x, current.x + current.width - artworkWidth),
          defaultY: Math.min(current.defaultY || current.y, current.y + current.height - artworkHeight)
        },
        current
      )
    );
  }

  return (
    <aside className="print-zone-controls">
      <div>
        <p className="eyebrow">{size === "heart" ? "COMPACT PRINT" : "LARGE PRINT"}</p>
        <h3>
          {side === "front" ? "Front" : "Back"} {sizeTitle(size)}
        </h3>
        <p>
          {size === "heart"
            ? "The print stays within the selected movement zone, allowing center-chest or left-chest placement while never exceeding the physical size below."
            : "The customer can move and resize the design throughout the full printable torso zone without exceeding the physical size below."}
        </p>
      </div>
      <div className="zone-dimension-grid">
        <MeasurementInput label="Maximum width" value={current.widthInches || 4} min={1} max={20} onCommit={(widthInches) => updateDimensions({ widthInches })} />
        <MeasurementInput label="Maximum height" value={current.heightInches || 4} min={1} max={24} onCommit={(heightInches) => updateDimensions({ heightInches })} />
      </div>
      <div className="zone-help-list">
        <div><b>1</b><span>Drag the dashed box to set where this print type is allowed.</span></div>
        <div><b>2</b><span>Resize the dashed box to expand or restrict movement.</span></div>
        <div><b>3</b><span>Drag and resize the colored box to set the default and largest visual print.</span></div>
      </div>
      <button className="secondary-button" onClick={onReset}>Reset this zone</button>
    </aside>
  );
}

function MeasurementInput({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [text, setText] = useState(value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"));
  useEffect(() => setText(value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")), [value]);

  function commit() {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      setText(value.toString());
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setText(next.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1"));
    onCommit(next);
  }

  return (
    <label className="measurement-text-field">
      <span>{label}</span>
      <div>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(event) => setText(event.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <b>in</b>
      </div>
    </label>
  );
}

function PricingFormulaExample({ tiers, minimum }: { tiers: ProductPackage[]; minimum: number }) {
  const example = pricingForPrintOrder(tiers, minimum, { front: "heart", back: "full" });
  return (
    <div className="pricing-formula-example">
      <div className="formula-components">
        <span><small>Blank garment</small><b>${example.garmentUnitPrice.toFixed(2)}</b></span>
        <i>+</i>
        <span><small>Front heart print</small><b>${example.frontPrintUnitPrice.toFixed(2)}</b></span>
        <i>+</i>
        <span><small>Back full print</small><b>${example.backPrintUnitPrice.toFixed(2)}</b></span>
        <i>=</i>
        <span className="result"><small>Unit price</small><b>${example.unitPrice.toFixed(2)}</b></span>
      </div>
      <p>
        Example at {minimum} items: {minimum} × ${example.unitPrice.toFixed(2)} = <strong>${example.totalPrice.toFixed(2)}</strong>. Front and back can each independently use Heart Size or Full Size.
      </p>
    </div>
  );
}

function DecimalMoneyInput({ value, onChange, ariaLabel }: { value: number; onChange: (value: number) => void; ariaLabel: string }) {
  const [text, setText] = useState(Number(value || 0).toFixed(2));
  useEffect(() => setText(Number(value || 0).toFixed(2)), [value]);
  function commit() {
    const next = Math.max(0, Number(text || 0));
    setText(next.toFixed(2));
    onChange(next);
  }
  return (
    <div className="input-prefix component-money-input">
      <span>$</span>
      <input
        aria-label={ariaLabel}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(event) => setText(event.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </div>
  );
}

function ComponentTierEditor({ values, minimum, onChange }: { values: ProductPackage[]; minimum: number; onChange: (values: ProductPackage[]) => void }) {
  function update(index: number, next: Partial<ProductPackage>) {
    onChange(
      values
        .map((item, itemIndex) => {
          if (itemIndex !== index) return item;
          const merged = { ...item, ...next };
          const garmentUnitPrice = Math.max(0, Number(merged.garmentUnitPrice ?? tierGarmentUnitPrice(merged)));
          return {
            ...merged,
            garmentUnitPrice,
            heartPrintUnitPrice: Math.max(0, Number(merged.heartPrintUnitPrice ?? 0)),
            fullPrintUnitPrice: Math.max(0, Number(merged.fullPrintUnitPrice ?? 0)),
            price: Number((garmentUnitPrice * merged.quantity).toFixed(2)),
            label: `${merged.quantity}+`
          };
        })
        .sort((a, b) => a.quantity - b.quantity)
    );
  }

  return (
    <div className="component-tier-editor">
      {values.map((tier, index) => {
        const combo = tierGarmentUnitPrice(tier) + tierHeartUnitPrice(tier) + tierFullUnitPrice(tier);
        return (
          <article className="component-tier-card" key={tier.id}>
            <header>
              <div>
                <span>Quantity tier</span>
                <strong>{tier.quantity}+ items</strong>
              </div>
              <button className="icon-delete" aria-label={`Delete ${tier.quantity}+ tier`} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>×</button>
            </header>
            <div className="component-tier-fields">
              <label>
                <span>Starts at</span>
                <div className="input-suffix">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={tier.quantity}
                    onChange={(event) => update(index, { quantity: Math.max(minimum, Number(event.target.value.replace(/\D/g, "") || minimum)) })}
                  />
                  <span>items</span>
                </div>
              </label>
              <label>
                <span>Blank garment / shirt</span>
                <DecimalMoneyInput value={tierGarmentUnitPrice(tier)} ariaLabel="Blank garment cost" onChange={(garmentUnitPrice) => update(index, { garmentUnitPrice })} />
              </label>
              <label>
                <span>Heart print / side</span>
                <DecimalMoneyInput value={tierHeartUnitPrice(tier)} ariaLabel="Heart print cost" onChange={(heartPrintUnitPrice) => update(index, { heartPrintUnitPrice })} />
              </label>
              <label>
                <span>Full print / side</span>
                <DecimalMoneyInput value={tierFullUnitPrice(tier)} ariaLabel="Full print cost" onChange={(fullPrintUnitPrice) => update(index, { fullPrintUnitPrice })} />
              </label>
            </div>
            <div className="tier-formula-strip">
              <span>Heart front + full back</span>
              <b>${tierGarmentUnitPrice(tier).toFixed(2)} + ${tierHeartUnitPrice(tier).toFixed(2)} + ${tierFullUnitPrice(tier).toFixed(2)} = ${combo.toFixed(2)} each</b>
            </div>
            <details>
              <summary>Checkout destination</summary>
              <input placeholder="Optional checkout URL" value={tier.checkoutUrl || ""} onChange={(event) => update(index, { checkoutUrl: event.target.value })} />
            </details>
          </article>
        );
      })}
      <button
        className="add-outline-button"
        onClick={() => {
          const last = values.at(-1);
          const quantity = Math.max(minimum, (last?.quantity || minimum) + 12);
          onChange([
            ...values,
            {
              id: `tier-${Date.now()}`,
              label: `${quantity}+`,
              quantity,
              price: Number((quantity * (last ? tierGarmentUnitPrice(last) : 3)).toFixed(2)),
              checkoutUrl: last?.checkoutUrl || "",
              garmentUnitPrice: last ? tierGarmentUnitPrice(last) : 3,
              heartPrintUnitPrice: last ? tierHeartUnitPrice(last) : 3,
              fullPrintUnitPrice: last ? tierFullUnitPrice(last) : 5
            }
          ]);
        }}
      >
        + Add quantity tier
      </button>
    </div>
  );
}

function ProductPricingOverridesEditor({
  profile,
  decorationMethods,
  value,
  onChange
}: {
  profile: ShopPricingProfile;
  decorationMethods: string[];
  value: ProductPricingOverrides;
  onChange: (value: ProductPricingOverrides) => void;
}) {
  function patchFee(key: "setupFee" | "designOptimizationFee", next: Partial<ProductPricingOverrides["setupFee"]>) {
    onChange({ ...value, [key]: { ...value[key], ...next } });
  }
  function serviceId(name: string) {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  return <div className="product-pricing-overrides">
    <div className="override-fee-grid">
      <OverrideFeeCard
        title="Order setup"
        globalAmount={profile.setupFee.enabled ? profile.setupFee.amount : 0}
        value={value.setupFee}
        onChange={(next) => patchFee("setupFee", next)}
      />
      <OverrideFeeCard
        title="Design optimization"
        globalAmount={profile.designOptimizationFee.enabled ? profile.designOptimizationFee.amount : 0}
        value={value.designOptimizationFee}
        onChange={(next) => patchFee("designOptimizationFee", next)}
      />
    </div>
    <div className="product-service-overrides">
      <div><strong>Decoration percentage overrides</strong><small>Leave a field blank to inherit the global service percentage.</small></div>
      {decorationMethods.map((method) => {
        const id = serviceId(method);
        const global = profile.decorationServices.find((item) => item.id === id || item.name.toLowerCase() === method.toLowerCase());
        const current = value.decorationAdjustments[id];
        return <label key={method}>
          <span><b>{method}</b><small>Global: {global?.percentageAdjustment || 0}%</small></span>
          <div className="input-suffix"><input type="text" inputMode="decimal" placeholder="Inherit" value={current ?? ""} onChange={(event) => onChange({ ...value, decorationAdjustments: { ...value.decorationAdjustments, [id]: event.target.value === "" ? null : Number(event.target.value) || 0 } })}/><span>%</span></div>
        </label>;
      })}
    </div>
    {profile.addOns.length > 0 && <div className="product-addon-overrides">
      <div><strong>Add-on availability</strong><small>Use global behavior, force an add-on on, or hide it for this product.</small></div>
      {profile.addOns.map((item) => <label key={item.id}><span><b>{item.name}</b><small>${item.amount.toFixed(2)} {item.pricingMode === "per_item" ? "per garment" : "per order"}</small></span><select value={value.addOnModes[item.id] || "inherit"} onChange={(event) => onChange({ ...value, addOnModes: { ...value.addOnModes, [item.id]: event.target.value as "inherit" | "enabled" | "disabled" } })}><option value="inherit">Use global setting</option><option value="enabled">Always available</option><option value="disabled">Hidden for product</option></select></label>)}
    </div>}
  </div>;
}

function OverrideFeeCard({ title, globalAmount, value, onChange }: { title: string; globalAmount: number; value: ProductPricingOverrides["setupFee"]; onChange: (value: Partial<ProductPricingOverrides["setupFee"]>) => void }) {
  return <article className="override-fee-card">
    <div><strong>{title}</strong><small>Global default: ${globalAmount.toFixed(2)}</small></div>
    <select value={value.mode} onChange={(event) => onChange({ mode: event.target.value as ProductPricingOverrides["setupFee"]["mode"] })}>
      <option value="inherit">Use global default</option>
      <option value="custom">Use custom amount</option>
      <option value="disabled">Do not charge</option>
    </select>
    {value.mode === "custom" && <DecimalMoneyInput value={Number(value.amount || 0)} ariaLabel={`${title} custom amount`} onChange={(amount) => onChange({ amount })}/>} 
  </article>;
}
