"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import FloatingSaveBar from "@/components/FloatingSaveBar";
import { useUnsavedChanges } from "@/components/useUnsavedChanges";
import { useRouter } from "next/navigation";
import type {
  CatalogProduct,
  DesignSide,
  PrintArea,
  PrintSize,
  ProductConfiguration,
  ShirtColor,
  ShopPricingProfile,
  SupplierVariant
} from "@/lib/types";
import {
  DEFAULT_CONFIGURATION,
  normalizePrintArea,
  slugify
} from "@/lib/catalog";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const TABS = ["Basics", "Options", "Colors", "Print zones", "Cost basis"] as const;
export type ProductEditorTab = (typeof TABS)[number];
type Tab = ProductEditorTab;
type UploadState = { busy: boolean; error?: string; success?: string };
type SupplierColorProduct = {
  sku: string; skuId?: string; gtin?: string; colorName: string; sizeName: string; customerPrice: number; quantity: number;
  colorHex?: string; swatchImageUrl?: string; frontImageUrl?: string; backImageUrl?: string;
};
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

function productPrintSizes(product?: CatalogProduct): PrintSize[] {
  const configured = product?.configuration.customization.printSizes;
  return Array.isArray(configured) && configured.length ? configured : ["heart", "full"];
}

function normalizeSupplierHex(value?: string) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`;
  if (/^#[0-9a-f]{3}$/i.test(raw)) return raw;
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw}`;
  return "#777777";
}

function singlePrintZone(value: PrintArea) {
  const area = normalizePrintArea(value, value);
  const width = Math.max(45, Math.min(area.artworkWidth || area.width || 100, 800));
  const height = Math.max(45, Math.min(area.artworkHeight || area.height || 100, 800));
  const x = Math.max(0, Math.min(800 - width, area.defaultX ?? area.x));
  const y = Math.max(0, Math.min(800 - height, area.defaultY ?? area.y));
  return normalizePrintArea(
    {
      ...area,
      x,
      y,
      width,
      height,
      defaultX: x,
      defaultY: y,
      artworkWidth: width,
      artworkHeight: height
    },
    area
  );
}

export default function ProductCatalogManager({ initialProducts, pricingProfile, initialSelectedId, initialTab }: { initialProducts: CatalogProduct[]; pricingProfile: ShopPricingProfile; initialSelectedId?: string; initialTab?: Tab }) {
  const router = useRouter();
  const startingProduct = initialProducts.find((item) => item.id === initialSelectedId) || initialProducts[0];
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState(startingProduct?.id || "");
  const [draft, setDraft] = useState<CatalogProduct | null>(startingProduct ? copy(startingProduct) : null);
  const [savedSnapshot, setSavedSnapshot] = useState(startingProduct ? JSON.stringify(startingProduct) : "");
  const [tab, setTab] = useState<Tab>(initialTab && TABS.includes(initialTab) ? initialTab : "Basics");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [previewColorId, setPreviewColorId] = useState(startingProduct?.configuration.defaultColorId || startingProduct?.configuration.colors.find((item) => item.active !== false)?.id || startingProduct?.configuration.colors[0]?.id || "");
  const [previewSide, setPreviewSide] = useState<DesignSide>("front");
  const [previewSize, setPreviewSize] = useState<PrintSize>("full");
  const [supplierColorsOpen, setSupplierColorsOpen] = useState(false);
  const [supplierColorsLoading, setSupplierColorsLoading] = useState(false);
  const [supplierColorsMessage, setSupplierColorsMessage] = useState("");
  const [supplierColorProducts, setSupplierColorProducts] = useState<SupplierColorProduct[]>([]);
  const [supplierSelectedColors, setSupplierSelectedColors] = useState<string[]>([]);

  const selected = useMemo(() => products.find((item) => item.id === selectedId), [products, selectedId]);
  const dirty = useMemo(() => Boolean(draft) && JSON.stringify(draft) !== savedSnapshot, [draft, savedSnapshot]);
  useUnsavedChanges(dirty);
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((item) =>
      `${item.name} ${item.configuration.customization.category} ${item.configuration.supplier?.brandName || ""} ${item.configuration.supplier?.styleName || ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [products, search]);

  useEffect(() => {
    if (!draft) return;
    const available = productPrintSizes(draft);
    if (!available.includes(previewSize)) setPreviewSize(available.includes("full") ? "full" : available[0] || "full");
  }, [draft?.configuration.customization.printSizes, previewSize]);

  async function openSupplierColorPicker() {
    if (!draft?.configuration.supplier || draft.configuration.supplier.provider !== "ss-activewear") return;
    setSupplierColorsOpen(true);
    setSupplierColorsLoading(true);
    setSupplierColorsMessage("");
    setSupplierSelectedColors([]);
    try {
      const response = await fetch(`/api/admin/suppliers/ss/style/${encodeURIComponent(draft.configuration.supplier.styleId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load supplier colors.");
      setSupplierColorProducts(Array.isArray(data.products) ? data.products : []);
    } catch (error) {
      setSupplierColorsMessage(error instanceof Error ? error.message : "Unable to load supplier colors.");
    } finally {
      setSupplierColorsLoading(false);
    }
  }

  function addSelectedSupplierColors() {
    if (!draft?.configuration.supplier || !supplierSelectedColors.length) return;
    const selectedNames = new Set(supplierSelectedColors);
    const selectedRows = supplierColorProducts.filter((row) => selectedNames.has(row.colorName));
    const existingIds = new Set(draft.configuration.colors.map((color) => color.id));
    const additions: ShirtColor[] = supplierSelectedColors.flatMap((colorName) => {
      const rows = selectedRows.filter((row) => row.colorName === colorName);
      if (!rows.length) return [];
      const id = slugify(colorName);
      if (existingIds.has(id) || draft.configuration.colors.some((color) => color.name === colorName)) return [];
      const firstMedia = (key: "swatchImageUrl" | "frontImageUrl" | "backImageUrl") => rows.map((row) => row[key]).find(Boolean);
      return [{
        id,
        name: colorName,
        hex: normalizeSupplierHex(rows.find((row) => row.colorHex)?.colorHex),
        swatchImageUrl: firstMedia("swatchImageUrl"),
        frontImageUrl: firstMedia("frontImageUrl"),
        backImageUrl: firstMedia("backImageUrl"),
        active: true
      }];
    });

    const incomingVariants: SupplierVariant[] = selectedRows.map((row) => ({
      sku: String(row.sku),
      skuId: row.skuId ? String(row.skuId) : undefined,
      gtin: row.gtin ? String(row.gtin) : undefined,
      colorName: String(row.colorName),
      sizeName: String(row.sizeName),
      customerPrice: Number(row.customerPrice || 0),
      quantity: Number(row.quantity || 0),
      active: true
    }));
    const variantMap = new Map(draft.configuration.supplier.variants.map((variant) => [variant.sku, variant]));
    incomingVariants.forEach((variant) => variantMap.set(variant.sku, variant));
    const colors = [...draft.configuration.colors, ...additions];
    const sizes = Array.from(new Set([...draft.configuration.sizes, ...incomingVariants.map((variant) => variant.sizeName)]));
    const currentDefault = draft.configuration.defaultColorId;
    const nextDefault = colors.find((color) => color.id === currentDefault && color.active !== false) || colors.find((color) => color.active !== false) || colors[0];

    updateConfiguration({
      colors,
      sizes,
      defaultColorId: nextDefault?.id,
      mockupImageUrl: nextDefault?.frontImageUrl || undefined,
      supplier: { ...draft.configuration.supplier, variants: Array.from(variantMap.values()) }
    });
    if (additions[0]) setPreviewColorId(additions[0].id);
    setSupplierColorsOpen(false);
    setSupplierSelectedColors([]);
    setSupplierColorsMessage("");
  }

  function choose(product: CatalogProduct) {
    if (dirty && !window.confirm("You have unsaved product changes. Switch products without saving?")) return;
    setSelectedId(product.id);
    setDraft(copy(product));
    setSavedSnapshot(JSON.stringify(product));
    setPreviewColorId(product.configuration.defaultColorId || product.configuration.colors.find((item) => item.active !== false)?.id || product.configuration.colors[0]?.id || "");
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
    const next = singlePrintZone(value);
    updateCustomization({
      [key]: next,
      ...(side === "front" && size === "full" ? { frontPrintArea: next } : {}),
      ...(side === "back" && size === "full" ? { backPrintArea: next } : {})
    });
  }

  async function save(options: { quiet?: boolean } = {}): Promise<CatalogProduct | null> {
    if (!draft) return null;
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
      setSavedSnapshot(JSON.stringify(saved));
      if (!options.quiet) setMessage("Saved. Pricing, print zones, and customer options are live.");
      return saved;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function goToPricing() {
    let current = draft;
    if (dirty) current = await save({ quiet: true });
    if (!current) return;
    const returnTo = `/dashboard/products?product=${encodeURIComponent(current.id)}&tab=${encodeURIComponent("Cost basis")}`;
    router.push(`/dashboard/pricing?returnTo=${encodeURIComponent(returnTo)}`);
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

  const previewColor = draft?.configuration.colors.find((item) => item.id === previewColorId) || draft?.configuration.colors.find((item) => item.active !== false) || draft?.configuration.colors[0];
  const previewImage = previewSide === "front" ? previewColor?.frontImageUrl : previewColor?.backImageUrl;
  const activeZone = draft ? draft.configuration.customization[zoneKey(previewSide, previewSize)] : null;
  const supplierCosts = useMemo(() => {
    const costs = (draft?.configuration.supplier?.variants || []).filter((item) => item.active !== false && Number(item.customerPrice) > 0).map((item) => Number(item.customerPrice));
    return costs.length ? { min: Math.min(...costs), max: Math.max(...costs) } : null;
  }, [draft]);

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
              if (dirty && !window.confirm("You have unsaved product changes. Create a new product without saving?")) return;
              const item = blankProduct(products.length + 1);
              setDraft(item);
              setSavedSnapshot("");
              setSelectedId(item.id);
              setPreviewColorId(item.configuration.defaultColorId || item.configuration.colors.find((color) => color.active !== false)?.id || item.configuration.colors[0]?.id || "");
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
                <p>{selected?.configuration.supplier?.partNumber || "Prepare this product for customer ordering."}</p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {!draft.id.startsWith("new-") && <button className="secondary-button compact" type="button" disabled={busy} onClick={remove}>Delete</button>}
                <label className="modern-switch">
                <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
                <span />
                <b>{draft.active ? "Live" : "Hidden"}</b>
              </label>
              </div>
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
                        <option>Hats & Headwear</option>
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
                  <Panel title="Print size options" description="Choose exactly which print-size choices this product supports. At least one option must remain enabled.">
                    <div className="selection-card-grid">
                      <CheckCard
                        title="Heart Size"
                        text="Offer the compact Heart Size print area for this product."
                        checked={productPrintSizes(draft).includes("heart")}
                        onChange={(checked) => {
                          const current = productPrintSizes(draft);
                          if (!checked && current.length === 1 && current.includes("heart")) {
                            setMessage("Keep at least one print size enabled.");
                            return;
                          }
                          const printSizes: PrintSize[] = checked
                            ? Array.from(new Set<PrintSize>(["heart", ...current]))
                            : current.filter((item) => item !== "heart");
                          updateCustomization({ printSizes });
                          setMessage("");
                          if (!checked && previewSize === "heart") {
                            setPreviewSize(printSizes.includes("full") ? "full" : printSizes[0]);
                          }
                        }}
                      />
                      <CheckCard
                        title="Full Size"
                        text="Offer the larger Full Size print area for this product."
                        checked={productPrintSizes(draft).includes("full")}
                        onChange={(checked) => {
                          const current = productPrintSizes(draft);
                          if (!checked && current.length === 1 && current.includes("full")) {
                            setMessage("Keep at least one print size enabled.");
                            return;
                          }
                          const printSizes: PrintSize[] = checked
                            ? Array.from(new Set<PrintSize>([...current, "full"]))
                            : current.filter((item) => item !== "full");
                          updateCustomization({ printSizes });
                          setMessage("");
                          if (!checked && previewSize === "full") {
                            setPreviewSize(printSizes.includes("heart") ? "heart" : printSizes[0]);
                          }
                        }}
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
                <Panel title="Color variations" description="Use supplier colors when available, or add a manual color when you need a custom variation.">
                  {draft.configuration.supplier?.provider === "ss-activewear" && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
                      <div><strong>S&S color library</strong><div><small>Add another official color for this exact supplier style without re-importing the product.</small></div></div>
                      <button type="button" className="secondary-button compact" onClick={() => void openSupplierColorPicker()}>Add supplier colors</button>
                    </div>
                  )}
                  <div className="clean-form-grid" style={{ marginBottom: 20 }}>
                    <Field label="Default storefront color" wide>
                      <select
                        value={draft.configuration.defaultColorId || draft.configuration.colors.find((item) => item.active !== false)?.id || ""}
                        onChange={(event) => {
                          const defaultColorId = event.target.value;
                          const selectedColor = draft.configuration.colors.find((item) => item.id === defaultColorId);
                          updateConfiguration({
                            defaultColorId,
                            mockupImageUrl: selectedColor?.frontImageUrl || undefined
                          });
                          setPreviewColorId(defaultColorId);
                        }}
                      >
                        {draft.configuration.colors.filter((item) => item.active !== false).map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                      <small>This exact color opens first in the customer store and supplies the catalog image.</small>
                    </Field>
                  </div>
                  <ColorImageEditor
                    values={draft.configuration.colors}
                    onChange={(colors) => {
                      const currentDefault = draft.configuration.defaultColorId;
                      const activeDefault = colors.find((item) => item.id === currentDefault && item.active !== false);
                      const nextDefault = activeDefault || colors.find((item) => item.active !== false) || colors[0];
                      updateConfiguration({
                        colors,
                        defaultColorId: nextDefault?.id,
                        mockupImageUrl: nextDefault?.frontImageUrl || undefined
                      });
                      if (nextDefault && !colors.some((item) => item.id === previewColorId && item.active !== false)) {
                        setPreviewColorId(nextDefault.id);
                      }
                    }}
                  />
                </Panel>
              )}

              {tab === "Print zones" && activeZone && (
                <Panel
                  title="Visual print-zone setup"
                  description={productPrintSizes(draft).length > 1 ? "Set the customer print zone for each enabled print size." : `Set the single ${sizeTitle(productPrintSizes(draft)[0])} print zone for this product.`}
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
                      {productPrintSizes(draft).map((item) => (
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

              {tab === "Cost basis" && (
                <>
                  <Panel
                    title="Garment cost source"
                    description="Customer pricing is no longer configured per product. PrintFlow uses the exact supplier cost for the selected color and size, then applies the global garment markup and production method rules."
                  >
                    <div className="product-cost-source">
                      {draft.configuration.supplier ? (
                        <>
                          <div><span>Supplier</span><strong>{draft.configuration.supplier.supplierName || draft.configuration.supplier.provider}</strong></div>
                          <div><span>Style</span><strong>{draft.configuration.supplier.brandName} {draft.configuration.supplier.styleName}</strong></div>
                          <div><span>Live variants</span><strong>{draft.configuration.supplier.variants.filter((item) => item.active !== false).length}</strong></div>
                          <div><span>Base blank cost</span><strong>{supplierCosts ? `$${supplierCosts.min.toFixed(2)}${supplierCosts.max !== supplierCosts.min ? `–$${supplierCosts.max.toFixed(2)}` : ""}` : "Cost unavailable"}</strong></div>
                          <div><span>Shop garment markup</span><strong>{pricingProfile.garmentMarkupPercent}%</strong></div>
                        </>
                      ) : (
                        <label className="manual-cost-field">
                          <span>Manual blank cost per item</span>
                          <div className="money-input"><span>$</span><input type="text" inputMode="decimal" value={draft.configuration.manualUnitCost || 0} onChange={(event) => updateConfiguration({ manualUnitCost: Math.max(0, Number(event.target.value) || 0) })}/></div>
                          <small>This is the shop's cost, not the customer price. The global {pricingProfile.garmentMarkupPercent}% markup is added automatically.</small>
                        </label>
                      )}
                    </div>
                  </Panel>
                  <Panel
                    title="Global pricing controls this product"
                    description="Screen printing, DTF, embroidery, setup, design optimization, quantity breaks, and add-ons are managed once for the entire shop."
                  >
                    <div className="global-pricing-callout">
                      <div><span>$</span><div><strong>No duplicated product price tables</strong><p>Update production rates once and every active product immediately uses the same pricing logic while retaining its own supplier cost.</p></div></div>
                      <button className="secondary-button" type="button" disabled={busy} onClick={goToPricing}>{busy ? "Saving…" : "Production pricing"}</button>
                    </div>
                  </Panel>
                </>
              )}
            </div>

            {message && <div className={message.startsWith("Saved") ? "success-message" : "error-message"}>{message}</div>}
            <FloatingSaveBar
              dirty={dirty}
              busy={busy}
              onSave={async () => { await save(); }}
              message={draft.active ? "Saved changes appear in the customer catalog." : "This product remains hidden from customers."}
            />
          </>
        )}
      </section>
      {supplierColorsOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSupplierColorsOpen(false)}>
          <div className="supplier-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><p className="eyebrow">S&S ACTIVEWEAR</p><h2>Add color variations</h2><p>Choose additional colors for {draft?.name}.</p></div>
              <button className="icon-button" type="button" onClick={() => setSupplierColorsOpen(false)}>×</button>
            </div>
            {supplierColorsLoading ? <div className="library-empty">Loading supplier colors…</div> : (
              <>
                <div className="supplier-color-grid">
                  {Array.from(new Map(supplierColorProducts.map((row) => [row.colorName, row])).values())
                    .filter((row) => !draft?.configuration.colors.some((color) => color.name === row.colorName || color.id === slugify(row.colorName)))
                    .map((row) => (
                      <label key={row.colorName} className={supplierSelectedColors.includes(row.colorName) ? "supplier-color-card selected" : "supplier-color-card"}>
                        <input type="checkbox" checked={supplierSelectedColors.includes(row.colorName)} onChange={(event) => setSupplierSelectedColors((current) => event.target.checked ? [...current, row.colorName] : current.filter((name) => name !== row.colorName))} />
                        {row.frontImageUrl ? <img src={assetUrl(row.frontImageUrl)} alt={row.colorName} /> : <span className="supplier-color-placeholder" style={{ background: normalizeSupplierHex(row.colorHex) }} />}
                        <strong>{row.colorName}</strong>
                        <small>{supplierColorProducts.filter((item) => item.colorName === row.colorName).length} sizes</small>
                      </label>
                    ))}
                </div>
                {!supplierColorProducts.some((row) => !draft?.configuration.colors.some((color) => color.name === row.colorName || color.id === slugify(row.colorName))) && <div className="library-empty">All supplier colors for this style are already in the product.</div>}
                <div className="modal-actions"><span>{supplierSelectedColors.length} colors selected</span><button className="primary-button fit-button" type="button" disabled={!supplierSelectedColors.length} onClick={addSelectedSupplierColors}>Add selected colors</button></div>
              </>
            )}
            {supplierColorsMessage && <div className="error-message catalog-message">{supplierColorsMessage}</div>}
          </div>
        </div>
      )}
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
  const area = singlePrintZone(value);

  function point(event: ReactPointerEvent<SVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * 800, y: ((event.clientY - rect.top) / rect.height) * 800 };
  }

  function begin(kind: "zone-move" | "zone-resize", event: ReactPointerEvent<SVGElement>) {
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
    let next: PrintArea = { ...start };

    if (drag.kind === "zone-move") {
      const x = Math.max(0, Math.min(800 - start.width, start.x + dx));
      const y = Math.max(0, Math.min(800 - start.height, start.y + dy));
      next = {
        ...start,
        x,
        y,
        defaultX: x,
        defaultY: y
      };
    }

    if (drag.kind === "zone-resize") {
      const aspect = (start.widthInches || 4) / (start.heightInches || 4);
      let width = Math.max(45, Math.min(800 - start.x, start.width + dx));
      let height = width / aspect;
      if (height > 800 - start.y) {
        height = 800 - start.y;
        width = height * aspect;
      }
      next = {
        ...start,
        width,
        height,
        defaultX: start.x,
        defaultY: start.y,
        artworkWidth: width,
        artworkHeight: height
      };
    }

    onChange(singlePrintZone(next));
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
            rx="8"
            fill="rgba(21,153,88,.22)"
            stroke="#159958"
            strokeWidth="4"
            onPointerDown={(event) => begin("zone-move", event)}
            style={{ cursor: "move" }}
          />
          <text
            x={area.x + area.width / 2}
            y={area.y + area.height / 2}
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
            cx={area.x + area.width}
            cy={area.y + area.height}
            r="15"
            fill="#159958"
            stroke="#fff"
            strokeWidth="3"
            onPointerDown={(event) => begin("zone-resize", event)}
            style={{ cursor: "nwse-resize" }}
          />
        </g>
      </svg>
      <div className="zone-legend">
        <span><i className="full" /> Customer artwork / print zone</span>
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
  const current = singlePrintZone(value);

  function updateDimensions(next: Partial<PrintArea>) {
    const widthInches = Number(next.widthInches ?? current.widthInches ?? 4);
    const heightInches = Number(next.heightInches ?? current.heightInches ?? 4);
    const aspect = widthInches / heightInches;
    let width = current.width || 100;
    let height = width / aspect;
    if (height > 800 - current.y) {
      height = 800 - current.y;
      width = height * aspect;
    }
    onChange(
      singlePrintZone({
        ...current,
        ...next,
        width,
        height,
        defaultX: current.x,
        defaultY: current.y,
        artworkWidth: width,
        artworkHeight: height
      })
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
            ? "Place the green box where this compact print should begin. Customers use this same box for their artwork and can move or resize it directly."
            : "Place the green box where this large print should begin. Customers use this same box for their artwork and can move or resize it directly."}
        </p>
      </div>
      <div className="zone-dimension-grid">
        <MeasurementInput label="Maximum width" value={current.widthInches || 4} min={1} max={20} onCommit={(widthInches) => updateDimensions({ widthInches })} />
        <MeasurementInput label="Maximum height" value={current.heightInches || 4} min={1} max={24} onCommit={(heightInches) => updateDimensions({ heightInches })} />
      </div>
      <div className="zone-help-list">
        <div><b>1</b><span>Drag the green box to set the default print position.</span></div>
        <div><b>2</b><span>Resize the green box to set the largest visual print area.</span></div>
        <div><b>3</b><span>Use Maximum width and height for the real production dimensions.</span></div>
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
