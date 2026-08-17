"use client";

import { createClient } from "@supabase/supabase-js";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { printAreaFor } from "@/lib/catalog";
import { brandArtworkUrl, garmentContrast } from "@/lib/brand-designs";
import type { BrandDesign, BrandDesignProductRule, BrandLockedPlacement } from "@/lib/brand-types";
import type { CatalogProduct, DesignSide, PrintSize } from "@/lib/types";

const W = 800;
const H = 800;

type VariantDraft = {
  id?: string;
  variant_type: "light" | "dark" | "universal";
  artwork_path: string;
  original_filename?: string;
  mime_type?: string;
  active: boolean;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  categoryId: string;
  newCategory: string;
  active: boolean;
  featured: boolean;
  variants: VariantDraft[];
  productRules: BrandDesignProductRule[];
};

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

function fresh(): Draft {
  return {
    name: "",
    description: "",
    categoryId: "",
    newCategory: "",
    active: true,
    featured: false,
    variants: [
      { variant_type: "light", artwork_path: "", active: true },
      { variant_type: "dark", artwork_path: "", active: true },
      { variant_type: "universal", artwork_path: "", active: true }
    ],
    productRules: []
  };
}

function fromDesign(design: BrandDesign): Draft {
  return {
    id: design.id,
    name: design.name,
    description: design.description || "",
    categoryId: design.category_id || "",
    newCategory: "",
    active: design.active,
    featured: design.featured,
    variants: (["light", "dark", "universal"] as const).map((type) => {
      const variant = design.variants.find((item) => item.variant_type === type);
      return variant
        ? {
            id: variant.id,
            variant_type: type,
            artwork_path: variant.artwork_path,
            original_filename: variant.original_filename || undefined,
            mime_type: variant.mime_type || undefined,
            active: variant.active
          }
        : { variant_type: type, artwork_path: "", active: true };
    }),
    productRules: design.productRules || []
  };
}

function placementKey(side: DesignSide, size: PrintSize) {
  return `${side}-${size}`;
}

function defaultLockedPlacement(product: CatalogProduct, side: DesignSide, size: PrintSize): BrandLockedPlacement {
  const area = printAreaFor(product.configuration, side, size);
  const width = Math.min(area.artworkWidth || area.width, area.width) * .85;
  const height = Math.min(area.artworkHeight || area.height, area.height) * .85;
  return {
    enabled: true,
    side,
    printSize: size,
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
  const firstDesign = initialDesigns[0];
  const [designs, setDesigns] = useState(initialDesigns);
  const [draft, setDraft] = useState<Draft>(firstDesign ? fromDesign(firstDesign) : fresh());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(firstDesign?.productRules?.[0]?.productId || products[0]?.id || "");
  const selectedProduct = products.find((item) => item.id === selectedProductId) || products[0];
  const [selectedColorId, setSelectedColorId] = useState(selectedProduct?.configuration.defaultColorId || selectedProduct?.configuration.colors[0]?.id || "");
  const [side, setSide] = useState<DesignSide>("front");
  const [printSize, setPrintSize] = useState<PrintSize>(selectedProduct?.configuration.customization.printSizes.includes("full") ? "full" : selectedProduct?.configuration.customization.printSizes[0] || "full");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [contrastOverrides, setContrastOverrides] = useState<Record<string, Record<string, "auto" | "light" | "dark">>>({});

  const visible = useMemo(
    () => designs.filter((item) => `${item.name} ${item.description || ""}`.toLowerCase().includes(query.toLowerCase())),
    [designs, query]
  );

  const rule = draft.productRules.find((item) => item.productId === selectedProduct?.id);
  const assigned = Boolean(rule);
  const key = placementKey(side, printSize);
  const locked = rule?.placements?.[key];
  const color = selectedProduct?.configuration.colors.find((item) => item.id === selectedColorId)
    || selectedProduct?.configuration.colors[0];
  const contrast = color ? garmentContrast(color as any) : "light";
  const preferredVariant = draft.variants.find((item) => item.variant_type === contrast && item.artwork_path)
    || draft.variants.find((item) => item.variant_type === "universal" && item.artwork_path)
    || draft.variants.find((item) => item.artwork_path);
  const artPreview = preferredVariant
    ? previewUrls[preferredVariant.variant_type] || (preferredVariant.id ? brandArtworkUrl(preferredVariant.id) : "")
    : "";

  function selectDesign(design: BrandDesign) {
    setDraft(fromDesign(design));
    const firstRule = design.productRules?.[0];
    const nextProduct = products.find((item) => item.id === firstRule?.productId) || products[0];
    setSelectedProductId(nextProduct?.id || "");
    setSelectedColorId(nextProduct?.configuration.defaultColorId || nextProduct?.configuration.colors[0]?.id || "");
    setSide("front");
    setPrintSize(nextProduct?.configuration.customization.printSizes.includes("full") ? "full" : nextProduct?.configuration.customization.printSizes[0] || "full");
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

  function assignProduct(product: CatalogProduct, enabled: boolean) {
    setDraft((current) => {
      if (enabled) {
        if (current.productRules.some((item) => item.productId === product.id)) return current;
        return {
          ...current,
          productRules: [...current.productRules, {
            productId: product.id,
            placements: {}
          }]
        };
      }
      return {
        ...current,
        productRules: current.productRules.filter((item) => item.productId !== product.id)
      };
    });
  }

  function togglePlacement(enabled: boolean) {
    if (!selectedProduct) return;
    patchRule(selectedProduct.id, (current) => {
      const placements = { ...current.placements };
      if (enabled) placements[key] = locked || defaultLockedPlacement(selectedProduct, side, printSize);
      else delete placements[key];
      return { ...current, placements };
    });
  }

  function patchPlacement(patch: Partial<BrandLockedPlacement>) {
    if (!selectedProduct || !locked) return;
    patchRule(selectedProduct.id, (current) => ({
      ...current,
      placements: {
        ...current.placements,
        [key]: { ...locked, ...patch }
      }
    }));
  }

  async function upload(type: VariantDraft["variant_type"], file?: File) {
    if (!file) return;
    setBusy(`upload-${type}`);
    setMessage("");

    try {
      const prepare = await fetch("/api/admin/brand-designs/artwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          sizeBytes: file.size,
          variantType: type,
          designId: draft.id || "draft"
        })
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Unable to prepare upload.");

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );

      const result = await supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: prepared.contentType });
      if (result.error) throw result.error;

      const local = URL.createObjectURL(file);
      setPreviewUrls((current) => {
        const previous = current[type];
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
        return { ...current, [type]: local };
      });

      setDraft((current) => ({
        ...current,
        variants: current.variants.map((item) => item.variant_type === type
          ? {
              ...item,
              artwork_path: prepared.path,
              original_filename: file.name,
              mime_type: prepared.contentType,
              active: true
            }
          : item)
      }));
      setMessage("Artwork uploaded. Position it on each assigned Brand garment, then save.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to upload artwork.");
    } finally {
      setBusy("");
    }
  }

  function cycleContrast(productId: string, colorItem: any) {
    const current = contrastOverrides[productId]?.[colorItem.id] || colorItem.contrastMode || "auto";
    const next = current === "auto" ? "light" : current === "light" ? "dark" : "auto";
    setContrastOverrides((all) => ({
      ...all,
      [productId]: { ...(all[productId] || {}), [colorItem.id]: next }
    }));
  }

  async function save() {
    if (!draft.name.trim()) return setMessage("Enter a design name.");
    if (!draft.variants.some((item) => item.artwork_path)) return setMessage("Upload at least one Brand artwork file.");
    if (!draft.productRules.length) return setMessage("Assign at least one Brand garment.");
    if (!draft.productRules.some((item) => Object.keys(item.placements || {}).length)) {
      return setMessage("Set at least one visual placement.");
    }

    setBusy("save");
    setMessage("");

    try {
      const contrastUpdates = Object.entries(contrastOverrides).map(([productId, values]) => ({
        productId,
        colors: Object.entries(values).map(([id, contrastMode]) => ({ id, contrastMode }))
      }));

      const response = await fetch("/api/admin/brand-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design: {
            ...draft,
            productIds: draft.productRules.map((item) => item.productId),
            contrastUpdates
          }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Brand design.");

      setMessage("Brand design saved with locked visual placements.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save Brand design.");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Delete ${draft.name}?`)) return;
    setBusy("delete");
    const response = await fetch(`/api/admin/brand-designs?id=${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to delete design.");

    const remaining = designs.filter((item) => item.id !== draft.id);
    setDesigns(remaining);
    setDraft(remaining[0] ? fromDesign(remaining[0]) : fresh());
    setMessage("Design deleted.");
  }

  if (!products.length) {
    return (
      <section className="admin-card empty-brand-design">
        <h2>Add a Brand garment first</h2>
        <p>Brand Design Builder only uses garments configured in Brand / Merch → Garments.</p>
        <a className="primary-button" href="/dashboard/brand-garments">Brand garments</a>
      </section>
    );
  }

  const enabledSides: DesignSide[] = [
    ...(selectedProduct.configuration.customization.frontEnabled ? ["front"] as DesignSide[] : []),
    ...(selectedProduct.configuration.customization.backEnabled ? ["back"] as DesignSide[] : [])
  ];
  const allowedSizes = selectedProduct.configuration.customization.printSizes;
  const garmentUrl = assetUrl(
    side === "front"
      ? color?.frontImageUrl || selectedProduct.configuration.mockupImageUrl
      : color?.backImageUrl || selectedProduct.configuration.mockupImageUrl
  );
  const activeArea = printAreaFor(selectedProduct.configuration, side, printSize);

  function applyVisualPlacement(next: any) {
    if (!locked) return;
    const widthInches = activeArea.widthInches
      ? Number(((next.width / activeArea.width) * activeArea.widthInches).toFixed(2))
      : locked.widthInches;
    const heightInches = activeArea.heightInches
      ? Number(((next.height / activeArea.height) * activeArea.heightInches).toFixed(2))
      : locked.heightInches;
    patchPlacement({ placement: next, widthInches, heightInches });
  }

  function applyPhysicalSize(axis: "width" | "height", value: number) {
    if (!locked) return;
    const nextValue = Math.max(.5, value || .5);
    const nextPlacement = { ...locked.placement };

    if (axis === "width" && activeArea.widthInches) {
      nextPlacement.width = Math.min(activeArea.width, activeArea.width * (nextValue / activeArea.widthInches));
      nextPlacement.x = Math.max(activeArea.x, Math.min(activeArea.x + activeArea.width - nextPlacement.width, nextPlacement.x));
      patchPlacement({ widthInches: nextValue, placement: nextPlacement });
      return;
    }

    if (axis === "height" && activeArea.heightInches) {
      nextPlacement.height = Math.min(activeArea.height, activeArea.height * (nextValue / activeArea.heightInches));
      nextPlacement.y = Math.max(activeArea.y, Math.min(activeArea.y + activeArea.height - nextPlacement.height, nextPlacement.y));
      patchPlacement({ heightInches: nextValue, placement: nextPlacement });
    }
  }

  return (
    <div className="brand-builder-shell">
      <aside className="admin-card design-library">
        <div className="library-head">
          <div><p className="eyebrow">BRAND DESIGNS</p><h2>Library</h2></div>
          <button className="secondary-button compact" onClick={() => { setDraft(fresh()); setPreviewUrls({}); }}>New</button>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search designs" />
        <div className="design-list">
          {visible.map((item) => (
            <button key={item.id} className={draft.id === item.id ? "active" : ""} onClick={() => selectDesign(item)}>
              <span>{item.name.slice(0, 2).toUpperCase()}</span>
              <div><strong>{item.name}</strong><small>{item.productRules?.length || 0} Brand garments</small></div>
              <i className={item.active ? "live" : ""} />
            </button>
          ))}
        </div>
      </aside>

      <section className="design-workspace">
        <header className="admin-card builder-head">
          <div><p className="eyebrow">VISUAL BRAND BUILDER</p><h1>{draft.id ? draft.name : "New Brand design"}</h1><p>Build the production placement directly on each Brand garment. Customers receive this locked setup.</p></div>
          <label className="modern-switch"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span /><b>{draft.active ? "Live" : "Hidden"}</b></label>
        </header>

        <div className="builder-main-grid">
          <section className="admin-card visual-stage-card">
            <div className="stage-toolbar">
              <select
                value={selectedProduct.id}
                onChange={(event) => {
                  const next = products.find((item) => item.id === event.target.value)!;
                  setSelectedProductId(next.id);
                  setSelectedColorId(next.configuration.defaultColorId || next.configuration.colors[0]?.id || "");
                  setSide(next.configuration.customization.frontEnabled ? "front" : "back");
                  setPrintSize(next.configuration.customization.printSizes.includes("full") ? "full" : next.configuration.customization.printSizes[0] || "full");
                }}
              >
                {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>

              <select value={color?.id || ""} onChange={(event) => setSelectedColorId(event.target.value)}>
                {selectedProduct.configuration.colors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>

              <div className="stage-tabs">
                {enabledSides.map((item) => <button key={item} className={side === item ? "active" : ""} onClick={() => setSide(item)}>{item === "front" ? "Front" : "Back"}</button>)}
                {allowedSizes.map((item) => <button key={item} className={printSize === item ? "active size" : "size"} onClick={() => setPrintSize(item)}>{item === "heart" ? "Heart" : "Full"}</button>)}
              </div>
            </div>

            <DesignPlacementCanvas
              garmentUrl={garmentUrl}
              artUrl={artPreview}
              area={activeArea}
              placement={locked?.placement}
              enabled={Boolean(locked)}
              onChange={applyVisualPlacement}
            />

            <div className="stage-status">
              <div><span>Artwork version</span><strong>{preferredVariant ? preferredVariant.variant_type === "dark" ? "Dark garment art" : preferredVariant.variant_type === "light" ? "Light garment art" : "Universal art" : "Upload artwork"}</strong></div>
              <div><span>Brand garment</span><strong>{assigned ? "Assigned" : "Not assigned"}</strong></div>
              <div><span>Placement</span><strong>{locked ? "Locked for customers" : "Disabled"}</strong></div>
            </div>
          </section>

          <aside className="builder-controls">
            <section className="admin-card control-section">
              <StepTitle n="1" title="Design details" />
              <label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label><span>Category</span><select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value, newCategory: "" })}><option value="">Uncategorized</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>New category</span><input value={draft.newCategory} onChange={(event) => setDraft({ ...draft, newCategory: event.target.value })} placeholder="Optional" /></label>
              <label><span>Description</span><textarea rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            </section>

            <section className="admin-card control-section">
              <StepTitle n="2" title="Artwork" />
              <div className="art-upload-stack">
                {(["light", "dark", "universal"] as const).map((type) => {
                  const variant = draft.variants.find((item) => item.variant_type === type)!;
                  return (
                    <label key={type} className={variant.artwork_path ? "art-upload active" : "art-upload"}>
                      <div><strong>{type === "light" ? "Light garments" : type === "dark" ? "Dark garments" : "Universal fallback"}</strong><small>{variant.original_filename || "No file"}</small></div>
                      <span>{busy === `upload-${type}` ? "Uploading…" : variant.artwork_path ? "Replace" : "Upload"}</span>
                      <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg" disabled={Boolean(busy)} onChange={(event) => { const input = event.currentTarget; void upload(type, input.files?.[0]).finally(() => { input.value = ""; }); }} />
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="admin-card control-section">
              <StepTitle n="3" title="Garment assignment" />
              <label className="assignment-toggle">
                <input type="checkbox" checked={assigned} onChange={(event) => assignProduct(selectedProduct, event.target.checked)} />
                <span><strong>{selectedProduct.name}</strong><small>{assigned ? "This design is available on this Brand garment." : "Assign this design to begin visual placement."}</small></span>
              </label>

              {assigned && (
                <>
                  <div className="contrast-row">
                    {selectedProduct.configuration.colors.map((item: any) => {
                      const current = contrastOverrides[selectedProduct.id]?.[item.id] || item.contrastMode || "auto";
                      return <button key={item.id} onClick={() => cycleContrast(selectedProduct.id, item)}><i style={{ background: item.hex }} /><span>{item.name}</span><b>{current === "auto" ? `Auto · ${garmentContrast(item)}` : current}</b></button>;
                    })}
                  </div>

                  <label className="placement-toggle">
                    <input type="checkbox" checked={Boolean(locked)} onChange={(event) => togglePlacement(event.target.checked)} />
                    <span><strong>{side === "front" ? "Front" : "Back"} · {printSize === "heart" ? "Heart Size" : "Full Size"}</strong><small>Enable this customer choice and set its exact visual placement.</small></span>
                  </label>

                  {locked && (
                    <div className="placement-settings">
                      <label><span>Decoration</span><select value={locked.decorationMethod} onChange={(event) => patchPlacement({ decorationMethod: event.target.value })}>{selectedProduct.configuration.customization.decorationMethods.map((item) => <option key={item}>{item}</option>)}</select></label>
                      <label><span>Production width</span><input type="number" min=".5" step=".25" value={locked.widthInches} onChange={(event) => applyPhysicalSize("width", Number(event.target.value))} /></label>
                      <label><span>Production height</span><input type="number" min=".5" step=".25" value={locked.heightInches} onChange={(event) => applyPhysicalSize("height", Number(event.target.value))} /></label>
                    </div>
                  )}
                </>
              )}
            </section>
          </aside>
        </div>

        {message && <div className={/saved|uploaded|deleted/i.test(message) ? "success-message" : "error-message"}>{message}</div>}

        <div className="builder-actions">
          {draft.id && <button className="danger-button" disabled={Boolean(busy)} onClick={remove}>Delete design</button>}
          <button className="primary-button" disabled={Boolean(busy)} onClick={save}>{busy === "save" ? "Saving…" : "Save Brand design"}</button>
        </div>
      </section>

      <style jsx>{`
        .brand-builder-shell{display:grid;grid-template-columns:245px minmax(0,1fr);gap:14px;align-items:start}
        .design-library{position:sticky;top:20px;padding:14px;max-height:calc(100vh - 40px);overflow:auto}.library-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.library-head h2{margin:2px 0}.design-library>input{width:100%;box-sizing:border-box}.design-list{display:grid;gap:4px;margin-top:7px}.design-list button{display:grid;grid-template-columns:31px minmax(0,1fr) 7px;gap:7px;align-items:center;padding:8px;border:1px solid transparent;border-radius:8px;background:transparent;color:inherit;text-align:left}.design-list button.active{background:#f5f5f1;border-color:#ddd}.design-list button>span{display:grid;place-items:center;width:31px;height:31px;border-radius:7px;background:#171717;color:#fff;font-size:7px;font-weight:850}.design-list strong{display:block;font-size:9px}.design-list small{display:block;color:#777;font-size:7px}.design-list i{width:7px;height:7px;border-radius:99px;background:#bbb}.design-list i.live{background:#34a064}
        .design-workspace{display:grid;gap:11px;min-width:0}.builder-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px}.builder-head h1{margin:3px 0 5px}.builder-head p{margin:0;color:#777;max-width:700px}.builder-main-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(330px,.85fr);gap:11px;align-items:start}
        .visual-stage-card{overflow:hidden}.stage-toolbar{display:grid;grid-template-columns:minmax(160px,1fr) minmax(120px,.7fr) auto;gap:6px;padding:9px;border-bottom:1px solid #eee}.stage-toolbar select{min-width:0}.stage-tabs{display:flex;gap:3px}.stage-tabs button{padding:6px 8px;border:0;border-radius:7px;background:#f1f1ed;font-size:8px}.stage-tabs button.active{background:#171717;color:#fff}.stage-tabs button.size{margin-left:2px}.stage-status{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#eee;border-top:1px solid #eee}.stage-status>div{padding:9px;background:#fff}.stage-status span{display:block;font-size:7px;color:#777;text-transform:uppercase}.stage-status strong{display:block;margin-top:2px;font-size:8px}
        .builder-controls{display:grid;gap:8px}.control-section{display:grid;gap:8px;padding:14px}.control-section>label{display:grid;gap:4px}.control-section>label>span{font-size:8px;font-weight:750}.art-upload-stack{display:grid;gap:5px}.art-upload{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px;border:1px solid #ddd;border-radius:8px;position:relative}.art-upload.active{background:#fafaf7;border-color:#aaa}.art-upload strong{display:block;font-size:8px}.art-upload small{display:block;color:#777;font-size:7px}.art-upload>span{font-size:7px;font-weight:800}.art-upload input{position:absolute;inset:0;opacity:0;cursor:pointer}
        .assignment-toggle,.placement-toggle{display:flex!important;align-items:flex-start;gap:7px;padding:9px;border-radius:9px;background:#f5f5f1}.assignment-toggle strong,.placement-toggle strong{display:block;font-size:9px}.assignment-toggle small,.placement-toggle small{display:block;color:#777;font-size:7px;line-height:1.4}.contrast-row{display:flex;flex-wrap:wrap;gap:4px}.contrast-row button{display:flex;align-items:center;gap:4px;padding:4px 5px;border:1px solid #ddd;border-radius:7px;background:#fff;color:#333}.contrast-row i{width:10px;height:10px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}.contrast-row span{font-size:7px}.contrast-row b{font-size:6px;color:#777}
        .placement-settings{display:grid;grid-template-columns:1fr 1fr;gap:6px}.placement-settings label{display:grid;gap:3px}.placement-settings span{font-size:7px;font-weight:750;color:#666}.placement-settings input,.placement-settings select{min-width:0;width:100%;box-sizing:border-box}.builder-actions{display:flex;justify-content:flex-end;gap:8px;padding-bottom:22px}.empty-brand-design{padding:24px}.empty-brand-design p{color:#777}
        @media(max-width:1050px){.builder-main-grid{grid-template-columns:1fr}.builder-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.builder-controls .control-section:first-child{grid-column:1/-1}}
        @media(max-width:850px){.brand-builder-shell{grid-template-columns:1fr}.design-library{position:static;max-height:none}.design-list{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}}
        @media(max-width:650px){.builder-head{display:grid}.stage-toolbar{grid-template-columns:1fr}.stage-tabs{flex-wrap:wrap}.stage-status{grid-template-columns:1fr}.builder-controls{grid-template-columns:1fr}.builder-controls .control-section:first-child{grid-column:auto}.placement-settings{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}

function StepTitle({ n, title }: { n: string; title: string }) {
  return <header className="step-title"><span>{n}</span><h2>{title}</h2><style jsx>{`.step-title{display:flex;align-items:center;gap:7px}.step-title span{display:grid;place-items:center;width:21px;height:21px;border-radius:99px;background:#171717;color:#fff;font-size:7px;font-weight:850}.step-title h2{margin:0;font-size:11px}`}</style></header>;
}

function DesignPlacementCanvas({
  garmentUrl,
  artUrl,
  area,
  placement,
  enabled,
  onChange
}: {
  garmentUrl: string;
  artUrl: string;
  area: any;
  placement?: any;
  enabled: boolean;
  onChange: (placement: any) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const drag = useRef<any>(null);

  function point(event: ReactPointerEvent<SVGElement>) {
    const rect = ref.current!.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
  }

  function begin(kind: "move" | "resize", event: ReactPointerEvent<SVGElement>) {
    if (!placement) return;
    event.preventDefault();
    drag.current = { kind, p: point(event), placement: { ...placement } };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: ReactPointerEvent<SVGElement>) {
    if (!drag.current || !placement) return;
    const p = point(event);
    const dx = p.x - drag.current.p.x;
    const dy = p.y - drag.current.p.y;
    const start = drag.current.placement;

    if (drag.current.kind === "move") {
      onChange({
        ...placement,
        x: Math.max(area.x, Math.min(area.x + area.width - start.width, start.x + dx)),
        y: Math.max(area.y, Math.min(area.y + area.height - start.height, start.y + dy))
      });
    } else {
      const maxWidth = area.x + area.width - start.x;
      const maxHeight = area.y + area.height - start.y;
      let width = Math.max(30, Math.min(maxWidth, start.width + dx));
      let height = width * (start.height / start.width);
      if (height > maxHeight) {
        height = maxHeight;
        width = height * (start.width / start.height);
      }
      onChange({ ...placement, width, height });
    }
  }

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
      <rect width={W} height={H} fill="#f5f5f1" />
      {garmentUrl && <image href={garmentUrl} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet" />}
      <rect x={area.x} y={area.y} width={area.width} height={area.height} rx="9" fill="rgba(25,133,84,.06)" stroke="#188456" strokeWidth="2" strokeDasharray="10 8" />
      {!enabled && <text x={400} y={400} textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="800" fill="#555">Enable this placement to position artwork</text>}
      {enabled && artUrl && placement && (
        <>
          <image href={artUrl} x={placement.x} y={placement.y} width={placement.width} height={placement.height} onPointerDown={(event) => begin("move", event)} style={{ cursor: "move" }} />
          <rect x={placement.x} y={placement.y} width={placement.width} height={placement.height} fill="none" stroke="#111" strokeWidth="2" pointerEvents="none" />
          <circle cx={placement.x + placement.width} cy={placement.y + placement.height} r="14" fill="#111" onPointerDown={(event) => begin("resize", event)} style={{ cursor: "nwse-resize" }} />
        </>
      )}
      {enabled && !artUrl && <text x={400} y={400} textAnchor="middle" dominantBaseline="middle" fontSize="20" fontWeight="800" fill="#555">Upload Brand artwork</text>}
    </svg>
  );
}
