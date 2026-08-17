"use client";

import { createClient } from "@supabase/supabase-js";
import { useMemo, useState } from "react";
import { brandArtworkUrl, garmentContrast } from "@/lib/brand-designs";
import type { CatalogProduct, DesignSide, PrintSize } from "@/lib/types";
import type { BrandDesign, BrandDesignCategory } from "@/lib/brand-types";

type PlacementDraft = {
  side: DesignSide;
  placement_type: PrintSize;
  active: boolean;
  decoration_method: string;
  width_inches: number;
  height_inches: number;
  surcharge: number;
  configuration: {
    alignX: "left" | "center" | "right";
    alignY: "top" | "center" | "bottom";
    scalePercent: number;
  };
};

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
  minimumQuantity: number;
  productIds: string[];
  variants: VariantDraft[];
  placements: PlacementDraft[];
};

const BASE: PlacementDraft[] = [
  { side: "front", placement_type: "heart", active: false, decoration_method: "Screen Print", width_inches: 4, height_inches: 4, surcharge: 0, configuration: { alignX: "center", alignY: "top", scalePercent: 90 } },
  { side: "front", placement_type: "full", active: true, decoration_method: "Screen Print", width_inches: 11, height_inches: 14, surcharge: 0, configuration: { alignX: "center", alignY: "center", scalePercent: 90 } },
  { side: "back", placement_type: "heart", active: false, decoration_method: "Screen Print", width_inches: 4, height_inches: 4, surcharge: 0, configuration: { alignX: "center", alignY: "top", scalePercent: 90 } },
  { side: "back", placement_type: "full", active: false, decoration_method: "Screen Print", width_inches: 11, height_inches: 14, surcharge: 0, configuration: { alignX: "center", alignY: "center", scalePercent: 90 } }
];

function fresh(): Draft {
  return {
    name: "",
    description: "",
    categoryId: "",
    newCategory: "",
    active: true,
    featured: false,
    minimumQuantity: 1,
    productIds: [],
    variants: [
      { variant_type: "light", artwork_path: "", active: true },
      { variant_type: "dark", artwork_path: "", active: true },
      { variant_type: "universal", artwork_path: "", active: true }
    ],
    placements: BASE.map((item) => ({ ...item, configuration: { ...item.configuration } }))
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
    minimumQuantity: Math.max(1, Number(design.metadata?.minimumQuantity || 1)),
    productIds: design.productIds || [],
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
    placements: BASE.map((base) => {
      const placement = design.placements.find((item) => item.side === base.side && item.placement_type === base.placement_type);
      return placement
        ? {
            ...base,
            active: placement.active,
            decoration_method: placement.decoration_method || "Screen Print",
            width_inches: Number(placement.width_inches || base.width_inches),
            height_inches: Number(placement.height_inches || base.height_inches),
            surcharge: Number(placement.surcharge || 0),
            configuration: { ...base.configuration, ...(placement.configuration || {}) }
          }
        : { ...base, configuration: { ...base.configuration } };
    })
  };
}

export default function BrandDesignManager({
  initialDesigns,
  categories,
  products
}: {
  initialDesigns: BrandDesign[];
  categories: BrandDesignCategory[];
  products: CatalogProduct[];
}) {
  const [designs, setDesigns] = useState(initialDesigns);
  const [draft, setDraft] = useState<Draft>(initialDesigns[0] ? fromDesign(initialDesigns[0]) : fresh());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [contrast, setContrast] = useState<Record<string, Record<string, "auto" | "light" | "dark">>>({});

  const visible = useMemo(
    () => designs.filter((item) => `${item.name} ${item.description || ""}`.toLowerCase().includes(query.toLowerCase())),
    [designs, query]
  );

  function patchPlacement(index: number, patch: Partial<PlacementDraft>) {
    setDraft((current) => ({
      ...current,
      placements: current.placements.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    }));
  }

  function patchVariant(type: VariantDraft["variant_type"], patch: Partial<VariantDraft>) {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((item) => item.variant_type === type ? { ...item, ...patch } : item)
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

      patchVariant(type, {
        artwork_path: prepared.path,
        original_filename: file.name,
        mime_type: prepared.contentType,
        active: true
      });

      setMessage("Artwork uploaded. Save the design to publish it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload artwork.");
    } finally {
      setBusy("");
    }
  }

  function cycleContrast(productId: string, color: any) {
    const current = contrast[productId]?.[color.id] || color.contrastMode || "auto";
    const next = current === "auto" ? "light" : current === "light" ? "dark" : "auto";
    setContrast((all) => ({
      ...all,
      [productId]: { ...(all[productId] || {}), [color.id]: next }
    }));
  }

  async function save() {
    if (!draft.name.trim()) return setMessage("Enter a design name.");
    if (!draft.variants.some((item) => item.artwork_path)) return setMessage("Upload at least one artwork variant.");
    if (!draft.productIds.length) return setMessage("Choose at least one compatible garment.");
    if (!draft.placements.some((item) => item.active)) return setMessage("Enable at least one print placement.");

    setBusy("save");
    setMessage("");

    try {
      const contrastUpdates = Object.entries(contrast).map(([productId, values]) => ({
        productId,
        colors: Object.entries(values).map(([id, contrastMode]) => ({ id, contrastMode }))
      }));

      const response = await fetch("/api/admin/brand-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design: { ...draft, contrastUpdates } })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save design.");

      setMessage("Design saved and published to the Brand storefront.");
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save design.");
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
  }

  return (
    <div className="brand-design-shell">
      <aside className="brand-library admin-card">
        <div className="brand-library-head">
          <div><p className="eyebrow">DESIGNS</p><h2>Library</h2></div>
          <button className="secondary-button compact" onClick={() => setDraft(fresh())}>New</button>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search designs" />
        <div className="brand-library-list">
          {visible.map((design) => (
            <button key={design.id} className={draft.id === design.id ? "active" : ""} onClick={() => setDraft(fromDesign(design))}>
              <span>{design.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{design.name}</strong>
                <small>{design.productIds.length} garments · {design.placements.length} placements</small>
              </div>
              <i className={design.active ? "live" : ""} />
            </button>
          ))}
          {!visible.length && <p>No designs yet.</p>}
        </div>
      </aside>

      <section className="brand-editor">
        <header className="admin-card brand-editor-head">
          <div>
            <p className="eyebrow">BRAND STUDIO</p>
            <h1>{draft.id ? draft.name : "New design"}</h1>
            <p>One reusable design with production-safe artwork, approved garments and locked placement.</p>
          </div>
          <label className="modern-switch">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            <span /><b>{draft.active ? "Live" : "Hidden"}</b>
          </label>
        </header>

        <EditorSection number="1" title="Design details" text="Customer-facing information and retail quantity rules.">
          <div className="brand-form-grid">
            <label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>
              <span>Category</span>
              <select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value, newCategory: "" })}>
                <option value="">Uncategorized</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label><span>New category <em>optional</em></span><input value={draft.newCategory} onChange={(event) => setDraft({ ...draft, newCategory: event.target.value })} placeholder="Summer Drop" /></label>
            <label><span>Minimum customer quantity</span><input type="number" min="1" value={draft.minimumQuantity} onChange={(event) => setDraft({ ...draft, minimumQuantity: Math.max(1, Number(event.target.value) || 1) })} /></label>
            <label className="wide"><span>Description</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <label className="inline-check"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /><span>Feature this design</span></label>
          </div>
        </EditorSection>

        <EditorSection number="2" title="Artwork variants" text="PrintFlow automatically chooses the correct version for the selected garment color.">
          <div className="variant-grid">
            {(["light", "dark", "universal"] as const).map((type) => {
              const variant = draft.variants.find((item) => item.variant_type === type)!;
              return (
                <article key={type}>
                  <div className={`variant-preview ${type}`}>
                    {variant.id ? <img src={brandArtworkUrl(variant.id)} alt="" /> : <span>{variant.artwork_path ? "Uploaded" : "No artwork"}</span>}
                  </div>
                  <div>
                    <strong>{type === "light" ? "Light garments" : type === "dark" ? "Dark garments" : "Universal fallback"}</strong>
                    <small>{variant.original_filename || "PNG, JPG, WEBP or SVG"}</small>
                  </div>
                  <label className="upload-outline">
                    {busy === `upload-${type}` ? "Uploading…" : variant.artwork_path ? "Replace artwork" : "Upload artwork"}
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.svg"
                      disabled={Boolean(busy)}
                      onChange={(event) => {
                        const input = event.currentTarget;
                        void upload(type, input.files?.[0]).finally(() => { input.value = ""; });
                      }}
                    />
                  </label>
                </article>
              );
            })}
          </div>
        </EditorSection>

        <EditorSection number="3" title="Compatible garments" text="Only selected garments can use this design. Click a color chip to override automatic light/dark classification.">
          <div className="brand-product-list">
            {products.map((product) => {
              const selected = draft.productIds.includes(product.id);
              return (
                <article key={product.id} className={selected ? "selected" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        productIds: event.target.checked
                          ? [...new Set([...current.productIds, product.id])]
                          : current.productIds.filter((id) => id !== product.id)
                      }))}
                    />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.configuration.customization.category} · {product.configuration.colors.filter((color) => color.active !== false).length} colors</small>
                    </span>
                  </label>

                  {selected && (
                    <div className="color-contrast-row">
                      {product.configuration.colors.filter((color) => color.active !== false).map((color: any) => {
                        const override = contrast[product.id]?.[color.id] || color.contrastMode || "auto";
                        const effective = override === "auto" ? garmentContrast(color) : override;
                        return (
                          <button type="button" key={color.id} onClick={() => cycleContrast(product.id, color)}>
                            <i style={{ background: color.hex }} />
                            <span>{color.name}</span>
                            <b>{override === "auto" ? `Auto · ${effective}` : override}</b>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </EditorSection>

        <EditorSection number="4" title="Locked placements" text="Customers can choose only enabled placements; they cannot freely move brand artwork.">
          <div className="placement-grid">
            {draft.placements.map((placement, index) => (
              <article key={`${placement.side}-${placement.placement_type}`} className={placement.active ? "active" : ""}>
                <label className="placement-toggle">
                  <input type="checkbox" checked={placement.active} onChange={(event) => patchPlacement(index, { active: event.target.checked })} />
                  <span>
                    <strong>{placement.side === "front" ? "Front" : "Back"} · {placement.placement_type === "heart" ? "Heart Size" : "Full Size"}</strong>
                    <small>{placement.active ? "Customer can select this" : "Disabled"}</small>
                  </span>
                </label>

                {placement.active && (
                  <div className="placement-fields">
                    <label>
                      <span>Decoration</span>
                      <select value={placement.decoration_method} onChange={(event) => patchPlacement(index, { decoration_method: event.target.value })}>
                        <option>Screen Print</option><option>DTF</option><option>Embroidery</option>
                      </select>
                    </label>
                    <label><span>Width (in)</span><input type="number" min="1" step=".25" value={placement.width_inches} onChange={(event) => patchPlacement(index, { width_inches: Number(event.target.value) })} /></label>
                    <label><span>Height (in)</span><input type="number" min="1" step=".25" value={placement.height_inches} onChange={(event) => patchPlacement(index, { height_inches: Number(event.target.value) })} /></label>
                    <label>
                      <span>Horizontal</span>
                      <select value={placement.configuration.alignX} onChange={(event) => patchPlacement(index, { configuration: { ...placement.configuration, alignX: event.target.value as any } })}>
                        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                      </select>
                    </label>
                    <label>
                      <span>Vertical</span>
                      <select value={placement.configuration.alignY} onChange={(event) => patchPlacement(index, { configuration: { ...placement.configuration, alignY: event.target.value as any } })}>
                        <option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option>
                      </select>
                    </label>
                    <label><span>Visual scale · {placement.configuration.scalePercent}%</span><input type="range" min="20" max="100" value={placement.configuration.scalePercent} onChange={(event) => patchPlacement(index, { configuration: { ...placement.configuration, scalePercent: Number(event.target.value) } })} /></label>
                    <label><span>Design surcharge / item</span><input type="number" min="0" step=".25" value={placement.surcharge} onChange={(event) => patchPlacement(index, { surcharge: Number(event.target.value) })} /></label>
                  </div>
                )}
              </article>
            ))}
          </div>
        </EditorSection>

        {message && <div className={/saved|uploaded|published/i.test(message) ? "success-message" : "error-message"}>{message}</div>}

        <div className="brand-actions">
          {draft.id && <button className="danger-button" disabled={Boolean(busy)} onClick={remove}>Delete design</button>}
          <button className="primary-button" disabled={Boolean(busy)} onClick={save}>{busy === "save" ? "Saving…" : "Save design"}</button>
        </div>
      </section>

      <style jsx>{`
        .brand-design-shell{display:grid;grid-template-columns:270px minmax(0,1fr);gap:16px;align-items:start}
        .brand-library{position:sticky;top:20px;padding:15px;max-height:calc(100vh - 40px);overflow:auto}
        .brand-library-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
        .brand-library-head h2{margin:2px 0}
        .brand-library>input{width:100%;box-sizing:border-box}
        .brand-library-list{display:grid;gap:5px;margin-top:8px}
        .brand-library-list button{display:grid;grid-template-columns:32px minmax(0,1fr) 7px;gap:8px;align-items:center;padding:9px;border:1px solid transparent;border-radius:9px;background:transparent;text-align:left;color:inherit}
        .brand-library-list button.active{border-color:#ddd;background:#f5f5f1}
        .brand-library-list button>span{display:grid;place-items:center;width:32px;height:32px;border-radius:7px;background:#171717;color:#fff;font-size:8px;font-weight:800}
        .brand-library-list strong{display:block;font-size:10px}
        .brand-library-list small{display:block;color:#777;font-size:8px}
        .brand-library-list i{width:7px;height:7px;border-radius:99px;background:#aaa}
        .brand-library-list i.live{background:#36a064}
        .brand-library-list p{font-size:9px;color:#777;text-align:center;padding:18px}
        .brand-editor{display:grid;gap:12px}
        .brand-editor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px}
        .brand-editor-head h1{margin:3px 0 5px}
        .brand-editor-head p{margin:0;color:#707070;max-width:680px}
        .brand-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .brand-form-grid label{display:grid;gap:5px}
        .brand-form-grid span{font-size:9px;font-weight:750}
        .brand-form-grid em{font-style:normal;color:#888}
        .brand-form-grid .wide{grid-column:1/-1}
        .inline-check{display:flex!important;align-items:center;gap:7px!important}
        .variant-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
        .variant-grid article{display:grid;gap:9px;padding:11px;border:1px solid #e1e1dc;border-radius:11px}
        .variant-preview{height:140px;display:grid;place-items:center;border-radius:8px;background:#f0f0ec;overflow:hidden}
        .variant-preview.dark{background:#222;color:#fff}
        .variant-preview img{max-width:76%;max-height:76%;object-fit:contain}
        .variant-grid strong{display:block;font-size:10px}
        .variant-grid small{display:block;color:#777;font-size:8px}
        .brand-product-list{display:grid;gap:7px}
        .brand-product-list>article{padding:11px;border:1px solid #e2e2dd;border-radius:10px}
        .brand-product-list>article.selected{border-color:#aaa;background:#fafaf7}
        .brand-product-list>article>label{display:flex;gap:8px;align-items:center}
        .brand-product-list strong{display:block;font-size:10px}
        .brand-product-list small{display:block;color:#777;font-size:8px}
        .color-contrast-row{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;padding-top:9px;border-top:1px solid #e6e6e1}
        .color-contrast-row button{display:flex;align-items:center;gap:5px;padding:5px 6px;border:1px solid #ddd;border-radius:7px;background:#fff;color:#333}
        .color-contrast-row i{width:11px;height:11px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}
        .color-contrast-row span{font-size:8px}
        .color-contrast-row b{font-size:7px;color:#777}
        .placement-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .placement-grid>article{padding:11px;border:1px solid #e2e2dc;border-radius:10px}
        .placement-grid>article.active{border-color:#aaa;background:#fafaf7}
        .placement-toggle{display:flex;align-items:center;gap:7px}
        .placement-toggle strong{display:block;font-size:10px}
        .placement-toggle small{display:block;color:#777;font-size:8px}
        .placement-fields{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px;padding-top:10px;border-top:1px solid #e6e6e1}
        .placement-fields label{display:grid;gap:4px}
        .placement-fields span{font-size:8px;font-weight:750;color:#666}
        .placement-fields input,.placement-fields select{width:100%;min-width:0;box-sizing:border-box}
        .brand-actions{display:flex;justify-content:flex-end;gap:8px;padding:4px 0 22px}
        @media(max-width:980px){.brand-design-shell{grid-template-columns:1fr}.brand-library{position:static;max-height:none}.brand-library-list{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}}
        @media(max-width:700px){.brand-editor-head{display:grid;padding:16px}.brand-form-grid,.variant-grid,.placement-grid,.placement-fields{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}

function EditorSection({ number, title, text, children }: { number: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="admin-card brand-editor-section">
      <header><span>{number}</span><div><h2>{title}</h2><p>{text}</p></div></header>
      {children}
      <style jsx>{`
        .brand-editor-section{padding:20px}
        .brand-editor-section>header{display:flex;gap:10px;align-items:flex-start;margin-bottom:16px}
        .brand-editor-section>header>span{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px;border-radius:99px;background:#171717;color:#fff;font-size:9px;font-weight:800}
        .brand-editor-section h2{margin:0 0 3px;font-size:16px}
        .brand-editor-section p{margin:0;color:#777;font-size:9px}
      `}</style>
    </section>
  );
}
