"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readApiResponse } from "@/lib/client-api-response";

type BrowseStyle = {
  styleId: string;
  brandName: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  colorCount: number;
  sizeCount: number;
  priceMin: number;
  priceMax: number;
};

type DetailStyle = {
  styleId: string;
  name: string;
  description: string;
  brandName: string;
  variants: Array<{
    sku: string;
    skuId: string;
    colorName: string;
    sizeName: string;
    customerPrice: number;
    quantity: number;
    active: boolean;
  }>;
  media: Record<
    string,
    {
      frontImageUrl?: string;
      backImageUrl?: string;
      swatchImageUrl?: string;
      imageChoices?: Array<{ url: string; label: string; classTypeId?: string }>;
    }
  >;
};

type ImageSelection = { frontImageUrl: string; backImageUrl: string };

type ImageChoice = { url: string; label: string; classTypeId?: string };

function choiceKey(choice: ImageChoice) {
  return choice.classTypeId?.trim() || choice.label.trim().toLowerCase().replace(/\s+/g, " ");
}

function choicesForColor(color: DetailStyle["media"][string] | undefined): ImageChoice[] {
  if (!color) return [];
  return [
    ...(color.imageChoices || []),
    ...(color.frontImageUrl ? [{ url: color.frontImageUrl, label: "Front view" }] : []),
    ...(color.backImageUrl ? [{ url: color.backImageUrl, label: "Back view" }] : [])
  ].filter((choice, index, all) => choice.url && all.findIndex((item) => item.url === choice.url) === index);
}

function isBackChoice(choice: ImageChoice) {
  return /back|rear|reverse/i.test(`${choice.label} ${choice.classTypeId || ""}`);
}

const QUICK = ["Gildan", "Port Authority", "New Era", "hoodie", "jacket"];

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);

export default function SanMarCatalogImporter({
  connected = true,
  accountHint,
  importedStyleIds = []
}: {
  connected?: boolean;
  accountHint?: string | null;
  importedStyleIds?: string[];
}) {
  const [category, setCategory] = useState("");
  const [styles, setStyles] = useState<BrowseStyle[]>([]);
  const [selected, setSelected] = useState<BrowseStyle | null>(null);
  const [detail, setDetail] = useState<DetailStyle | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [imageSelections, setImageSelections] = useState<Record<string, ImageSelection>>({});
  const [selectionStep, setSelectionStep] = useState<"colors" | "images">("colors");
  const [setupOpen, setSetupOpen] = useState(false);
  const [frontChoiceKey, setFrontChoiceKey] = useState("");
  const [backChoiceKey, setBackChoiceKey] = useState("");
  const [setupCategory, setSetupCategory] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState(12);
  const [decorationMethods, setDecorationMethods] = useState<string[]>(["Screen Print", "DTF", "Embroidery"]);
  const [printSizes, setPrintSizes] = useState<string[]>(["heart", "full"]);
  const [backEnabled, setBackEnabled] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error" | "info">("info");
  const [exactStyle, setExactStyle] = useState("");

  async function load(options?: {
    append?: boolean;
    search?: string;
    nextCategory?: string;
    nextBrand?: string;
    refresh?: boolean;
  }) {
    if (!connected) return;

    const nextCategory = options?.nextCategory ?? category;
    const append = options?.append === true;

    setBusy(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        category: nextCategory,
        q: options?.search ?? q,
        brand: options?.nextBrand ?? brand,
        offset: String(append ? styles.length : 0),
        limit: "36"
      });

      if (options?.refresh) params.set("refresh", "1");

      const response = await fetch(
        `/api/admin/suppliers/sanmar/styles?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load the live SanMar catalog."
        );
      }

      setCategory(nextCategory);
      setStyles((current) =>
        append ? [...current, ...(data.styles || [])] : data.styles || []
      );
      setBrands(data.brands || []);
      setCategories(data.categories || []);
      setTotal(Number(data.total || 0));
      setHasMore(data.hasMore === true);

      if (!append) {
        setSelected(null);
        setDetail(null);
        setSelectedColors([]);
        setImageSelections({});
        setSelectionStep("colors");
        setSetupOpen(false);
        setDisplayName("");
      }
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the live SanMar catalog."
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (connected) void load({ nextCategory: "", search: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  async function choose(style: BrowseStyle) {
    setSelected(style);
    setDetail(null);
    setSelectedColors([]);
    setImageSelections({});
    setSelectionStep("colors");
    setSetupOpen(false);
    setDisplayName(
      style.title
        .replace(new RegExp(`\\s*${style.styleId}\\s*$`, "i"), "")
        .trim() || `${style.brandName} ${style.styleId}`
    );
    setMessage("");
    setDetailBusy(true);

    try {
      const response = await fetch(
        `/api/admin/suppliers/sanmar/style?style=${encodeURIComponent(
          style.styleId
        )}`,
        { cache: "no-store" }
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Unable to load this SanMar style.");
      }

      const next: DetailStyle = data.style;
      setDetail(next);
      setSelectedColors(
        Array.from(new Set(next.variants.map((item) => item.colorName)))
      );
      setImageSelections(Object.fromEntries(
        Object.entries(next.media || {}).map(([colorName, media]) => [colorName, {
          frontImageUrl: media.frontImageUrl || "",
          backImageUrl: media.backImageUrl || ""
        }])
      ));
      const initialColor = Array.from(new Set(next.variants.map((item) => item.colorName)))[0];
      const initialMedia = initialColor ? next.media?.[initialColor] : undefined;
      const initialChoices = choicesForColor(initialMedia);
      const initialFront = initialChoices.find((choice) => choice.url === initialMedia?.frontImageUrl) || initialChoices.find((choice) => !isBackChoice(choice));
      const initialBack = initialChoices.find((choice) => choice.url === initialMedia?.backImageUrl) || initialChoices.find(isBackChoice);
      setFrontChoiceKey(initialFront ? choiceKey(initialFront) : "");
      setBackChoiceKey(initialBack ? choiceKey(initialBack) : "");
      const inferredHeadwear = /\b(hat|cap|headwear|beanie|visor|bucket hat|trucker|caps)\b/i.test(`${style.category} ${style.title}`);
      setSetupCategory(style.category || "Apparel");
      setMinimumQuantity(inferredHeadwear ? 1 : 12);
      setDecorationMethods(inferredHeadwear ? ["Embroidery"] : ["Screen Print", "DTF", "Embroidery"]);
      setPrintSizes(inferredHeadwear ? ["full"] : ["heart", "full"]);
      setBackEnabled(!inferredHeadwear);
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load this SanMar style."
      );
    } finally {
      setDetailBusy(false);
    }
  }

  async function jumpToExactStyle() {
    const value = exactStyle.trim().toUpperCase();
    if (!value) return;

    const pseudo: BrowseStyle = {
      styleId: value,
      brandName: "SanMar",
      title: value,
      description: "",
      category: category,
      imageUrl: "",
      colorCount: 0,
      sizeCount: 0,
      priceMin: 0,
      priceMax: 0
    };

    await choose(pseudo);
  }

  const colors = useMemo(() => {
    if (!detail) return [];

    const grouped = new Map<string, typeof detail.variants>();

    for (const variant of detail.variants) {
      grouped.set(variant.colorName, [
        ...(grouped.get(variant.colorName) || []),
        variant
      ]);
    }

    return Array.from(grouped.entries())
      .map(([name, rows]) => {
        const prices = rows
          .map((item) => Number(item.customerPrice || 0))
          .filter((value) => value > 0);
        const media = detail.media[name] || {};

        return {
          name,
          frontImageUrl: media.frontImageUrl || "",
          backImageUrl: media.backImageUrl || "",
          swatchImageUrl: media.swatchImageUrl || "",
          imageChoices: media.imageChoices || [],
          sizeCount: new Set(rows.map((item) => item.sizeName)).size,
          sizes: Array.from(new Set(rows.map((item) => item.sizeName))),
          inventory: rows.reduce(
            (sum, item) => sum + Math.max(0, Number(item.quantity || 0)),
            0
          ),
          priceMin: prices.length ? Math.min(...prices) : 0,
          priceMax: prices.length ? Math.max(...prices) : 0
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [detail]);

  const representativeColor = colors.find((color) => selectedColors.includes(color.name)) || colors[0];
  const representativeChoices = representativeColor ? choicesForColor(detail?.media?.[representativeColor.name]) : [];
  const frontChoices = representativeChoices.filter((choice) => !isBackChoice(choice) && !/swatch/i.test(choice.label));
  const backChoices = representativeChoices.filter((choice) => isBackChoice(choice) && !/swatch/i.test(choice.label));

  function applyImageChoice(side: "front" | "back", selectedChoice: ImageChoice) {
    const key = choiceKey(selectedChoice);
    if (side === "front") setFrontChoiceKey(key);
    else setBackChoiceKey(key);
    setImageSelections((current) => {
      const next = { ...current };
      for (const colorName of selectedColors) {
        const media = detail?.media?.[colorName];
        const matching = choicesForColor(media).find((choice) => choiceKey(choice) === key);
        const fallback = side === "front" ? media?.frontImageUrl : media?.backImageUrl;
        next[colorName] = {
          frontImageUrl: side === "front" ? (matching?.url || fallback || "") : (current[colorName]?.frontImageUrl || media?.frontImageUrl || ""),
          backImageUrl: side === "back" ? (matching?.url || fallback || "") : (current[colorName]?.backImageUrl || media?.backImageUrl || "")
        };
      }
      return next;
    });
  }

  function imageSelectionForColor(colorName: string): ImageSelection {
    const media = detail?.media?.[colorName];
    const choices = choicesForColor(media);
    return {
      frontImageUrl: choices.find((choice) => choiceKey(choice) === frontChoiceKey)?.url || media?.frontImageUrl || "",
      backImageUrl: choices.find((choice) => choiceKey(choice) === backChoiceKey)?.url || media?.backImageUrl || ""
    };
  }

  async function importProduct() {
    if (!selected || !detail || !selectedColors.length) return;

    setImportBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/suppliers/sanmar/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: detail.styleId,
          displayName,
          category: selected.category,
          selectedColors,
          imageSelections,
          customization: { category: setupCategory || selected.category, minimumQuantity, decorationMethods, printSizes, backEnabled }
        })
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Unable to add this SanMar product.");
      }

      setMessageType("success");
      setMessage(
        `${data.product.name} was added to Advanced with ${data.colorCount} colors and ${data.variantCount} live size/color variants.`
      );
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to add this SanMar product."
      );
    } finally {
      setImportBusy(false);
    }
  }

  function switchCategory(next: string) {
    setBrand("");
    setQ("");
    void load({ nextCategory: next, nextBrand: "", search: "" });
  }

  if (!connected) {
    return (
      <section className="ae-card sanmar-connect-state">
        <div className="sanmar-wordmark">SANMAR</div>
        <h2>Connect SanMar to browse products.</h2>
        <p>
          Once connected, browse every product type in the shop’s SanMar catalog.
        </p>
        <Link className="ae-button primary" href="/advanced-admin/settings">
          Connect SanMar
        </Link>
      </section>
    );
  }

  if (setupOpen && selected && detail && !detailBusy) {
    const supportedMethods = ["Screen Print", "DTF", "Embroidery", "Heat Transfer", "Sublimation"];
    const selectedSkuCount = detail.variants.filter((item) => selectedColors.includes(item.colorName)).length;
    return (
      <main className="sanmar-setup-page">
        <header className="sanmar-setup-topbar">
          <button type="button" className="sanmar-setup-back" onClick={() => setSetupOpen(false)}>← Back to catalog</button>
          <div><span>PRODUCT SETUP</span><strong>{detail.brandName} · {detail.styleId}</strong></div>
          <button className="ae-button primary" disabled={importBusy || !selectedColors.length} onClick={() => void importProduct()}>{importBusy ? "Adding product…" : "Submit product"}</button>
        </header>
        <div className="sanmar-setup-content">
          <div className="sanmar-setup-heading">
            <div><p className="ae-kicker">SANMAR · ITEM OPTIONS</p><h1>Set up this product</h1><p>Choose the customer-facing details, colors, and product photos before adding it to your catalog.</p></div>
            <div className="sanmar-setup-item"><img src={representativeColor?.frontImageUrl || selected.imageUrl} alt="Selected SanMar item"/><span>{detail.brandName} {detail.styleId}</span></div>
          </div>

          <section className="sanmar-setup-section">
            <header><span>01</span><div><h2>Product details</h2><p>These settings control how the product appears in your store.</p></div></header>
            <div className="sanmar-setup-fields">
              <label><span>Customer-facing product name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={`${detail.brandName} ${detail.styleId}`}/></label>
              <label><span>Product type</span><select value={setupCategory} onChange={(event) => setSetupCategory(event.target.value)}>{Array.from(new Set([setupCategory, ...categories].filter(Boolean))).map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Minimum order quantity</span><input type="number" min={1} value={minimumQuantity} onChange={(event) => setMinimumQuantity(Math.max(1, Number(event.target.value) || 1))}/></label>
            </div>
            <div className="sanmar-methods"><span>Available decoration methods</span><div>{supportedMethods.map((method) => <label key={method} className={decorationMethods.includes(method) ? "selected" : ""}><input type="checkbox" checked={decorationMethods.includes(method)} onChange={(event) => setDecorationMethods((current) => event.target.checked ? [...current, method] : current.filter((item) => item !== method))}/>{method}</label>)}</div></div>
            <div className="sanmar-methods"><span>Print areas and sizes</span><div>{[{id:"heart",label:"Left chest / small"},{id:"full",label:"Full front"}].map((option) => <label key={option.id} className={printSizes.includes(option.id) ? "selected" : ""}><input type="checkbox" checked={printSizes.includes(option.id)} onChange={(event) => setPrintSizes((current) => event.target.checked ? [...current, option.id] : current.filter((item) => item !== option.id))}/>{option.label}</label>)}<label className={backEnabled ? "selected" : ""}><input type="checkbox" checked={backEnabled} onChange={(event) => setBackEnabled(event.target.checked)}/>Offer back decoration</label></div></div>
          </section>

          <section className="sanmar-setup-section">
            <header><span>02</span><div><h2>Colors and sizes</h2><p>Select the colors to offer. Each selected color includes its live available sizes and inventory.</p></div><b>{selectedColors.length} colors · {selectedSkuCount} SKUs</b></header>
            <div className="sanmar-setup-color-actions"><button type="button" onClick={() => setSelectedColors(colors.map((color) => color.name))}>Select all colors</button><button type="button" onClick={() => setSelectedColors([])}>Clear selection</button></div>
            <div className="sanmar-setup-colors">{colors.map((color) => <label key={color.name} className={selectedColors.includes(color.name) ? "selected" : ""}><input type="checkbox" checked={selectedColors.includes(color.name)} onChange={(event) => {const nextColors = event.target.checked ? [...selectedColors, color.name] : selectedColors.filter((name) => name !== color.name); setSelectedColors(nextColors); if (event.target.checked) setImageSelections((current) => ({...current, [color.name]: imageSelectionForColor(color.name)}));}}/><img src={color.swatchImageUrl || color.frontImageUrl} alt=""/><span><strong>{color.name}</strong><small>{color.sizes.join(" · ")}</small><small>{color.inventory.toLocaleString()} units</small></span></label>)}</div>
          </section>

          <section className="sanmar-setup-section">
            <header><span>03</span><div><h2>Storefront product images</h2><p>Pick the front and back views once. PrintFlow matches those views to each selected color automatically.</p></div></header>
            <div className="sanmar-image-auto-note">✓ One selection applies to all {selectedColors.length} selected colors wherever SanMar provides the matching photo view.</div>
            <div className="sanmar-visual-image-selectors">
              {(["front", "back"] as const).map((side) => {
                const choices = side === "front" ? frontChoices : backChoices;
                const activeKey = side === "front" ? frontChoiceKey : backChoiceKey;
                return <div className="sanmar-visual-image-group" key={side}><h3>{side === "front" ? "Front image" : "Back image"}<small>{side === "front" ? "Shown as the main product view" : "Shown as the alternate product view"}</small></h3>{choices.length ? <div className="sanmar-visual-image-grid">{choices.map((choice) => <button type="button" key={`${choiceKey(choice)}:${choice.url}`} className={choiceKey(choice) === activeKey ? "selected" : ""} onClick={() => applyImageChoice(side, choice)}><span className="sanmar-visual-image-preview"><img src={choice.url} alt={`${side} view option: ${choice.label}`}/>{choiceKey(choice) === activeKey && <i>✓</i>}</span><strong>{choice.label}</strong><small>{choiceKey(choice) === activeKey ? `Applied across selected colors` : `Use for all selected colors`}</small></button>)}</div> : <p className="sanmar-no-image-options">No {side} images were supplied for this item.</p>}</div>;
              })}
            </div>
            {representativeColor && <div className="sanmar-image-preview-row"><span>Preview for {representativeColor.name}</span><div>{imageSelections[representativeColor.name]?.frontImageUrl && <img src={imageSelections[representativeColor.name].frontImageUrl} alt="Chosen front view"/>}{imageSelections[representativeColor.name]?.backImageUrl && <img src={imageSelections[representativeColor.name].backImageUrl} alt="Chosen back view"/>}</div></div>}
          </section>

          {message && <div className={`sanmar-message ${messageType}`}><span>{message}</span>{messageType === "success" && <Link href="/advanced-admin/products">View Products →</Link>}</div>}
          <footer className="sanmar-setup-footer"><button type="button" className="ae-button" onClick={() => setSetupOpen(false)}>← Back to catalog</button><span>{selectedColors.length} colors and {selectedSkuCount} size/color variants selected</span><button className="ae-button primary" disabled={importBusy || !selectedColors.length} onClick={() => void importProduct()}>{importBusy ? "Adding product…" : "Submit and add product"}</button></footer>
        </div>
        <style jsx>{`
          .sanmar-setup-page{min-height:100vh;background:#f5f7f9;color:#102033;padding-bottom:50px}.sanmar-setup-topbar{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px;padding:13px max(24px,calc((100vw - 1180px)/2));border-bottom:1px solid #dfe5ea;background:rgba(255,255,255,.96);backdrop-filter:blur(16px)}.sanmar-setup-topbar>div{display:grid;gap:3px;text-align:center}.sanmar-setup-topbar>div span,.sanmar-setup-heading .ae-kicker{font-size:10px;letter-spacing:.1em;font-weight:850;color:#687786}.sanmar-setup-topbar>div strong{font-size:13px}.sanmar-setup-topbar>:last-child{justify-self:end}.sanmar-setup-back{border:0;background:none;color:#274766;font:inherit;font-size:13px;font-weight:750;cursor:pointer}.sanmar-setup-content{width:min(100% - 36px,1080px);margin:0 auto}.sanmar-setup-heading{display:flex;align-items:center;justify-content:space-between;gap:25px;padding:35px 0 25px}.sanmar-setup-heading h1{margin:5px 0;font-size:clamp(28px,4vw,38px);letter-spacing:-.04em}.sanmar-setup-heading p:last-child{margin:0;color:#687786}.sanmar-setup-item{display:flex;align-items:center;gap:10px;min-width:190px;padding:9px;border:1px solid #e0e5e9;border-radius:13px;background:white;font-size:12px;font-weight:750}.sanmar-setup-item img{width:48px;height:48px;border-radius:8px;object-fit:contain;background:#f4f5f6}.sanmar-setup-section{margin:0 0 17px;padding:23px;border:1px solid #e0e5e9;border-radius:17px;background:#fff;box-shadow:0 5px 20px #13253a08}.sanmar-setup-section>header{display:flex;align-items:center;gap:12px;margin-bottom:18px}.sanmar-setup-section>header>span{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:10px;background:#edf2f6;color:#35516c;font-weight:850;font-size:12px}.sanmar-setup-section>header h2,.sanmar-setup-section>header p{margin:0}.sanmar-setup-section>header h2{font-size:17px}.sanmar-setup-section>header p{margin-top:3px;color:#758291;font-size:12px}.sanmar-setup-section>header>b{margin-left:auto;color:#607286;font-size:12px;white-space:nowrap}.sanmar-setup-fields{display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px}.sanmar-setup-fields label{display:grid;gap:6px}.sanmar-setup-fields label>span,.sanmar-methods>span{font-size:11px;font-weight:800;color:#516174}.sanmar-setup-fields input,.sanmar-setup-fields select{width:100%;min-height:42px;padding:0 11px;border:1px solid #dce2e7;border-radius:9px;background:white;color:#14283d;font:inherit;font-size:13px}.sanmar-methods{display:grid;gap:9px;margin-top:16px}.sanmar-methods>div{display:flex;flex-wrap:wrap;gap:8px}.sanmar-methods label{display:flex;align-items:center;gap:7px;padding:9px 11px;border:1px solid #dce2e7;border-radius:999px;color:#526274;font-size:12px;cursor:pointer}.sanmar-methods label.selected{border-color:#183956;background:#eef4f8;color:#173550}.sanmar-setup-color-actions{display:flex;gap:16px;margin:0 0 12px}.sanmar-setup-color-actions button{padding:0;border:0;background:none;color:#234b6d;font-weight:750;font-size:12px;cursor:pointer}.sanmar-setup-colors{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}.sanmar-setup-colors label{display:grid;grid-template-columns:auto 48px 1fr;align-items:center;gap:10px;padding:9px;border:1px solid #e0e5e9;border-radius:11px;cursor:pointer}.sanmar-setup-colors label.selected{border-color:#355a77;box-shadow:inset 0 0 0 1px #355a77;background:#f7fafc}.sanmar-setup-colors input,.sanmar-methods input{accent-color:#183956}.sanmar-setup-colors img{width:48px;height:48px;border-radius:8px;object-fit:contain;background:#f5f6f7}.sanmar-setup-colors label>span{display:grid;gap:3px;min-width:0}.sanmar-setup-colors strong{font-size:12px}.sanmar-setup-colors small{overflow:hidden;color:#768392;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.sanmar-image-auto-note{padding:11px 13px;border-radius:10px;background:#edf7f0;color:#36704a;font-size:12px;font-weight:700}.sanmar-visual-image-selectors{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.sanmar-visual-image-group{min-width:0}.sanmar-visual-image-group h3{display:grid;gap:3px;margin:0 0 9px;font-size:13px}.sanmar-visual-image-group h3 small{color:#7a8794;font-size:10px;font-weight:500}.sanmar-visual-image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:9px}.sanmar-visual-image-grid button{min-width:0;padding:7px;border:1px solid #e0e5e9;border-radius:11px;background:#fff;color:#172b3f;text-align:left;cursor:pointer}.sanmar-visual-image-grid button.selected{border-color:#244c6e;box-shadow:0 0 0 2px #244c6e1e}.sanmar-visual-image-preview{position:relative;display:grid;place-items:center;width:100%;aspect-ratio:1/1;border-radius:8px;background:#f4f5f6;overflow:hidden}.sanmar-visual-image-preview img{width:100%;height:100%;object-fit:contain}.sanmar-visual-image-preview i{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#173b59;color:#fff;font-style:normal;font-size:12px}.sanmar-visual-image-grid strong,.sanmar-visual-image-grid small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sanmar-visual-image-grid strong{margin:7px 1px 3px;font-size:11px}.sanmar-visual-image-grid small{margin:0 1px 2px;color:#788594;font-size:9px}.sanmar-no-image-options{color:#7d8893;font-size:12px}.sanmar-image-preview-row{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-top:15px;padding-top:13px;border-top:1px solid #edf0f2;color:#637386;font-size:11px}.sanmar-image-preview-row>div{display:flex;gap:8px}.sanmar-image-preview-row img{width:62px;height:62px;border:1px solid #e3e7ea;border-radius:8px;object-fit:contain;background:#f6f7f8}.sanmar-setup-footer{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:15px;margin:20px -1px 0;padding:12px 14px;border:1px solid #dfe5ea;border-radius:13px;background:rgba(255,255,255,.96);box-shadow:0 8px 30px #10203316;backdrop-filter:blur(12px)}.sanmar-setup-footer>span{color:#697887;font-size:11px}.sanmar-setup-footer .ae-button.primary{justify-self:end}@media(max-width:720px){.sanmar-setup-topbar{grid-template-columns:1fr auto;padding:10px 14px}.sanmar-setup-topbar>div{display:none}.sanmar-setup-content{width:calc(100% - 22px)}.sanmar-setup-heading{align-items:flex-start;padding:24px 0 17px}.sanmar-setup-heading p:last-child{font-size:12px}.sanmar-setup-item{min-width:0;max-width:125px;font-size:10px}.sanmar-setup-item img{width:38px;height:38px}.sanmar-setup-section{padding:15px}.sanmar-setup-fields{grid-template-columns:1fr 1fr}.sanmar-setup-fields label:first-child{grid-column:1/-1}.sanmar-visual-image-selectors{grid-template-columns:1fr}.sanmar-setup-section>header{align-items:flex-start}.sanmar-setup-section>header>b{font-size:10px;white-space:normal}.sanmar-setup-footer{flex-wrap:wrap}.sanmar-setup-footer>span{order:3;width:100%;text-align:center}.sanmar-setup-footer>.ae-button{flex:1}.sanmar-visual-image-grid{grid-template-columns:repeat(auto-fill,minmax(112px,1fr))}}
        `}</style>
      </main>
    );
  }

  return (
    <div className="sanmar-browser-shell">
      <section className="ae-card sanmar-browser-main">
        <div className="sanmar-live-banner">
          <div>
            <i />
            <div>
              <strong>LIVE SANMAR CATALOG</strong>
              <span>
                Account {accountHint || "connected"} · browse product data,
                then load exact account pricing and inventory when you select
                a style.
              </span>
            </div>
          </div>
          <button
            className="ae-button"
            disabled={busy}
            onClick={() => load({ refresh: true })}
          >
            {busy ? "Refreshing…" : "Refresh catalog"}
          </button>
        </div>

        <div className="sanmar-category-tabs">
          {["", ...categories].map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              disabled={busy}
              onClick={() => switchCategory(item)}
            >
              <b>{item || "All product types"}</b>
            </button>
          ))}
        </div>

        <div className="sanmar-toolbar">
          <label className="sanmar-search">
            <span>Search {category || "all SanMar products"}</span>
            <div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void load()}
                placeholder="Brand, product name, or style number"
              />
              <button className="ae-button primary" onClick={() => load()}>
                Search
              </button>
            </div>
          </label>

          <label className="sanmar-brand-filter">
            <span>Brand</span>
            <select value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">All brands</option>
              {brands.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <button className="ae-button" onClick={() => load()}>
            Apply
          </button>
        </div>

        <div className="sanmar-quick">
          <span>Popular</span>
          {QUICK.map((value) => (
            <button
              key={value}
              onClick={() => {
                setQ(value);
                void load({ search: value });
              }}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="sanmar-results-head">
          <div>
            <strong>{total.toLocaleString()} styles</strong>
            <small>
              Select a product to load its exact colors, sizes, your SanMar
              price and inventory.
            </small>
          </div>
          {busy && <span>Loading SanMar…</span>}
        </div>

        {styles.length ? (
          <div className="sanmar-style-grid">
            {styles.map((style) => {
              const alreadyAdded = importedStyleIds.includes(style.styleId);
              return (
                <button
                  key={style.styleId}
                  className={
                    selected?.styleId === style.styleId
                      ? "sanmar-style-card selected"
                      : "sanmar-style-card"
                  }
                  onClick={() => void choose(style)}
                >
                  <div className="sanmar-style-image">
                    {style.imageUrl ? (
                      <img src={style.imageUrl} alt={style.title} />
                    ) : (
                      <span className="sanmar-image-fallback">SANMAR</span>
                    )}
                    <em>{alreadyAdded ? "ADDED" : "LIVE"}</em>
                  </div>
                  <div className="sanmar-style-copy">
                    <span>
                      {style.brandName} · {style.styleId}
                    </span>
                    <h3>{style.title}</h3>
                    <p>{style.description}</p>
                    <footer>
                      <small>{style.colorCount} colors</small>
                      <small>{style.sizeCount} sizes</small>
                    </footer>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          !busy && (
            <div className="sanmar-empty">
              <h3>No products match this search.</h3>
              <p>Try another brand or clear the search.</p>
            </div>
          )
        )}

        {hasMore && (
          <div className="sanmar-load-more">
            <button
              className="ae-button"
              disabled={busy}
              onClick={() => load({ append: true })}
            >
              {busy ? "Loading…" : "Load more products"}
            </button>
          </div>
        )}

        <details className="sanmar-exact-fallback">
          <summary>Know the exact SanMar style number?</summary>
          <div>
            <input
              value={exactStyle}
              onChange={(e) => setExactStyle(e.target.value.toUpperCase())}
              onKeyDown={(e) =>
                e.key === "Enter" && void jumpToExactStyle()
              }
              placeholder="Example: K500"
            />
            <button
              className="ae-button"
              disabled={!exactStyle.trim() || detailBusy}
              onClick={() => void jumpToExactStyle()}
            >
              Open style
            </button>
          </div>
        </details>
      </section>

      <aside className="ae-card sanmar-inspector">
        {!selected ? (
          <div className="sanmar-inspector-empty">
            <span>↗</span>
            <h2>Select a SanMar product</h2>
            <p>
              The inspector will show real color images, available sizes,
              account pricing and inventory before anything is added to
              Advanced.
            </p>
          </div>
        ) : (
          <>
            <header className="sanmar-inspector-head">
              <div>
                <p className="ae-kicker">SANMAR PRODUCT</p>
                <h2>
                  {detail?.brandName || selected.brandName}{" "}
                  {selected.styleId}
                </h2>
                <p>{detail?.name || selected.title}</p>
              </div>
              <span>LIVE</span>
            </header>

            {detailBusy ? (
              <div className="sanmar-detail-loading">
                <i />
                <b>Loading live product details…</b>
                <small>
                  Account pricing, inventory, media, colors and sizes.
                </small>
              </div>
            ) : detail ? (
              <>
                <label className="sanmar-display-name">
                  <span>Customer-facing name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={`${detail.brandName} ${detail.styleId}`}
                  />
                  <small>
                    Customers see this name. They do not need the SanMar style
                    number.
                  </small>
                </label>

                <button className="ae-button primary sanmar-continue-setup" type="button" onClick={() => setSetupOpen(true)}>Submit item & choose options →</button>

                <div className="sanmar-import-steps" aria-label="Import steps">
                  <button type="button" className={selectionStep === "colors" ? "active" : ""} onClick={() => setSelectionStep("colors")}>1. Colors and sizes</button>
                  <button type="button" className={selectionStep === "images" ? "active" : ""} disabled={!selectedColors.length} onClick={() => setSetupOpen(true)}>2. Photos and item options</button>
                </div>

                {selectionStep === "colors" ? <>
                <div className="sanmar-color-toolbar">
                  <div>
                    <h3>Choose customer colors</h3>
                    <p>
                      {selectedColors.length} of {colors.length} selected
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() =>
                        setSelectedColors(colors.map((item) => item.name))
                      }
                    >
                      Select all
                    </button>
                    <button onClick={() => setSelectedColors([])}>Clear</button>
                  </div>
                </div>

                <div className="sanmar-color-list">
                  {colors.map((color) => (
                    <label
                      key={color.name}
                      className={
                        selectedColors.includes(color.name) ? "selected" : ""
                      }
                    >
                      <input
                        type="checkbox"
                        checked={selectedColors.includes(color.name)}
                        onChange={(event) =>
                          setSelectedColors(
                            event.target.checked
                              ? [...selectedColors, color.name]
                              : selectedColors.filter(
                                  (value) => value !== color.name
                                )
                          )
                        }
                      />

                      <div className="sanmar-color-image">
                        {color.frontImageUrl ? (
                          <img
                            src={color.frontImageUrl}
                            alt={`${color.name} front`}
                          />
                        ) : color.swatchImageUrl ? (
                          <img
                            src={color.swatchImageUrl}
                            alt={`${color.name} swatch`}
                          />
                        ) : (
                          <span />
                        )}
                      </div>

                      <div className="sanmar-color-copy">
                        <strong>{color.name}</strong>
                        <small>{color.sizes.join(" · ")}</small>
                        <small>
                          {color.inventory.toLocaleString()} units ·{" "}
                          {color.priceMin > 0
                            ? color.priceMin === color.priceMax
                              ? money(color.priceMin)
                              : `${money(color.priceMin)}–${money(
                                  color.priceMax
                                )}`
                            : "Price unavailable"}
                        </small>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="sanmar-import-footer">
                  <div>
                    <strong>{selectedColors.length} colors selected</strong>
                    <small>
                      {
                        detail.variants.filter((item) =>
                          selectedColors.includes(item.colorName)
                        ).length
                      }{" "}
                      exact size/color SKUs
                    </small>
                  </div>

                  <button
                    className="ae-button primary"
                    disabled={!selectedColors.length}
                    onClick={() => setSetupOpen(true)}
                  >
                    Submit item & choose options →
                  </button>
                </div>
                </> : <>
                  <div className="sanmar-image-step-head">
                    <h3>Choose product photos</h3>
                    <p>Select the front and back image customers will see for each selected color. The recommended garment images are selected by default.</p>
                  </div>
                  <div className="sanmar-image-color-list">
                    {colors.filter((color) => selectedColors.includes(color.name)).map((color) => {
                      const selection = imageSelections[color.name] || { frontImageUrl: color.frontImageUrl, backImageUrl: color.backImageUrl };
                      const choices = [
                        ...color.imageChoices,
                        ...(color.frontImageUrl ? [{ url: color.frontImageUrl, label: "Recommended front" }] : []),
                        ...(color.backImageUrl ? [{ url: color.backImageUrl, label: "Recommended back" }] : [])
                      ].filter((choice, index, all) => all.findIndex((item) => item.url === choice.url) === index);
                      const frontChoices = choices.filter((choice) => !/back|swatch/i.test(choice.label));
                      const backChoices = choices.filter((choice) => !/front|swatch/i.test(choice.label));
                      return <section className="sanmar-image-color" key={color.name}>
                        <h4>{color.name}</h4>
                        <div className="sanmar-image-choice-grid">
                          {(["front", "back"] as const).map((side) => {
                            const key = side === "front" ? "frontImageUrl" : "backImageUrl";
                            const sideChoices = side === "front" ? frontChoices : backChoices;
                            const selectedUrl = selection[key] || color[key] || sideChoices[0]?.url || "";
                            const options = sideChoices.some((choice) => choice.url === selectedUrl)
                              ? sideChoices
                              : [...sideChoices, ...(selectedUrl ? [{ url: selectedUrl, label: `Current ${side} selection` }] : [])];
                            return <label key={side} className="sanmar-image-choice">
                              <span>{side === "front" ? "Front photo" : "Back photo"}</span>
                              {selectedUrl ? <img src={selectedUrl} alt={`${color.name} ${side} garment preview`} /> : <div className="sanmar-image-choice-empty">No {side} image supplied</div>}
                              <select value={selectedUrl} onChange={(event) => setImageSelections((current) => ({
                                ...current,
                                [color.name]: { ...selection, [key]: event.target.value }
                              }))}>
                                <option value="">No image</option>
                                {(options.length ? options : choices).map((choice) => <option key={choice.url} value={choice.url}>{choice.label}</option>)}
                              </select>
                            </label>;
                          })}
                        </div>
                      </section>;
                    })}
                  </div>
                  <div className="sanmar-import-footer">
                    <button className="ae-button" type="button" onClick={() => setSelectionStep("colors")}>← Back to colors</button>
                    <button className="ae-button primary" disabled={importBusy || !selectedColors.length} onClick={() => void importProduct()}>
                      {importBusy ? "Adding…" : "Add product to Advanced"}
                    </button>
                  </div>
                </>}
              </>
            ) : null}
          </>
        )}

        {message && (
          <div
            className={`sanmar-message ${messageType}`}
          >
            <span>{message}</span>
            {messageType === "success" && (
              <Link href="/advanced-admin/products">View Products →</Link>
            )}
          </div>
        )}
      </aside>

      <style jsx>{`
        .sanmar-browser-shell {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.5fr);
          gap: 16px;
          align-items: start;
        }
        .sanmar-browser-main,
        .sanmar-inspector {
          min-width: 0;
        }
        .sanmar-inspector {
          position: sticky;
          top: 24px;
          max-height: calc(100vh - 48px);
          overflow: auto;
        }
        .sanmar-live-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 13px 14px;
          margin-bottom: 16px;
          border-radius: 14px;
          background: #0b2038;
          color: #fff;
        }
        .sanmar-live-banner > div {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sanmar-live-banner i {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #4bd38b;
          box-shadow: 0 0 0 5px rgba(75, 211, 139, 0.13);
        }
        .sanmar-live-banner strong,
        .sanmar-live-banner span {
          display: block;
        }
        .sanmar-live-banner strong {
          font-size: 9px;
          letter-spacing: 0.08em;
        }
        .sanmar-live-banner span {
          margin-top: 3px;
          font-size: 7px;
          opacity: 0.67;
        }
        .sanmar-live-banner :global(.ae-button) {
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }
        .sanmar-category-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 14px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .sanmar-category-tabs button {
          display: grid;
          gap: 2px;
          flex: 0 0 auto;
          max-width: 240px;
          padding: 12px;
          border: 1px solid #dce2e7;
          border-radius: 13px;
          background: #fff;
          color: #66727f;
          text-align: left;
          cursor: pointer;
        }
        .sanmar-category-tabs button.active {
          border-color: #0b2038;
          background: #0b2038;
          color: #fff;
        }
        .sanmar-category-tabs b {
          font-size: 10px;
        }
        .sanmar-category-tabs small {
          font-size: 7px;
          opacity: 0.7;
        }
        .sanmar-toolbar {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 190px auto;
          gap: 8px;
          align-items: end;
          margin-bottom: 9px;
        }
        .sanmar-search,
        .sanmar-brand-filter,
        .sanmar-display-name {
          display: grid;
          gap: 5px;
        }
        .sanmar-search > span,
        .sanmar-brand-filter > span,
        .sanmar-display-name > span {
          font-size: 8px;
          font-weight: 900;
          color: #0b2038;
        }
        .sanmar-search > div {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 7px;
        }
        .sanmar-search input,
        .sanmar-brand-filter select,
        .sanmar-display-name input,
        .sanmar-exact-fallback input {
          width: 100%;
          min-height: 42px;
          padding: 0 11px;
          border: 1px solid #dce2e7;
          border-radius: 11px;
          background: #fff;
          font: inherit;
          font-size: 9px;
          color: #17202a;
        }
        .sanmar-quick {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          padding-bottom: 13px;
          border-bottom: 1px solid #eef1f3;
        }
        .sanmar-quick span {
          font-size: 7px;
          font-weight: 900;
          color: #66727f;
          text-transform: uppercase;
        }
        .sanmar-quick button,
        .sanmar-color-toolbar button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #0b2038;
          font-size: 7px;
          font-weight: 900;
          cursor: pointer;
        }
        .sanmar-quick button {
          padding: 6px 8px;
          border: 1px solid #dce2e7;
          border-radius: 999px;
          background: #fff;
        }
        .sanmar-results-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 15px 0 10px;
        }
        .sanmar-results-head strong,
        .sanmar-results-head small {
          display: block;
        }
        .sanmar-results-head strong {
          color: #0b2038;
          font-size: 12px;
        }
        .sanmar-results-head small,
        .sanmar-results-head > span {
          margin-top: 3px;
          color: #66727f;
          font-size: 7px;
        }
        .sanmar-style-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
        }
        .sanmar-style-card {
          display: grid;
          min-width: 0;
          overflow: hidden;
          padding: 0;
          border: 1px solid #dce2e7;
          border-radius: 14px;
          background: #fff;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }
        .sanmar-style-card:hover,
        .sanmar-style-card.selected {
          border-color: #0b2038;
          box-shadow: 0 7px 22px rgba(11, 32, 56, 0.08);
        }
        .sanmar-style-image {
          position: relative;
          aspect-ratio: 4 / 3;
          display: grid;
          place-items: center;
          background: #f4f5f4;
          overflow: hidden;
        }
        .sanmar-style-image img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .sanmar-style-image em {
          position: absolute;
          top: 8px;
          left: 8px;
          padding: 4px 6px;
          border-radius: 999px;
          background: #0b2038;
          color: #fff;
          font-style: normal;
          font-size: 6px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }
        .sanmar-image-fallback {
          font-size: 8px;
          font-weight: 900;
          color: #9aa3ac;
          letter-spacing: 0.12em;
        }
        .sanmar-style-copy {
          padding: 10px;
          min-width: 0;
        }
        .sanmar-style-copy > span {
          font-size: 7px;
          font-weight: 900;
          color: #d83d49;
        }
        .sanmar-style-copy h3 {
          min-height: 29px;
          margin: 4px 0;
          color: #0b2038;
          font-size: 10px;
          line-height: 1.35;
        }
        .sanmar-style-copy p {
          display: -webkit-box;
          min-height: 31px;
          margin: 0 0 8px;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
          color: #66727f;
          font-size: 7px;
          line-height: 1.45;
        }
        .sanmar-style-copy footer {
          display: flex;
          gap: 8px;
          padding-top: 7px;
          border-top: 1px solid #eef1f3;
        }
        .sanmar-style-copy footer small {
          color: #66727f;
          font-size: 6px;
          font-weight: 800;
        }
        .sanmar-load-more {
          display: grid;
          place-items: center;
          padding-top: 14px;
        }
        .sanmar-empty {
          padding: 45px 20px;
          text-align: center;
          color: #66727f;
        }
        .sanmar-empty h3 {
          margin: 0;
          color: #0b2038;
        }
        .sanmar-empty p {
          font-size: 8px;
        }
        .sanmar-exact-fallback {
          margin-top: 16px;
          padding-top: 13px;
          border-top: 1px solid #eef1f3;
        }
        .sanmar-exact-fallback summary {
          color: #66727f;
          font-size: 8px;
          font-weight: 900;
          cursor: pointer;
        }
        .sanmar-exact-fallback > div {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 7px;
          margin-top: 8px;
        }
        .sanmar-inspector-empty {
          min-height: 460px;
          display: grid;
          place-items: center;
          align-content: center;
          text-align: center;
          color: #66727f;
        }
        .sanmar-inspector-empty > span {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          margin-bottom: 10px;
          border: 1px solid #dce2e7;
          border-radius: 50%;
          color: #0b2038;
        }
        .sanmar-inspector-empty h2 {
          margin: 0;
          color: #0b2038;
          font-size: 18px;
        }
        .sanmar-inspector-empty p {
          max-width: 250px;
          font-size: 8px;
          line-height: 1.55;
        }
        .sanmar-inspector-head {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 10px;
          padding-bottom: 13px;
          border-bottom: 1px solid #eef1f3;
        }
        .sanmar-inspector-head h2 {
          margin: 0;
          color: #0b2038;
          font-size: 19px;
        }
        .sanmar-inspector-head p:last-child {
          margin: 4px 0 0;
          color: #66727f;
          font-size: 8px;
        }
        .sanmar-inspector-head > span {
          padding: 5px 7px;
          border-radius: 999px;
          background: #e8f5ee;
          color: #176a48;
          font-size: 6px;
          font-weight: 900;
        }
        .sanmar-detail-loading {
          min-height: 330px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 7px;
          text-align: center;
        }
        .sanmar-detail-loading i {
          width: 20px;
          height: 20px;
          border: 2px solid #dce2e7;
          border-top-color: #d83d49;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .sanmar-detail-loading b {
          color: #0b2038;
          font-size: 9px;
        }
        .sanmar-detail-loading small {
          color: #66727f;
          font-size: 7px;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .sanmar-display-name {
          margin: 14px 0;
        }
        .sanmar-display-name small {
          color: #66727f;
          font-size: 7px;
        }
        .sanmar-color-toolbar {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 10px;
          margin: 13px 0 8px;
        }
        .sanmar-color-toolbar h3 {
          margin: 0;
          color: #0b2038;
          font-size: 11px;
        }
        .sanmar-color-toolbar p {
          margin: 2px 0 0;
          color: #66727f;
          font-size: 7px;
        }
        .sanmar-color-toolbar > div:last-child {
          display: flex;
          gap: 8px;
        }
        .sanmar-color-list {
          display: grid;
          gap: 7px;
        }
        .sanmar-color-list > label {
          position: relative;
          display: grid;
          grid-template-columns: 58px 1fr;
          gap: 9px;
          align-items: center;
          padding: 8px;
          border: 1px solid #dce2e7;
          border-radius: 12px;
          background: #fff;
          cursor: pointer;
        }
        .sanmar-color-list > label.selected {
          border-color: #0b2038;
          background: #f9fbfc;
        }
        .sanmar-color-list input[type="checkbox"] {
          position: absolute;
          top: 7px;
          right: 7px;
          accent-color: #d83d49;
        }
        .sanmar-color-image {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 9px;
          background: #f4f5f4;
        }
        .sanmar-color-image img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .sanmar-color-image span {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #d9dee6;
        }
        .sanmar-color-copy {
          min-width: 0;
          padding-right: 22px;
        }
        .sanmar-color-copy strong,
        .sanmar-color-copy small {
          display: block;
        }
        .sanmar-color-copy strong {
          color: #0b2038;
          font-size: 9px;
        }
        .sanmar-color-copy small {
          margin-top: 3px;
          overflow: hidden;
          color: #66727f;
          font-size: 6px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sanmar-import-footer {
          position: sticky;
          bottom: -20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin: 14px -20px -20px;
          padding: 12px 20px;
          border-top: 1px solid #dce2e7;
          background: #fff;
        }
        .sanmar-import-footer strong,
        .sanmar-import-footer small {
          display: block;
        }
        .sanmar-import-footer strong {
          color: #0b2038;
          font-size: 8px;
        }
        .sanmar-import-footer small {
          margin-top: 2px;
          color: #66727f;
          font-size: 6px;
        }
        .sanmar-import-steps {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          margin: 14px 0;
        }
        .sanmar-import-steps button {
          min-height: 36px;
          padding: 8px;
          border: 1px solid #dce2e7;
          border-radius: 10px;
          background: #fff;
          color: #66727f;
          font-size: 8px;
          font-weight: 800;
          cursor: pointer;
        }
        .sanmar-import-steps button.active {
          border-color: #0b2038;
          background: #0b2038;
          color: #fff;
        }
        .sanmar-import-steps button:disabled {
          opacity: .45;
          cursor: not-allowed;
        }
        .sanmar-image-step-head h3 { margin: 8px 0 4px; color: #0b2038; font-size: 11px; }
        .sanmar-image-step-head p { margin: 0 0 12px; color: #66727f; font-size: 8px; line-height: 1.45; }
        .sanmar-image-color-list { display: grid; gap: 10px; }
        .sanmar-image-color { padding: 10px; border: 1px solid #dce2e7; border-radius: 12px; background: #fff; }
        .sanmar-image-color h4 { margin: 0 0 8px; color: #0b2038; font-size: 9px; }
        .sanmar-image-choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .sanmar-image-choice { display: grid; gap: 5px; min-width: 0; color: #0b2038; font-size: 7px; font-weight: 800; }
        .sanmar-image-choice img,.sanmar-image-choice-empty { width: 100%; height: 110px; border: 1px solid #e4e8ec; border-radius: 9px; background: #f4f6f7; object-fit: contain; }
        .sanmar-image-choice-empty { display: grid; place-items: center; padding: 8px; color: #7a8490; text-align: center; font-weight: 600; }
        .sanmar-image-choice select { width: 100%; min-height: 34px; border: 1px solid #dce2e7; border-radius: 8px; padding: 0 7px; background: #fff; color: #17202a; font: inherit; }
        .sanmar-message {
          display: grid;
          gap: 5px;
          margin-top: 12px;
          padding: 10px;
          border-radius: 11px;
          font-size: 7px;
          line-height: 1.45;
        }
        .sanmar-message.success {
          background: #e8f5ee;
          color: #176a48;
        }
        .sanmar-message.error {
          background: #fdebed;
          color: #a32936;
        }
        .sanmar-message.info {
          background: #eef3f8;
          color: #0b2038;
        }
        .sanmar-message :global(a) {
          color: inherit;
          font-weight: 900;
        }
        .sanmar-connect-state {
          text-align: center;
          padding: 45px;
        }
        .sanmar-wordmark {
          color: #0b2038;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }
        @media (max-width: 1100px) {
          .sanmar-browser-shell {
            grid-template-columns: 1fr;
          }
          .sanmar-inspector {
            position: static;
            max-height: none;
          }
          .sanmar-style-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .sanmar-live-banner {
            align-items: stretch;
            flex-direction: column;
          }
          .sanmar-category-tabs {
            display: flex;
          }
          .sanmar-toolbar {
            grid-template-columns: 1fr;
          }
          .sanmar-style-grid {
            grid-template-columns: 1fr;
          }
          .sanmar-style-copy h3,
          .sanmar-style-copy p {
            min-height: 0;
          }
        }
      `}</style>
    </div>
  );
}
