"use client";

import { createClient } from "@supabase/supabase-js";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { brandArtworkUrl, garmentContrast } from "@/lib/brand-designs";
import {
  designOffers,
  garmentSupportsPlacement,
  placementDefinition,
  placementLabel
} from "@/lib/brand-builder";
import { printAreaFor } from "@/lib/catalog";
import type {
  BrandDesign,
  BrandDesignProductRule,
  BrandLockedPlacement,
  BrandPlacementKey
} from "@/lib/brand-types";
import type { CatalogProduct } from "@/lib/types";

const W = 800;
const H = 800;
const PLACEMENTS: BrandPlacementKey[] = ["front-heart", "front-full", "back-full"];

type VariantDraft = {
  id?: string;
  variant_type: "light" | "dark" | "universal";
  artwork_path: string;
  original_filename?: string;
  mime_type?: string;
  active: boolean;
};

type OfferDraft = Record<BrandPlacementKey, { enabled: boolean; retailPrice: number }>;

type Draft = {
  id?: string;
  name: string;
  description: string;
  categoryId: string;
  newCategory: string;
  active: boolean;
  featured: boolean;
  offers: OfferDraft;
  variants: VariantDraft[];
  productRules: BrandDesignProductRule[];
};

function assetUrl(url?: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.hostname.endsWith("ssactivewear.com")
      ? `/api/public/supplier-image?url=${encodeURIComponent(parsed.toString())}`
      : url;
  } catch {
    return url;
  }
}

function blankOffers(): OfferDraft {
  return {
    "front-heart": { enabled: false, retailPrice: 0 },
    "front-full": { enabled: true, retailPrice: 0 },
    "back-full": { enabled: false, retailPrice: 0 }
  };
}

function fresh(): Draft {
  return {
    name: "",
    description: "",
    categoryId: "",
    newCategory: "",
    active: true,
    featured: false,
    offers: blankOffers(),
    variants: [
      { variant_type: "light", artwork_path: "", active: true },
      { variant_type: "dark", artwork_path: "", active: true },
      { variant_type: "universal", artwork_path: "", active: true }
    ],
    productRules: []
  };
}

function fromDesign(design: BrandDesign): Draft {
  const offers = designOffers(design);
  return {
    id: design.id,
    name: design.name,
    description: design.description || "",
    categoryId: design.category_id || "",
    newCategory: "",
    active: design.active,
    featured: design.featured,
    offers: {
      "front-heart": { enabled: offers["front-heart"].enabled, retailPrice: offers["front-heart"].retailPrice },
      "front-full": { enabled: offers["front-full"].enabled, retailPrice: offers["front-full"].retailPrice },
      "back-full": { enabled: offers["back-full"].enabled, retailPrice: offers["back-full"].retailPrice }
    },
    variants: (["light", "dark", "universal"] as const).map((type) => {
      const existing = design.variants.find((item) => item.variant_type === type);
      return existing
        ? {
            id: existing.id,
            variant_type: type,
            artwork_path: existing.artwork_path,
            original_filename: existing.original_filename || undefined,
            mime_type: existing.mime_type || undefined,
            active: existing.active
          }
        : { variant_type: type, artwork_path: "", active: true };
    }),
    productRules: design.productRules || []
  };
}

function defaultPlacement(product: CatalogProduct, placementKey: BrandPlacementKey): BrandLockedPlacement {
  const def = placementDefinition(placementKey);
  const area = printAreaFor(product.configuration, def.side, def.printSize);
  const width = Math.min(area.artworkWidth || area.width, area.width) * .82;
  const height = Math.min(area.artworkHeight || area.height, area.height) * .82;

  return {
    enabled: true,
    side: def.side,
    printSize: def.printSize,
    decorationMethod: product.configuration.customization.decorationMethods[0] || "Screen Print",
    widthInches: Number(area.widthInches || 4),
    heightInches: Number(area.heightInches || 4),
    surcharge: 0,
    placement: {
      x: area.defaultX ?? area.x + (area.width - width) / 2,
      y: area.defaultY ?? area.y + (area.height - height) / 2,
      width,
      height,
      rotation: 0
    }
  };
}

export default function BrandDesignManager({
  initialDesigns,
  categories,
  products
}: {
  initialDesigns: BrandDesign[];
  categories: Array<{ id: string; name: string }>;
  products: CatalogProduct[];
}) {
  const [designs] = useState(initialDesigns);
  const [draft, setDraft] = useState<Draft>(initialDesigns[0] ? fromDesign(initialDesigns[0]) : fresh());
  const [activePlacement, setActivePlacement] = useState<BrandPlacementKey>("front-full");
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const product = products.find((item) => item.id === selectedProductId) || products[0];
  const [colorId, setColorId] = useState(product?.configuration.defaultColorId || product?.configuration.colors[0]?.id || "");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const visible = useMemo(
    () => designs.filter((item) => `${item.name} ${item.description || ""}`.toLowerCase().includes(search.toLowerCase())),
    [designs, search]
  );

  const def = placementDefinition(activePlacement);
  const rule = draft.productRules.find((item) => item.productId === product?.id);
  const locked = rule?.placements?.[activePlacement];
  const color = product?.configuration.colors.find((item) => item.id === colorId) || product?.configuration.colors[0];
  const contrast = color ? garmentContrast(color as any) : "light";
  const variant =
    draft.variants.find((item) => item.variant_type === contrast && item.artwork_path)
    || draft.variants.find((item) => item.variant_type === "universal" && item.artwork_path)
    || draft.variants.find((item) => item.artwork_path);
  const art = variant ? previewUrls[variant.variant_type] || (variant.id ? brandArtworkUrl(variant.id) : "") : "";

  function select(design: BrandDesign) {
    const next = fromDesign(design);
    setDraft(next);
    const firstEnabled = PLACEMENTS.find((key) => next.offers[key].enabled) || "front-full";
    setActivePlacement(firstEnabled);
    const firstAssigned = next.productRules.find((item) => item.placements?.[firstEnabled]?.enabled)?.productId;
    const nextProductId = firstAssigned || products[0]?.id || "";
    setSelectedProductId(nextProductId);
    const nextProduct = products.find((item) => item.id === nextProductId) || products[0];
    setColorId(nextProduct?.configuration.defaultColorId || nextProduct?.configuration.colors[0]?.id || "");
    setPreviewUrls({});
    setMessage("");
  }

  function patchRule(productId: string, updater: (rule: BrandDesignProductRule) => BrandDesignProductRule) {
    setDraft((current) => {
      const existing = current.productRules.find((item) => item.productId === productId);
      if (!existing) return current;
      return {
        ...current,
        productRules: current.productRules.map((item) => item.productId === productId ? updater(item) : item)
      };
    });
  }

  function setOfferEnabled(placementKey: BrandPlacementKey, enabled: boolean) {
    setDraft((current) => ({
      ...current,
      offers: {
        ...current.offers,
        [placementKey]: { ...current.offers[placementKey], enabled }
      }
    }));
    setActivePlacement(placementKey);
  }

  function setOfferPrice(placementKey: BrandPlacementKey, retailPrice: number) {
    setDraft((current) => ({
      ...current,
      offers: {
        ...current.offers,
        [placementKey]: { ...current.offers[placementKey], retailPrice: Math.max(0, retailPrice) }
      }
    }));
  }

  function assign(productToUpdate: CatalogProduct, placementKey: BrandPlacementKey, enabled: boolean) {
    setDraft((current) => {
      const existing = current.productRules.find((item) => item.productId === productToUpdate.id);
      const placements = { ...(existing?.placements || {}) };

      if (enabled) {
        placements[placementKey] = placements[placementKey] || defaultPlacement(productToUpdate, placementKey);
        placements[placementKey] = { ...placements[placementKey], enabled: true };
      } else if (placements[placementKey]) {
        placements[placementKey] = { ...placements[placementKey], enabled: false };
      }

      const nextRule: BrandDesignProductRule = { productId: productToUpdate.id, placements };
      const nextRules = existing
        ? current.productRules.map((item) => item.productId === productToUpdate.id ? nextRule : item)
        : [...current.productRules, nextRule];

      return { ...current, productRules: nextRules };
    });
  }

  function ensurePlacement() {
    if (!product) return;
    assign(product, activePlacement, true);
  }

  function patchPlacement(patch: Partial<BrandLockedPlacement>) {
    if (!product || !locked) return;
    patchRule(product.id, (currentRule) => ({
      ...currentRule,
      placements: {
        ...currentRule.placements,
        [activePlacement]: { ...locked, ...patch }
      }
    }));
  }

  async function upload(type: VariantDraft["variant_type"], file?: File) {
    if (!file) return;
    setBusy(`upload-${type}`);
    setMessage("");

    try {
      const prep = await fetch("/api/admin/brand-designs/artwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          sizeBytes: file.size,
          variantType: type,
          designId: draft.id || "draft"
        })
      });
      const data = await prep.json();
      if (!prep.ok) throw new Error(data.error || "Unable to prepare upload.");

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );

      const result = await supabase.storage
        .from(data.bucket)
        .uploadToSignedUrl(data.path, data.token, file, { contentType: data.contentType || file.type });

      if (result.error) throw result.error;

      const previewUrl = URL.createObjectURL(file);
      setPreviewUrls((current) => ({ ...current, [type]: previewUrl }));
      setDraft((current) => ({
        ...current,
        variants: current.variants.map((item) =>
          item.variant_type === type
            ? {
                ...item,
                artwork_path: data.path,
                original_filename: file.name,
                mime_type: data.contentType || file.type,
                active: true
              }
            : item
        )
      }));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!draft.name.trim()) return setMessage("Enter a design name.");
    if (!draft.variants.some((item) => item.artwork_path)) return setMessage("Upload light, dark, or universal artwork.");
    if (!PLACEMENTS.some((key) => draft.offers[key].enabled)) return setMessage("Enable at least one customer placement.");

    const enabledPlacements = PLACEMENTS.filter((key) => draft.offers[key].enabled);
    const hasCompatible = draft.productRules.some((rule) =>
      enabledPlacements.some((key) => rule.placements?.[key]?.enabled)
    );
    if (!hasCompatible) return setMessage("Approve at least one enabled placement on a compatible garment.");

    setBusy("save");
    setMessage("");

    try {
      const response = await fetch("/api/admin/brand-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design: {
            ...draft,
            customerOffers: draft.offers
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save design.");
      window.location.reload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save design.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!draft.id || !confirm(`Delete ${draft.name}?`)) return;
    const response = await fetch(`/api/admin/brand-designs?id=${draft.id}`, { method: "DELETE" });
    if (response.ok) location.reload();
  }

  return (
    <div className="brand-design-v4">
      <aside className="admin-card design-library-v4">
        <div className="library-title">
          <div><p className="eyebrow">DESIGNS</p><h2>Design library</h2></div>
          <button onClick={() => { setDraft(fresh()); setActivePlacement("front-full"); setMessage(""); }}>New</button>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search designs" />
        <div className="design-list-v4">
          {visible.map((design) => {
            const offers = designOffers(design);
            const count = PLACEMENTS.filter((key) => offers[key].enabled).length;
            return (
              <button key={design.id} className={draft.id === design.id ? "active" : ""} onClick={() => select(design)}>
                <span>{design.name.slice(0, 2).toUpperCase()}</span>
                <div><strong>{design.name}</strong><small>{count} placement{count === 1 ? "" : "s"} available</small></div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="design-editor-v4">
        <header className="admin-card design-head-v4">
          <div>
            <p className="eyebrow">BRAND DESIGN</p>
            <h1>{draft.id ? draft.name : "New design"}</h1>
            <p>Create the artwork once, then decide where customers may use it and which garments support each placement.</p>
          </div>
          <label className="modern-switch">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            <span /><b>{draft.active ? "Live" : "Hidden"}</b>
          </label>
        </header>

        <div className="owner-flow">
          <span className="done">1 · Design</span><i />
          <span className={draft.variants.some((item) => item.artwork_path) ? "done" : ""}>2 · Artwork</span><i />
          <span className={PLACEMENTS.some((key) => draft.offers[key].enabled) ? "done" : ""}>3 · Placements</span><i />
          <span className={draft.productRules.some((rule) => Object.values(rule.placements || {}).some((placement) => placement.enabled)) ? "done" : ""}>4 · Garments</span>
        </div>

        <div className="design-v4-grid">
          <div className="design-form-v4">
            <section className="admin-card">
              <SectionTitle number="01" title="Design details" text="Name and organize the artwork customers will browse." />
              <div className="clean-form-grid">
                <label><span>Design name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
                <label><span>Category</span><select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}><option value="">Uncategorized</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="wide"><span>Description</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              </div>
            </section>

            <section className="admin-card">
              <SectionTitle number="02" title="Artwork versions" text="Use light and dark versions so the design stays legible on every garment color." />
              <div className="artwork-upload-v4">
                {draft.variants.map((item) => (
                  <div key={item.variant_type}>
                    <strong>{item.variant_type === "light" ? "Light garments" : item.variant_type === "dark" ? "Dark garments" : "Universal fallback"}</strong>
                    <div className="art-preview-v4">
                      {previewUrls[item.variant_type]
                        ? <img src={previewUrls[item.variant_type]} alt="" />
                        : item.id && item.artwork_path
                          ? <img src={brandArtworkUrl(item.id)} alt="" />
                          : <span>No artwork</span>}
                    </div>
                    <label>
                      {busy === `upload-${item.variant_type}` ? "Uploading…" : item.artwork_path ? "Replace artwork" : "Upload artwork"}
                      <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg" disabled={Boolean(busy)} onChange={(event) => {
                        const input = event.currentTarget;
                        void upload(item.variant_type, input.files?.[0]).finally(() => { input.value = ""; });
                      }} />
                    </label>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-card">
              <SectionTitle number="03" title="Placement versions & pricing" text="Enable every placement customers may choose. Each version can have its own design add-on price." />
              <div className="offer-grid-v4">
                {PLACEMENTS.map((placementKey) => {
                  const offer = draft.offers[placementKey];
                  const def = placementDefinition(placementKey);
                  return (
                    <article key={placementKey} className={offer.enabled ? "active" : ""}>
                      <button className="offer-toggle" onClick={() => setOfferEnabled(placementKey, !offer.enabled)}>
                        <span>{placementKey === "front-heart" ? "FH" : placementKey === "front-full" ? "FF" : "BF"}</span>
                        <div><strong>{placementLabel(placementKey)}</strong><small>{offer.enabled ? "Available to customers" : "Not available"}</small></div>
                        <i>{offer.enabled ? "✓" : "+"}</i>
                      </button>
                      {offer.enabled && (
                        <label>
                          <span>Design add-on price</span>
                          <div><b>$</b><input type="number" min="0" step=".50" value={offer.retailPrice || ""} onChange={(event) => setOfferPrice(placementKey, Number(event.target.value) || 0)} /></div>
                        </label>
                      )}
                    </article>
                  );
                })}
              </div>
              <p className="owner-note">Switching between placement versions no longer clears compatible garments. Every placement keeps its own garment approvals and exact mockup position.</p>
            </section>

            <section className="admin-card">
              <SectionTitle number="04" title="Compatible garments by placement" text="Choose a placement above, then approve the exact garments that can offer that version." />
              <div className="placement-tabs-v4">
                {PLACEMENTS.map((placementKey) => (
                  <button
                    key={placementKey}
                    disabled={!draft.offers[placementKey].enabled}
                    className={activePlacement === placementKey ? "active" : ""}
                    onClick={() => setActivePlacement(placementKey)}
                  >
                    {placementLabel(placementKey)}
                  </button>
                ))}
              </div>
              <div className="compatible-garments-v4">
                {products.map((item) => {
                  const supported = garmentSupportsPlacement(item, activePlacement);
                  const assigned = Boolean(draft.productRules.find((rule) => rule.productId === item.id)?.placements?.[activePlacement]?.enabled);
                  return (
                    <label key={item.id} className={`${assigned ? "selected" : ""} ${!supported ? "disabled" : ""}`}>
                      <input type="checkbox" disabled={!supported || !draft.offers[activePlacement].enabled} checked={assigned} onChange={(event) => assign(item, activePlacement, event.target.checked)} />
                      <span><strong>{item.name}</strong><small>{supported ? `${item.configuration.colors.length} colors · ${item.configuration.sizes.length} sizes` : `${placementLabel(activePlacement)} is disabled for this garment`}</small></span>
                      <i>{assigned ? "✓" : supported ? "" : "—"}</i>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="admin-card design-preview-v4">
            <div className="preview-heading-v4">
              <div><p className="eyebrow">GARMENT PREVIEW</p><h2>{placementLabel(activePlacement)}</h2></div>
              <span>{draft.offers[activePlacement].enabled ? "ACTIVE" : "OFF"}</span>
            </div>

            {product ? (
              <>
                <label className="preview-select"><span>Preview garment</span><select value={selectedProductId} onChange={(event) => {
                  setSelectedProductId(event.target.value);
                  const next = products.find((item) => item.id === event.target.value);
                  setColorId(next?.configuration.defaultColorId || next?.configuration.colors[0]?.id || "");
                }}>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>

                <div className="preview-color-chips">
                  {product.configuration.colors.map((item) => <button key={item.id} className={color?.id === item.id ? "active" : ""} title={item.name} onClick={() => setColorId(item.id)}><i style={{ background: item.hex }} /></button>)}
                </div>

                <DesignCanvas
                  product={product}
                  color={color}
                  placementKey={activePlacement}
                  art={art}
                  placement={locked}
                  onChange={(placement) => patchPlacement({ placement })}
                />

                {!locked?.enabled && draft.offers[activePlacement].enabled && garmentSupportsPlacement(product, activePlacement) && (
                  <button className="approve-garment" onClick={ensurePlacement}>Approve {placementLabel(activePlacement)} on this garment</button>
                )}

                {locked?.enabled && (
                  <div className="placement-fields-v4">
                    <label><span>Print width</span><div><input type="number" step=".25" value={locked.widthInches} onChange={(event) => patchPlacement({ widthInches: Number(event.target.value) || 1 })} /><b>in</b></div></label>
                    <label><span>Print height</span><div><input type="number" step=".25" value={locked.heightInches} onChange={(event) => patchPlacement({ heightInches: Number(event.target.value) || 1 })} /><b>in</b></div></label>
                    <label className="wide"><span>Decoration method</span><select value={locked.decorationMethod} onChange={(event) => patchPlacement({ decorationMethod: event.target.value })}>{product.configuration.customization.decorationMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
                  </div>
                )}
              </>
            ) : <p>No Brand garments are available.</p>}
          </aside>
        </div>

        {message && <div className={message.toLowerCase().includes("saved") ? "success-message" : "error-message"}>{message}</div>}
        <div className="design-actions-v4">
          {draft.id && <button className="danger-button" onClick={remove}>Delete</button>}
          <button className="primary-button" disabled={Boolean(busy)} onClick={save}>{busy === "save" ? "Saving…" : "Save design"}</button>
        </div>
      </section>

      <style jsx>{`
        .brand-design-v4{display:grid;grid-template-columns:245px minmax(0,1fr);gap:12px;align-items:start}.design-library-v4{position:sticky;top:14px;padding:13px}.library-title{display:flex;justify-content:space-between;align-items:center}.library-title h2{margin:2px 0}.library-title button{padding:6px 8px;border:1px solid #ddd;border-radius:7px;background:#fff;font-size:7px}.design-library-v4>input{width:100%;box-sizing:border-box;margin:9px 0}.design-list-v4{display:grid;gap:4px}.design-list-v4 button{display:grid;grid-template-columns:32px 1fr;gap:7px;align-items:center;padding:7px;border:1px solid transparent;border-radius:8px;background:transparent;color:#171717;text-align:left}.design-list-v4 button.active{background:#f1f2f7;border-color:#d8dce8}.design-list-v4 button>span{display:grid;place-items:center;width:30px;height:30px;border-radius:7px;background:#1f2947;color:#fff;font-size:7px}.design-list-v4 strong,.design-list-v4 small{display:block}.design-list-v4 strong{font-size:8px}.design-list-v4 small{font-size:6px;color:#888}
        .design-editor-v4{display:grid;gap:10px}.design-head-v4{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:17px}.design-head-v4 h1{margin:3px 0}.design-head-v4 p:not(.eyebrow){max-width:720px;margin:0;color:#777}.owner-flow{display:grid;grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;align-items:center;padding:5px;border:1px solid #e2e2dd;border-radius:10px;background:#f2f2ee}.owner-flow span{padding:7px;border-radius:7px;text-align:center;font-size:7px;color:#888}.owner-flow span.done{background:#fff;color:#1f2947;font-weight:850}.owner-flow i{width:18px;height:1px;background:#ccc}
        .design-v4-grid{display:grid;grid-template-columns:minmax(0,1fr) 410px;gap:10px;align-items:start}.design-form-v4{display:grid;gap:10px}.design-form-v4>section,.design-preview-v4{padding:17px}.section-title{display:grid;grid-template-columns:28px 1fr;gap:8px;align-items:start;margin-bottom:12px}.section-title>span{display:grid;place-items:center;width:27px;height:27px;border-radius:99px;background:#1f2947;color:#fff;font-size:7px;font-weight:900}.section-title h2{margin:1px 0;font-size:13px}.section-title p{margin:0;color:#888;font-size:7px}
        .clean-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.clean-form-grid label{display:grid;gap:4px}.clean-form-grid label>span{font-size:7px;font-weight:800}.clean-form-grid .wide{grid-column:1/-1}.artwork-upload-v4{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.artwork-upload-v4>div{display:grid;gap:6px;padding:8px;border:1px solid #ddd;border-radius:9px}.artwork-upload-v4 strong{font-size:7px}.art-preview-v4{height:120px;padding:10px;border-radius:7px;background:#f3f3ef}.art-preview-v4 img{width:100%;height:100%;object-fit:contain}.art-preview-v4 span{display:grid;place-items:center;height:100%;font-size:7px;color:#999}.artwork-upload-v4 label{padding:7px;border-radius:7px;background:#171717;color:#fff;text-align:center;font-size:7px}.artwork-upload-v4 input{display:none}
        .offer-grid-v4{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.offer-grid-v4 article{padding:6px;border:1px solid #ddd;border-radius:10px}.offer-grid-v4 article.active{border-color:#1f2947;background:#f4f6fb}.offer-toggle{display:grid;grid-template-columns:32px 1fr 22px;gap:7px;align-items:center;width:100%;padding:4px;border:0;background:transparent;color:#171717;text-align:left}.offer-toggle>span{display:grid;place-items:center;width:30px;height:30px;border-radius:7px;background:#e9e9e5;font-size:7px;font-weight:900}.offer-grid-v4 article.active .offer-toggle>span{background:#1f2947;color:#fff}.offer-toggle strong,.offer-toggle small{display:block}.offer-toggle strong{font-size:8px}.offer-toggle small{font-size:6px;color:#888}.offer-toggle i{font-style:normal;font-size:10px}.offer-grid-v4 article>label{display:grid;gap:4px;margin-top:6px;padding-top:6px;border-top:1px solid #ddd}.offer-grid-v4 article>label>span{font-size:6px;font-weight:800}.offer-grid-v4 article>label>div{display:grid;grid-template-columns:24px 1fr;border:1px solid #ddd;border-radius:7px;background:#fff}.offer-grid-v4 article>label b{display:grid;place-items:center}.offer-grid-v4 article>label input{border:0}.owner-note{margin:9px 0 0;padding:8px;border-radius:8px;background:#eef2fb;color:#57617a;font-size:7px}
        .placement-tabs-v4{display:flex;gap:4px;margin-bottom:8px}.placement-tabs-v4 button{padding:7px 9px;border:1px solid #ddd;border-radius:7px;background:#fff;font-size:7px}.placement-tabs-v4 button.active{background:#1f2947;color:#fff;border-color:#1f2947}.placement-tabs-v4 button:disabled{opacity:.35}.compatible-garments-v4{display:grid;grid-template-columns:1fr 1fr;gap:5px}.compatible-garments-v4 label{display:grid;grid-template-columns:auto 1fr 20px;gap:7px;align-items:center;padding:8px;border:1px solid #ddd;border-radius:8px}.compatible-garments-v4 label.selected{background:#f0f2f8;border-color:#c7cede}.compatible-garments-v4 label.disabled{opacity:.45;background:#f5f5f2}.compatible-garments-v4 strong,.compatible-garments-v4 small{display:block}.compatible-garments-v4 strong{font-size:8px}.compatible-garments-v4 small{font-size:6px;color:#888}.compatible-garments-v4 i{display:grid;place-items:center;width:18px;height:18px;border-radius:99px;background:#1f2947;color:#fff;font-size:7px;font-style:normal}
        .design-preview-v4{position:sticky;top:14px}.preview-heading-v4{display:flex;justify-content:space-between}.preview-heading-v4 h2{margin:2px 0}.preview-heading-v4>span{padding:5px 7px;border-radius:99px;background:#f0f2f8;color:#1f2947;font-size:6px;font-weight:900}.preview-select{display:grid;gap:4px;margin:9px 0}.preview-select>span{font-size:7px;font-weight:800}.preview-color-chips{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:7px}.preview-color-chips button{display:grid;place-items:center;width:24px;height:24px;border:1px solid #ddd;border-radius:99px;background:#fff}.preview-color-chips button.active{border:2px solid #171717}.preview-color-chips i{width:15px;height:15px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}.approve-garment{width:100%;margin-top:8px;padding:9px;border:0;border-radius:8px;background:#1f2947;color:#fff;font-size:8px;font-weight:800}.placement-fields-v4{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.placement-fields-v4 label>span{display:block;margin-bottom:4px;font-size:7px;font-weight:800}.placement-fields-v4 label>div{display:grid;grid-template-columns:1fr 25px;border:1px solid #ddd;border-radius:7px;overflow:hidden}.placement-fields-v4 input{border:0}.placement-fields-v4 b{display:grid;place-items:center;background:#eee;font-size:6px}.placement-fields-v4 .wide{grid-column:1/-1}.design-actions-v4{display:flex;justify-content:flex-end;gap:7px}
        @media(max-width:1050px){.brand-design-v4{grid-template-columns:1fr}.design-library-v4{position:static}.design-v4-grid{grid-template-columns:1fr}.design-preview-v4{position:static}.design-list-v4{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.owner-flow{grid-template-columns:1fr 1fr}.owner-flow i{display:none}.clean-form-grid,.artwork-upload-v4,.offer-grid-v4,.compatible-garments-v4{grid-template-columns:1fr}.design-list-v4{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}

function SectionTitle({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="section-title"><span>{number}</span><div><h2>{title}</h2><p>{text}</p></div></div>;
}

function DesignCanvas({
  product,
  color,
  placementKey,
  art,
  placement,
  onChange
}: {
  product: CatalogProduct;
  color: any;
  placementKey: BrandPlacementKey;
  art: string;
  placement?: BrandLockedPlacement;
  onChange: (placement: BrandLockedPlacement["placement"]) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const drag = useRef<any>(null);
  const def = placementDefinition(placementKey);
  const imageUrl = def.side === "back"
    ? color?.backImageUrl || product.configuration.mockupImageUrl
    : color?.frontImageUrl || product.configuration.mockupImageUrl;

  function point(event: ReactPointerEvent<SVGElement>) {
    const rect = ref.current!.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
  }

  function begin(kind: "move" | "resize", event: ReactPointerEvent<SVGElement>) {
    if (!placement) return;
    event.preventDefault();
    drag.current = { kind, point: point(event), start: { ...placement.placement } };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: ReactPointerEvent<SVGElement>) {
    if (!drag.current || !placement) return;
    const current = point(event);
    const dx = current.x - drag.current.point.x;
    const dy = current.y - drag.current.point.y;
    const start = drag.current.start;
    const area = printAreaFor(product.configuration, def.side, def.printSize);
    let next = { ...start };

    if (drag.current.kind === "move") {
      next.x = Math.max(area.x, Math.min(area.x + area.width - start.width, start.x + dx));
      next.y = Math.max(area.y, Math.min(area.y + area.height - start.height, start.y + dy));
    } else {
      const ratio = start.height / start.width;
      let width = Math.max(35, Math.min(area.x + area.width - start.x, start.width + dx));
      let height = width * ratio;
      if (height > area.y + area.height - start.y) {
        height = area.y + area.height - start.y;
        width = height / ratio;
      }
      next.width = width;
      next.height = height;
    }
    onChange(next);
  }

  return (
    <svg ref={ref} viewBox="0 0 800 800" onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} style={{ width: "100%", background: "#f3f3ef", borderRadius: 10 }}>
      <rect width="800" height="800" fill="#f3f3ef" />
      {imageUrl && <image href={assetUrl(imageUrl)} x="28" y="28" width="744" height="744" preserveAspectRatio="xMidYMid meet" />}
      {placement?.enabled && art && (
        <>
          <image href={art} x={placement.placement.x} y={placement.placement.y} width={placement.placement.width} height={placement.placement.height} onPointerDown={(event) => begin("move", event)} style={{ cursor: "move" }} />
          <rect x={placement.placement.x} y={placement.placement.y} width={placement.placement.width} height={placement.placement.height} fill="none" stroke="#111" strokeWidth="2" pointerEvents="none" />
          <circle cx={placement.placement.x + placement.placement.width} cy={placement.placement.y + placement.placement.height} r="13" fill="#111" onPointerDown={(event) => begin("resize", event)} style={{ cursor: "nwse-resize" }} />
        </>
      )}
    </svg>
  );
}
