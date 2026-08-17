"use client";

import { useMemo, useState } from "react";
import { brandArtworkUrl, chooseBrandVariant } from "@/lib/brand-designs";
import {
  calculateBrandEconomics,
  maxSupplierCostForOptions,
  normalizeBrandProductConfiguration,
  resolvedBrandRetailPrice,
  type BrandMerchProduct,
  type BrandRetailProfile
} from "@/lib/brand-retail";
import type { BrandDesign, BrandStoreProduct } from "@/lib/brand-types";

type Draft = {
  id?: string;
  brandGarmentId: string;
  brandDesignId: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  featured: boolean;
  pricingMode: "manual" | "target_margin";
  retailPrice: number;
  compareAtPrice: number;
  targetMarginPercent: number;
  placementKey: string;
  configuration: ReturnType<typeof normalizeBrandProductConfiguration>;
};

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

function fresh(profile: BrandRetailProfile, garments: BrandStoreProduct[]): Draft {
  const first = garments[0];
  return {
    brandGarmentId: first?.brandGarmentId || "",
    brandDesignId: "",
    name: "",
    slug: "",
    description: "",
    active: false,
    featured: false,
    pricingMode: "manual",
    retailPrice: 0,
    compareAtPrice: 0,
    targetMarginPercent: profile.defaultTargetMarginPercent,
    placementKey: "",
    configuration: normalizeBrandProductConfiguration({}, first)
  };
}

function fromProduct(product: BrandMerchProduct, profile: BrandRetailProfile): Draft {
  return {
    id: product.id,
    brandGarmentId: product.brand_garment_id,
    brandDesignId: product.brand_design_id,
    name: product.name,
    slug: product.slug,
    description: product.description || "",
    active: product.active,
    featured: product.featured,
    pricingMode: product.pricing_mode,
    retailPrice: Number(product.retail_price || 0),
    compareAtPrice: Number(product.compare_at_price || 0),
    targetMarginPercent: Number(product.target_margin_percent ?? profile.defaultTargetMarginPercent),
    placementKey: product.placement_key,
    configuration: product.configuration
  };
}

export default function BrandProductsManager({
  initialProducts,
  garments,
  designs,
  retailProfile
}: {
  initialProducts: BrandMerchProduct[];
  garments: BrandStoreProduct[];
  designs: BrandDesign[];
  retailProfile: BrandRetailProfile;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [draft, setDraft] = useState<Draft>(initialProducts[0] ? fromProduct(initialProducts[0], retailProfile) : fresh(retailProfile, garments));
  const [saved, setSaved] = useState(initialProducts[0] ? JSON.stringify(fromProduct(initialProducts[0], retailProfile)) : "");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const garment = garments.find((item) => item.brandGarmentId === draft.brandGarmentId) || garments[0];
  const sourceProductId = garment?.id || "";
  const compatibleDesigns = designs.filter((design) => design.productIds.includes(sourceProductId));
  const design = compatibleDesigns.find((item) => item.id === draft.brandDesignId);
  const rule = design?.productRules.find((item) => item.productId === sourceProductId);
  const placements = Object.entries(rule?.placements || {}).filter(([, value]) => value.enabled);
  const placement = rule?.placements?.[draft.placementKey];

  const enabledColors = garment?.configuration.colors.filter((item) => draft.configuration.colorIds.includes(item.id)) || [];
  const previewColor = enabledColors[0] || garment?.configuration.colors[0];
  const variant = design ? chooseBrandVariant(design.variants, previewColor as any) : null;
  const garmentImage = placement?.side === "back"
    ? previewColor?.backImageUrl || garment?.configuration.mockupImageUrl
    : previewColor?.frontImageUrl || garment?.configuration.mockupImageUrl;

  const supplierCost = garment ? maxSupplierCostForOptions(garment, draft.configuration.colorIds, draft.configuration.sizes) : 0;
  const recommended = placement
    ? resolvedBrandRetailPrice({
        profile: retailProfile,
        pricingMode: "target_margin",
        manualRetailPrice: draft.retailPrice,
        targetMarginPercent: draft.targetMarginPercent,
        supplierCost,
        placement,
        inkColors: draft.configuration.inkColors,
        stitchEstimate: draft.configuration.stitchEstimate,
        productionCostOverride: draft.configuration.productionCostOverride
      })
    : 0;

  const resolvedRetail = placement
    ? resolvedBrandRetailPrice({
        profile: retailProfile,
        pricingMode: draft.pricingMode,
        manualRetailPrice: draft.retailPrice,
        targetMarginPercent: draft.targetMarginPercent,
        supplierCost,
        placement,
        inkColors: draft.configuration.inkColors,
        stitchEstimate: draft.configuration.stitchEstimate,
        productionCostOverride: draft.configuration.productionCostOverride
      })
    : 0;

  const economics = placement
    ? calculateBrandEconomics({
        profile: retailProfile,
        supplierCost,
        placement,
        retailPrice: resolvedRetail,
        inkColors: draft.configuration.inkColors,
        stitchEstimate: draft.configuration.stitchEstimate,
        productionCostOverride: draft.configuration.productionCostOverride
      })
    : null;

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    return products.filter((item) => !q || `${item.name} ${item.description || ""}`.toLowerCase().includes(q));
  }, [products, query]);

  const dirty = JSON.stringify(draft) !== saved;

  function choose(product: BrandMerchProduct) {
    if (dirty && !window.confirm("You have unsaved Brand product changes. Switch without saving?")) return;
    const next = fromProduct(product, retailProfile);
    setDraft(next);
    setSaved(JSON.stringify(next));
    setMessage("");
  }

  function chooseGarment(brandGarmentId: string) {
    const nextGarment = garments.find((item) => item.brandGarmentId === brandGarmentId);
    setDraft((current) => ({
      ...current,
      brandGarmentId,
      brandDesignId: "",
      placementKey: "",
      configuration: normalizeBrandProductConfiguration({}, nextGarment)
    }));
  }

  function chooseDesign(brandDesignId: string) {
    const nextDesign = designs.find((item) => item.id === brandDesignId);
    const nextRule = nextDesign?.productRules.find((item) => item.productId === sourceProductId);
    const firstPlacement = Object.entries(nextRule?.placements || {}).find(([, value]) => value.enabled)?.[0] || "";
    setDraft((current) => ({ ...current, brandDesignId, placementKey: firstPlacement }));
  }

  async function save() {
    if (!garment || !design || !placement) return setMessage("Choose a Brand garment, approved design, and placement.");
    if (!draft.name.trim()) return setMessage("Enter a product name.");
    if (!draft.configuration.colorIds.length || !draft.configuration.sizes.length) return setMessage("Choose at least one color and size.");

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/brand-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          brandGarmentId: garment.brandGarmentId,
          brandDesignId: design.id,
          name: draft.name,
          slug: draft.slug,
          description: draft.description,
          active: draft.active,
          featured: draft.featured,
          pricingMode: draft.pricingMode,
          retailPrice: draft.retailPrice,
          compareAtPrice: draft.compareAtPrice,
          targetMarginPercent: draft.targetMarginPercent,
          placementKey: draft.placementKey,
          configuration: draft.configuration
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Brand product.");

      const savedProduct = data.product as BrandMerchProduct;
      const next = fromProduct(savedProduct, retailProfile);
      setProducts((current) => draft.id
        ? current.map((item) => item.id === savedProduct.id ? savedProduct : item)
        : [...current, savedProduct]);
      setDraft(next);
      setSaved(JSON.stringify(next));
      setMessage("Brand product saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save Brand product.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Delete ${draft.name}?`)) return;
    setBusy(true);

    const response = await fetch(`/api/admin/brand-products?id=${encodeURIComponent(draft.id)}`, { method: "DELETE" });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) return setMessage(data.error || "Unable to delete product.");

    const remaining = products.filter((item) => item.id !== draft.id);
    setProducts(remaining);
    const next = remaining[0] ? fromProduct(remaining[0], retailProfile) : fresh(retailProfile, garments);
    setDraft(next);
    setSaved(remaining[0] ? JSON.stringify(next) : "");
    setMessage("Brand product deleted.");
  }

  if (!garments.length) {
    return <section className="admin-card brand-product-empty"><h2>Add a Brand garment first</h2><p>Finished retail products are built from the Brand garment library, not the Print Shop catalog.</p><a className="primary-button" href="/dashboard/brand-garments">Brand Garments</a></section>;
  }

  return (
    <div className="brand-product-shell">
      <aside className="admin-card brand-product-library">
        <div className="library-head">
          <div><p className="eyebrow">MERCH PRODUCTS</p><h2>Products</h2></div>
          <button className="secondary-button compact" onClick={() => { const next = fresh(retailProfile, garments); setDraft(next); setSaved(""); setMessage(""); }}>New</button>
        </div>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
        <div className="product-list">
          {visible.map((item) => (
            <button key={item.id} className={draft.id === item.id ? "active" : ""} onClick={() => choose(item)}>
              <span>{item.name.slice(0, 2).toUpperCase()}</span>
              <div><strong>{item.name}</strong><small>${Number(item.retail_price).toFixed(2)} · {item.active ? "Live" : "Draft"}</small></div>
            </button>
          ))}
          {!visible.length && <p>No finished Brand products yet.</p>}
        </div>
      </aside>

      <section className="brand-product-editor">
        <header className="admin-card brand-product-head">
          <div>
            <p className="eyebrow">RETAIL PRODUCT BUILDER</p>
            <h1>{draft.id ? draft.name : "New Brand product"}</h1>
            <p>Turn an approved Brand garment and design into a sellable retail product with its own price and margin.</p>
          </div>
          <label className="modern-switch">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            <span /><b>{draft.active ? "Live" : "Draft"}</b>
          </label>
        </header>

        <div className="brand-product-workspace">
          <div className="product-config-stack">
            <EditorSection number="1" title="Product identity" text="This is what customers see in the Brand store.">
              <div className="form-grid">
                <label><span>Product name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Panther Heavyweight Tee" /></label>
                <label><span>Product URL</span><input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder="panther-heavyweight-tee" /></label>
                <label className="wide"><span>Description</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
                <label className="inline-check"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /><span>Featured product</span></label>
              </div>
            </EditorSection>

            <EditorSection number="2" title="Garment" text="Choose from the Brand garment library—not Print Shop products.">
              <div className="choice-grid">
                {garments.map((item) => (
                  <button key={item.brandGarmentId} type="button" className={garment?.brandGarmentId === item.brandGarmentId ? "active" : ""} onClick={() => chooseGarment(item.brandGarmentId)}>
                    <strong>{item.name}</strong><small>{item.configuration.customization.category} · {item.configuration.colors.length} colors</small>
                  </button>
                ))}
              </div>
            </EditorSection>

            <EditorSection number="3" title="Approved design" text="Only designs visually approved for this Brand garment appear here.">
              <div className="design-choice-grid">
                {compatibleDesigns.map((item) => {
                  const thumbVariant = chooseBrandVariant(item.variants, garment?.configuration.colors[0] as any);
                  return (
                    <button key={item.id} type="button" className={design?.id === item.id ? "active" : ""} onClick={() => chooseDesign(item.id)}>
                      <div>{thumbVariant && <img src={brandArtworkUrl(thumbVariant.id)} alt="" />}</div>
                      <strong>{item.name}</strong>
                    </button>
                  );
                })}
                {!compatibleDesigns.length && <div className="inline-empty">No approved designs for this garment. <a href="/dashboard/designs">Open Design Studio</a>.</div>}
              </div>
            </EditorSection>

            {design && (
              <EditorSection number="4" title="Locked placement" text="Choose one of the placements already approved in Visual Design Studio.">
                <div className="placement-choice-grid">
                  {placements.map(([key, item]) => (
                    <button key={key} type="button" className={draft.placementKey === key ? "active" : ""} onClick={() => setDraft({ ...draft, placementKey: key })}>
                      <strong>{item.side === "front" ? "Front" : "Back"} · {item.printSize === "heart" ? "Heart" : "Full"}</strong>
                      <small>{item.decorationMethod} · {item.widthInches}" × {item.heightInches}"</small>
                    </button>
                  ))}
                </div>
              </EditorSection>
            )}

            {garment && (
              <EditorSection number="5" title="Customer options" text="Decide which Brand garment colors and sizes belong to this finished product.">
                <div className="option-split">
                  <div>
                    <h3>Colors</h3>
                    <div className="color-options">
                      {garment.configuration.colors.map((item) => (
                        <label key={item.id} className={draft.configuration.colorIds.includes(item.id) ? "active" : ""}>
                          <input type="checkbox" checked={draft.configuration.colorIds.includes(item.id)} onChange={(event) => setDraft((current) => ({ ...current, configuration: { ...current.configuration, colorIds: event.target.checked ? [...new Set([...current.configuration.colorIds, item.id])] : current.configuration.colorIds.filter((id) => id !== item.id) } }))} />
                          <i style={{ background: item.hex }} /><span>{item.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3>Sizes</h3>
                    <div className="size-options">
                      {garment.configuration.sizes.map((item) => (
                        <label key={item} className={draft.configuration.sizes.includes(item) ? "active" : ""}>
                          <input type="checkbox" checked={draft.configuration.sizes.includes(item)} onChange={(event) => setDraft((current) => ({ ...current, configuration: { ...current.configuration, sizes: event.target.checked ? [...new Set([...current.configuration.sizes, item])] : current.configuration.sizes.filter((size) => size !== item) } }))} />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {placement?.decorationMethod.toLowerCase().includes("screen") && (
                  <label className="detail-input"><span>Ink colors used in this design</span><input type="number" min="1" max="12" value={draft.configuration.inkColors} onChange={(event) => setDraft((current) => ({ ...current, configuration: { ...current.configuration, inkColors: Math.max(1, Number(event.target.value) || 1) } }))} /></label>
                )}

                {placement?.decorationMethod.toLowerCase().includes("embroider") && (
                  <label className="detail-input"><span>Estimated stitches</span><input type="number" min="1000" step="500" value={draft.configuration.stitchEstimate} onChange={(event) => setDraft((current) => ({ ...current, configuration: { ...current.configuration, stitchEstimate: Math.max(1000, Number(event.target.value) || 1000) } }))} /></label>
                )}
              </EditorSection>
            )}

            {placement && economics && (
              <EditorSection number="6" title="Retail price & margin" text="Price the finished merchandise like a Brand product, not a custom print job.">
                <div className="pricing-mode">
                  <button type="button" className={draft.pricingMode === "manual" ? "active" : ""} onClick={() => setDraft({ ...draft, pricingMode: "manual" })}><strong>Set retail price</strong><small>You choose the shelf price.</small></button>
                  <button type="button" className={draft.pricingMode === "target_margin" ? "active" : ""} onClick={() => setDraft({ ...draft, pricingMode: "target_margin" })}><strong>Target margin</strong><small>PrintFlow recommends the retail price.</small></button>
                </div>

                <div className="retail-pricing-grid">
                  {draft.pricingMode === "manual"
                    ? <label><span>Retail price</span><div className="money-field"><i>$</i><input type="number" min="0" step=".01" value={draft.retailPrice || ""} onChange={(event) => setDraft({ ...draft, retailPrice: Math.max(0, Number(event.target.value) || 0) })} /></div></label>
                    : <label><span>Target margin</span><div className="money-field"><input type="number" min="1" max="90" step=".1" value={draft.targetMarginPercent} onChange={(event) => setDraft({ ...draft, targetMarginPercent: Math.max(1, Math.min(90, Number(event.target.value) || 1)) })} /><i>%</i></div></label>}
                  <label><span>Compare-at price <em>optional</em></span><div className="money-field"><i>$</i><input type="number" min="0" step=".01" value={draft.compareAtPrice || ""} onChange={(event) => setDraft({ ...draft, compareAtPrice: Math.max(0, Number(event.target.value) || 0) })} /></div></label>
                  <label><span>Production cost override <em>optional</em></span><div className="money-field"><i>$</i><input type="number" min="0" step=".01" value={draft.configuration.productionCostOverride ?? ""} onChange={(event) => setDraft((current) => ({ ...current, configuration: { ...current.configuration, productionCostOverride: event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0) } }))} /></div></label>
                </div>

                <div className="economics-card">
                  <div><span>Supplier blank</span><b>${economics.supplierCost.toFixed(2)}</b></div>
                  <div><span>Production</span><b>${economics.productionCost.toFixed(2)}</b></div>
                  <div><span>Packaging + fulfillment</span><b>${(economics.packagingCost + economics.fulfillmentCost).toFixed(2)}</b></div>
                  <div><span>Payment reserve</span><b>${economics.paymentReserve.toFixed(2)}</b></div>
                  <div className="cost"><span>Estimated cost</span><b>${economics.totalEstimatedCost.toFixed(2)}</b></div>
                  <div className="retail"><span>Customer price</span><b>${resolvedRetail.toFixed(2)}</b></div>
                  <div className="profit"><span>Gross profit</span><b>${economics.grossProfit.toFixed(2)}</b></div>
                  <div className="margin"><span>Margin</span><b>{economics.marginPercent.toFixed(1)}%</b></div>
                </div>

                {draft.pricingMode === "manual" && <small className="recommended-note">At your default {retailProfile.defaultTargetMarginPercent}% target margin, PrintFlow would recommend approximately <b>${recommended.toFixed(2)}</b>.</small>}
              </EditorSection>
            )}

            {message && <div className={message.includes("saved") || message.includes("deleted") ? "success-message" : "error-message"}>{message}</div>}
          </div>

          <aside className="admin-card retail-product-preview">
            <p className="eyebrow">CUSTOMER VIEW</p>
            <h2>{draft.name || "Brand product"}</h2>
            <div className="product-visual">
              <svg viewBox="0 0 800 800">
                <rect width="800" height="800" fill="#f5f5f1" />
                {garmentImage && <image href={assetUrl(garmentImage)} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet" />}
                {variant && placement && <image href={brandArtworkUrl(variant.id)} x={placement.placement.x} y={placement.placement.y} width={placement.placement.width} height={placement.placement.height} />}
              </svg>
            </div>
            <div className="preview-meta">
              <span>{garment?.name || "Choose garment"}</span>
              <strong>${resolvedRetail.toFixed(2)}</strong>
              {draft.compareAtPrice > resolvedRetail && <del>${draft.compareAtPrice.toFixed(2)}</del>}
            </div>
            <small>The customer sees a finished product. They choose only approved color, size, and quantity.</small>
          </aside>
        </div>

        {dirty && (
          <div className="brand-save-dock">
            <div><strong>Unsaved Brand product</strong><small>This product exists only in the Brand business.</small></div>
            {draft.id && <button className="delete-link" disabled={busy} onClick={remove}>Delete</button>}
            <button className="primary-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save product"}</button>
          </div>
        )}
      </section>

      <style jsx>{`
        .brand-product-shell{display:grid;grid-template-columns:250px minmax(0,1fr);gap:14px;align-items:start}.brand-product-library{position:sticky;top:20px;padding:14px;max-height:calc(100vh - 40px);overflow:auto}.library-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.library-head h2{margin:2px 0}.brand-product-library>input{width:100%;box-sizing:border-box}.product-list{display:grid;gap:4px;margin-top:8px}.product-list>button{display:grid;grid-template-columns:32px minmax(0,1fr);gap:8px;align-items:center;padding:8px;border:1px solid transparent;border-radius:8px;background:transparent;color:inherit;text-align:left}.product-list>button.active{background:#f5f5f1;border-color:#ddd}.product-list>button>span{display:grid;place-items:center;width:32px;height:32px;border-radius:7px;background:#171717;color:#fff;font-size:7px;font-weight:850}.product-list strong,.product-list small{display:block}.product-list strong{font-size:9px}.product-list small{font-size:7px;color:#777}.product-list>p{padding:20px;text-align:center;color:#777;font-size:8px}
        .brand-product-editor{display:grid;gap:12px}.brand-product-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:18px}.brand-product-head h1{margin:3px 0 4px}.brand-product-head p:not(.eyebrow){margin:0;color:#777}
        .brand-product-workspace{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:12px;align-items:start}.product-config-stack{display:grid;gap:10px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.form-grid label{display:grid;gap:5px}.form-grid label>span,.detail-input>span,.retail-pricing-grid label>span{font-size:8px;font-weight:800}.form-grid .wide{grid-column:1/-1}.inline-check{display:flex!important;align-items:center;gap:6px!important}
        .choice-grid,.placement-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.choice-grid button,.placement-choice-grid button{padding:10px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#333;text-align:left}.choice-grid button.active,.placement-choice-grid button.active{border-color:#171717;box-shadow:inset 0 0 0 1px #171717}.choice-grid strong,.placement-choice-grid strong{display:block;font-size:9px}.choice-grid small,.placement-choice-grid small{display:block;margin-top:3px;color:#777;font-size:7px}
        .design-choice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.design-choice-grid button{padding:6px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#333;text-align:left}.design-choice-grid button.active{border-color:#171717;box-shadow:inset 0 0 0 1px #171717}.design-choice-grid button>div{display:grid;place-items:center;height:86px;border-radius:6px;background:#f5f5f1}.design-choice-grid img{max-width:75%;max-height:75%;object-fit:contain}.design-choice-grid strong{display:block;margin-top:5px;font-size:8px}.inline-empty{grid-column:1/-1;padding:12px;border-radius:8px;background:#f5f5f1;color:#777;font-size:8px}
        .option-split{display:grid;grid-template-columns:1fr 1fr;gap:10px}.option-split h3{margin:0 0 7px;font-size:10px}.color-options,.size-options{display:flex;flex-wrap:wrap;gap:5px}.color-options label,.size-options label{display:flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #ddd;border-radius:7px;font-size:8px}.color-options label.active,.size-options label.active{border-color:#171717;background:#f5f5f1}.color-options i{width:12px;height:12px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}.color-options input,.size-options input{display:none}.detail-input{display:grid;gap:5px;max-width:220px;margin-top:10px}
        .pricing-mode{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}.pricing-mode button{padding:10px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#333;text-align:left}.pricing-mode button.active{border-color:#171717;background:#171717;color:#fff}.pricing-mode strong,.pricing-mode small{display:block}.pricing-mode strong{font-size:9px}.pricing-mode small{margin-top:3px;font-size:7px;opacity:.7}.retail-pricing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.retail-pricing-grid label{display:grid;gap:5px}.retail-pricing-grid em{font-style:normal;color:#888}.money-field{display:grid;grid-template-columns:auto minmax(0,1fr)}.money-field:has(input + i){grid-template-columns:minmax(0,1fr) auto}.money-field i{display:grid;place-items:center;padding:0 9px;border:1px solid #ddd;background:#f1f1ed;font-style:normal;font-size:8px}.economics-card{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}.economics-card>div{padding:9px;border-radius:8px;background:#f5f5f1}.economics-card span,.economics-card b{display:block}.economics-card span{font-size:7px;color:#777}.economics-card b{margin-top:3px;font-size:11px}.economics-card .retail{background:#171717;color:#fff}.economics-card .retail span{color:#aaa}.economics-card .profit,.economics-card .margin{background:#edf7f0;color:#26774b}.recommended-note{display:block;margin-top:8px;color:#777;font-size:8px}
        .retail-product-preview{position:sticky;top:20px;padding:16px}.retail-product-preview>h2{margin:3px 0 10px}.product-visual{overflow:hidden;border-radius:12px;background:#f5f5f1}.product-visual svg{display:block;width:100%}.preview-meta{display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:end;padding:10px 2px}.preview-meta span{font-size:8px;color:#777}.preview-meta strong{font-size:20px}.preview-meta del{grid-column:2;font-size:8px;color:#888}.retail-product-preview>small{display:block;color:#777;font-size:7px;line-height:1.4}
        .brand-save-dock{position:fixed;right:28px;top:18px;z-index:95;display:flex;align-items:center;gap:10px;padding:9px 10px 9px 13px;border-radius:12px;background:#171717;color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.2)}.brand-save-dock strong,.brand-save-dock small{display:block}.brand-save-dock strong{font-size:9px}.brand-save-dock small{font-size:7px;color:#aaa}.delete-link{border:0;background:transparent;color:#ff9e9e;font-size:8px}
        .brand-product-empty{display:grid;justify-items:start;gap:8px;max-width:650px;padding:30px}.brand-product-empty h2,.brand-product-empty p{margin:0}.brand-product-empty p{color:#777}
        @media(max-width:1050px){.brand-product-workspace{grid-template-columns:1fr}.retail-product-preview{position:static;max-width:500px}.economics-card{grid-template-columns:1fr 1fr}}
        @media(max-width:900px){.brand-product-shell{grid-template-columns:1fr}.brand-product-library{position:static;max-height:none}.product-list{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}}
        @media(max-width:650px){.form-grid,.choice-grid,.placement-choice-grid,.option-split,.pricing-mode,.retail-pricing-grid,.design-choice-grid{grid-template-columns:1fr}.form-grid .wide{grid-column:auto}.brand-save-dock{left:10px;right:10px;top:auto;bottom:10px;justify-content:space-between}}
      `}</style>
    </div>
  );
}

function EditorSection({ number, title, text, children }: { number: string; title: string; text: string; children: React.ReactNode }) {
  return <section className="admin-card product-editor-section"><header><span>{number}</span><div><h2>{title}</h2><p>{text}</p></div></header>{children}<style jsx>{`.product-editor-section{padding:16px}.product-editor-section>header{display:flex;gap:9px;align-items:flex-start;margin-bottom:13px}.product-editor-section>header>span{display:grid;place-items:center;width:25px;height:25px;flex:0 0 25px;border-radius:99px;background:#171717;color:#fff;font-size:8px;font-weight:850}.product-editor-section h2{margin:0 0 2px;font-size:14px}.product-editor-section p{margin:0;color:#777;font-size:8px}`}</style></section>;
}
