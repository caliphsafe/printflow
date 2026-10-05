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

type ImageChoice = { url: string; label: string; classTypeId?: string };
type ImageSelection = { frontImageUrl: string; backImageUrl: string };
type Variant = {
  sku: string;
  skuId: string;
  colorName: string;
  sizeName: string;
  customerPrice: number;
  quantity: number;
  active: boolean;
};
type ProductDetail = {
  styleId: string;
  name: string;
  description: string;
  brandName: string;
  variants: Variant[];
  media: Record<string, {
    frontImageUrl?: string;
    backImageUrl?: string;
    swatchImageUrl?: string;
    imageChoices?: ImageChoice[];
  }>;
};
type SetupItem = {
  style: BrowseStyle;
  detail: ProductDetail;
  displayName: string;
  category: string;
  minimumQuantity: number;
  decorationMethods: string[];
  printSizes: string[];
  selectedColors: string[];
  imageSelections: Record<string, ImageSelection>;
  frontChoiceKey: string;
  backChoiceKey: string;
  printLocations: string[];
};
type WizardStep = "catalog" | "images" | "zones";

const QUICK = ["Gildan", "Port Authority", "New Era", "hoodie", "jacket"];
const METHODS = ["Screen Print", "DTF", "Embroidery", "Heat Transfer", "Sublimation"];
const PRINT_SIZES = [{ id: "heart", label: "Left chest / small" }, { id: "full", label: "Full front" }];
const APPAREL_ZONES = ["Front", "Back", "Left Chest", "Right Chest", "Left Sleeve", "Right Sleeve"];
const HEADWEAR_ZONES = ["Hat Front", "Hat Side", "Hat Back"];
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

function choiceKey(choice: ImageChoice) {
  return choice.classTypeId?.trim() || choice.label.trim().toLowerCase().replace(/\s+/g, " ");
}

function choicesForColor(media?: ProductDetail["media"][string]): ImageChoice[] {
  if (!media) return [];
  return [
    ...(media.imageChoices || []),
    ...(media.frontImageUrl ? [{ url: media.frontImageUrl, label: "Front view" }] : []),
    ...(media.backImageUrl ? [{ url: media.backImageUrl, label: "Back view" }] : [])
  ].filter((choice, index, all) => choice.url && all.findIndex((item) => item.url === choice.url) === index);
}

function isBackChoice(choice: ImageChoice) {
  return choice.classTypeId?.trim() === "1008" || /back|rear|reverse/i.test(choice.label);
}

function colorSummaries(detail: ProductDetail) {
  const groups = new Map<string, Variant[]>();
  for (const variant of detail.variants) {
    groups.set(variant.colorName, [...(groups.get(variant.colorName) || []), variant]);
  }
  return [...groups.entries()].map(([name, variants]) => {
    const prices = variants.map((variant) => Number(variant.customerPrice || 0)).filter((price) => price > 0);
    const media = detail.media?.[name] || {};
    return {
      name,
      sizes: [...new Set(variants.map((variant) => variant.sizeName))],
      inventory: variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.quantity || 0)), 0),
      priceMin: prices.length ? Math.min(...prices) : 0,
      priceMax: prices.length ? Math.max(...prices) : 0,
      ...media
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function initialSetupItem(style: BrowseStyle, detail: ProductDetail): SetupItem {
  const colors = [...new Set(detail.variants.map((variant) => variant.colorName))];
  const firstMedia = detail.media?.[colors[0]];
  const firstChoices = choicesForColor(firstMedia);
  const front = firstChoices.find((choice) => choice.url === firstMedia?.frontImageUrl) || firstChoices.find((choice) => !isBackChoice(choice));
  const back = firstChoices.find((choice) => choice.url === firstMedia?.backImageUrl) || firstChoices.find(isBackChoice);
  const headwear = /\b(hat|cap|headwear|beanie|visor|bucket hat|trucker|caps)\b/i.test(`${style.category} ${style.title}`);
  return {
    style,
    detail,
    displayName: style.title.replace(new RegExp(`\\s*${style.styleId}\\s*$`, "i"), "").trim() || `${style.brandName} ${style.styleId}`,
    category: style.category || "Apparel",
    minimumQuantity: headwear ? 1 : 12,
    decorationMethods: headwear ? ["Embroidery"] : ["Screen Print", "DTF", "Embroidery"],
    printSizes: headwear ? ["full"] : ["heart", "full"],
    selectedColors: colors,
    imageSelections: Object.fromEntries(colors.map((name) => {
      const media = detail.media?.[name] || {};
      return [name, { frontImageUrl: media.frontImageUrl || "", backImageUrl: media.backImageUrl || "" }];
    })),
    frontChoiceKey: front ? choiceKey(front) : "",
    backChoiceKey: back ? choiceKey(back) : "",
    printLocations: []
  };
}

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
  const [selectedStyles, setSelectedStyles] = useState<BrowseStyle[]>([]);
  const [setupItems, setSetupItems] = useState<SetupItem[]>([]);
  const [step, setStep] = useState<WizardStep>("catalog");
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
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [exactStyle, setExactStyle] = useState("");

  async function load(options?: { append?: boolean; search?: string; nextCategory?: string; nextBrand?: string; refresh?: boolean }) {
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
      const response = await fetch(`/api/admin/suppliers/sanmar/styles?${params.toString()}`, { cache: "no-store" });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || "Unable to load the live SanMar catalog.");
      setCategory(nextCategory);
      setStyles((current) => append ? [...current, ...(data.styles || [])] : data.styles || []);
      setBrands(data.brands || []);
      setCategories(data.categories || []);
      setTotal(Number(data.total || 0));
      setHasMore(data.hasMore === true);
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Unable to load the live SanMar catalog.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (connected) void load({ nextCategory: "", search: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  function toggleStyle(style: BrowseStyle) {
    setSelectedStyles((current) => current.some((item) => item.styleId === style.styleId)
      ? current.filter((item) => item.styleId !== style.styleId)
      : [...current, style]);
    setMessage("");
  }

  async function openImageSetup() {
    if (!selectedStyles.length) return;
    setDetailBusy(true);
    setMessage("");
    try {
      const rows: SetupItem[] = [];
      for (let offset = 0; offset < selectedStyles.length; offset += 3) {
        const batch = selectedStyles.slice(offset, offset + 3);
        rows.push(...await Promise.all(batch.map(async (style) => {
          const response = await fetch(`/api/admin/suppliers/sanmar/style?style=${encodeURIComponent(style.styleId)}`, { cache: "no-store" });
          const data = await readApiResponse(response);
          if (!response.ok) throw new Error(`${style.styleId}: ${data.error || "Unable to load item details."}`);
          return initialSetupItem(style, data.style as ProductDetail);
        })));
      }
      setSetupItems(rows);
      setStep("images");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Unable to load the selected SanMar items.");
    } finally {
      setDetailBusy(false);
    }
  }

  function updateSetupItem(styleId: string, update: (item: SetupItem) => SetupItem) {
    setSetupItems((current) => current.map((item) => item.style.styleId === styleId ? update(item) : item));
  }

  function selectImageStyle(styleId: string, side: "front" | "back", choice: ImageChoice, fromColor: string) {
    updateSetupItem(styleId, (item) => {
      const key = choiceKey(choice);
      const nextSelections = { ...item.imageSelections };
      for (const colorName of item.selectedColors) {
        const colorChoices = choicesForColor(item.detail.media?.[colorName]);
        const match = colorChoices.find((option) => choiceKey(option) === key);
        const targetUrl = match?.url || (colorName === fromColor ? choice.url : "");
        const media = item.detail.media?.[colorName] || {};
        const previous = nextSelections[colorName] || { frontImageUrl: media.frontImageUrl || "", backImageUrl: media.backImageUrl || "" };
        nextSelections[colorName] = {
          frontImageUrl: side === "front" ? (targetUrl || media.frontImageUrl || previous.frontImageUrl) : previous.frontImageUrl,
          backImageUrl: side === "back" ? (targetUrl || media.backImageUrl || previous.backImageUrl) : previous.backImageUrl
        };
      }
      return {
        ...item,
        imageSelections: nextSelections,
        ...(side === "front" ? { frontChoiceKey: key } : { backChoiceKey: key })
      };
    });
  }

  function toggleColor(styleId: string, colorName: string, checked: boolean) {
    updateSetupItem(styleId, (item) => {
      const selectedColors = checked
        ? [...new Set([...item.selectedColors, colorName])]
        : item.selectedColors.filter((name) => name !== colorName);
      const media = item.detail.media?.[colorName] || {};
      const choices = choicesForColor(media);
      const frontUrl = choices.find((choice) => choiceKey(choice) === item.frontChoiceKey)?.url || media.frontImageUrl || "";
      const backUrl = choices.find((choice) => choiceKey(choice) === item.backChoiceKey)?.url || media.backImageUrl || "";
      return {
        ...item,
        selectedColors,
        imageSelections: { ...item.imageSelections, [colorName]: { frontImageUrl: frontUrl, backImageUrl: backUrl } }
      };
    });
  }

  async function importProducts() {
    if (setupItems.some((item) => !item.selectedColors.length || !item.printLocations.length)) return;
    setImportBusy(true);
    setMessage("");
    const failures: string[] = [];
    const successes: string[] = [];
    for (const item of setupItems) {
      try {
        const response = await fetch("/api/admin/suppliers/sanmar/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            styleId: item.detail.styleId,
            displayName: item.displayName,
            category: item.category,
            selectedColors: item.selectedColors,
            imageSelections: item.imageSelections,
            customization: {
              category: item.category,
              minimumQuantity: item.minimumQuantity,
              decorationMethods: item.decorationMethods,
              printSizes: item.printSizes,
              printLocations: item.printLocations
            }
          })
        });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Unable to import this product.");
        successes.push(String(data.product?.name || item.displayName));
      } catch (error) {
        failures.push(`${item.style.styleId}: ${error instanceof Error ? error.message : "Import failed."}`);
      }
    }
    if (failures.length) {
      setMessageType("error");
      setMessage(`${successes.length} imported. ${failures.join(" · ")}`);
    } else {
      setMessageType("success");
      setMessage(`${successes.length} product${successes.length === 1 ? "" : "s"} added to the products catalog: ${successes.join(", ")}.`);
      setSelectedStyles([]);
      setSetupItems([]);
      setStep("catalog");
    }
    setImportBusy(false);
  }

  function addExactStyle() {
    const styleId = exactStyle.trim().toUpperCase();
    if (!styleId) return;
    const exact = { styleId, brandName: "SanMar", title: styleId, description: "", category, imageUrl: "", colorCount: 0, sizeCount: 0, priceMin: 0, priceMax: 0 };
    if (!selectedStyles.some((item) => item.styleId === styleId)) toggleStyle(exact);
    setExactStyle("");
  }

  function switchCategory(next: string) {
    setBrand("");
    setQ("");
    void load({ nextCategory: next, nextBrand: "", search: "" });
  }

  const selectedCount = selectedStyles.length;
  const canImport = setupItems.length > 0 && setupItems.every((item) => item.selectedColors.length > 0 && item.printLocations.length > 0);

  if (!connected) {
    return <section className="ae-card sanmar-connect-state"><div className="sanmar-wordmark">SANMAR</div><h2>Connect SanMar to browse products.</h2><p>Once connected, browse every product type in the shop’s SanMar catalog.</p><Link className="ae-button primary" href="/advanced-admin/settings">Connect SanMar</Link></section>;
  }

  if (step !== "catalog") {
    return <main className="sanmar-wizard">
      <header className="sanmar-wizard-bar">
        <button type="button" className="sanmar-wizard-back" onClick={() => setStep(step === "zones" ? "images" : "catalog")}>← {step === "zones" ? "Back to images and colors" : "Back to catalog"}</button>
        <nav aria-label="Import steps"><span className="done">1 · Items</span><span className={step === "images" ? "active" : "done"}>2 · Colors & images</span><span className={step === "zones" ? "active" : ""}>3 · Print zones</span></nav>
        {step === "images" ? <button className="ae-button primary" type="button" disabled={setupItems.some((item) => !item.selectedColors.length)} onClick={() => setStep("zones")}>Next: print zones →</button> : <button className="ae-button primary" type="button" disabled={!canImport || importBusy} onClick={() => void importProducts()}>{importBusy ? "Importing…" : "Import selected products"}</button>}
      </header>
      <div className="sanmar-wizard-main">
        <div className="sanmar-wizard-title"><div><p className="ae-kicker">SANMAR PRODUCT IMPORT</p><h1>{step === "images" ? "Choose colors and product images" : "Choose print zones"}</h1><p>{step === "images" ? "Set up each item. Select colors, then choose the front and back image views customers will see." : "Choose the print locations that customers can customize on each item before importing."}</p></div><span>{setupItems.length} item{setupItems.length === 1 ? "" : "s"}</span></div>
        {setupItems.map((item) => {
          const colors = colorSummaries(item.detail);
          const representative = colors.find((color) => item.selectedColors.includes(color.name)) || colors[0];
          const representativeChoices = representative ? choicesForColor(item.detail.media?.[representative.name]) : [];
          const frontChoices = representativeChoices.filter((choice) => !isBackChoice(choice) && !/swatch/i.test(choice.label));
          const backChoices = representativeChoices.filter((choice) => isBackChoice(choice) && !/swatch/i.test(choice.label));
          const zones = /\b(hat|cap|headwear|beanie|visor|bucket hat|trucker|caps)\b/i.test(`${item.category} ${item.style.title}`) ? HEADWEAR_ZONES : APPAREL_ZONES;
          const skuCount = item.detail.variants.filter((variant) => item.selectedColors.includes(variant.colorName)).length;
          return <article className="sanmar-wizard-item" key={item.style.styleId}>
            <header className="sanmar-wizard-item-head"><img src={representative?.frontImageUrl || item.style.imageUrl} alt=""/><div><span>{item.detail.brandName} · {item.detail.styleId}</span><h2>{item.displayName}</h2><small>{item.style.title}</small></div><b>{item.selectedColors.length} colors · {skuCount} SKUs</b></header>
            {step === "images" ? <>
              <div className="sanmar-config-fields">
                <label><span>Storefront name</span><input value={item.displayName} onChange={(event) => updateSetupItem(item.style.styleId, (current) => ({ ...current, displayName: event.target.value }))}/></label>
                <label><span>Product type</span><select value={item.category} onChange={(event) => updateSetupItem(item.style.styleId, (current) => ({ ...current, category: event.target.value }))}>{[...new Set([item.category, ...categories].filter(Boolean))].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label><span>Minimum quantity</span><input type="number" min={1} value={item.minimumQuantity} onChange={(event) => updateSetupItem(item.style.styleId, (current) => ({ ...current, minimumQuantity: Math.max(1, Number(event.target.value) || 1) }))}/></label>
              </div>
              <section className="sanmar-wizard-section"><header><h3>Colors to offer</h3><div><button type="button" onClick={() => updateSetupItem(item.style.styleId, (current) => ({ ...current, selectedColors: colors.map((color) => color.name) }))}>Select all</button><button type="button" onClick={() => updateSetupItem(item.style.styleId, (current) => ({ ...current, selectedColors: [] }))}>Clear</button></div></header><div className="sanmar-color-tiles">{colors.map((color) => {const chosenImages=item.imageSelections[color.name]; return <label className={item.selectedColors.includes(color.name) ? "selected" : ""} key={color.name}><input type="checkbox" checked={item.selectedColors.includes(color.name)} onChange={(event) => toggleColor(item.style.styleId, color.name, event.target.checked)}/><span className="sanmar-color-tile-images">{chosenImages?.frontImageUrl ? <img src={chosenImages.frontImageUrl} alt={`${color.name} front image`}/> : color.swatchImageUrl ? <img src={color.swatchImageUrl} alt={`${color.name} swatch`}/> : <i>No front</i>}{chosenImages?.backImageUrl && <img src={chosenImages.backImageUrl} alt={`${color.name} back image`}/>}</span><span className="sanmar-color-tile-copy"><b>{color.name}</b><small>{color.sizes.join(" · ")}</small><small>{color.inventory.toLocaleString()} available · {color.priceMin ? (color.priceMin === color.priceMax ? money(color.priceMin) : `${money(color.priceMin)}–${money(color.priceMax)}`) : "Price unavailable"}</small></span></label>;})}</div></section>
              <section className="sanmar-wizard-section"><header><h3>Front and back images</h3><span>Choose each view once; matching SanMar image types are applied across this item’s selected colors.</span></header><div className="sanmar-image-gallery-columns">{(["front", "back"] as const).map((side) => {
                const choices = side === "front" ? frontChoices : backChoices;
                const activeKey = side === "front" ? item.frontChoiceKey : item.backChoiceKey;
                return <div className="sanmar-image-gallery" key={side}><h4>{side === "front" ? "Front image" : "Back image"}</h4>{choices.length ? <div>{choices.map((choice) => <button type="button" className={choiceKey(choice) === activeKey ? "selected" : ""} key={`${choiceKey(choice)}-${choice.url}`} onClick={() => representative && selectImageStyle(item.style.styleId, side, choice, representative.name)}><span><img src={choice.url} alt={`${side} option ${choice.label}`}/>{choiceKey(choice) === activeKey && <i>✓</i>}</span><b>{choice.label}</b><small>{choiceKey(choice) === activeKey ? "Applied to matching colors" : "Use this image style"}</small></button>)}</div> : <p>No {side} image choices supplied by SanMar.</p>}</div>;
              })}</div>{representative && <div className="sanmar-color-image-preview"><b>Selected views for {representative.name}</b><div>{item.imageSelections[representative.name]?.frontImageUrl && <img src={item.imageSelections[representative.name].frontImageUrl} alt="Selected front"/>}{item.imageSelections[representative.name]?.backImageUrl && <img src={item.imageSelections[representative.name].backImageUrl} alt="Selected back"/>}</div></div>}</section>
              <section className="sanmar-wizard-section sanmar-extra-options"><header><h3>Ordering options</h3><span>Optional settings for this product.</span></header><div className="sanmar-option-pills"><b>Decoration methods</b>{METHODS.map((method) => <label key={method} className={item.decorationMethods.includes(method) ? "selected" : ""}><input type="checkbox" checked={item.decorationMethods.includes(method)} onChange={(event) => updateSetupItem(item.style.styleId, (current) => ({ ...current, decorationMethods: event.target.checked ? [...current.decorationMethods, method] : current.decorationMethods.filter((entry) => entry !== method) }))}/>{method}</label>)}</div><div className="sanmar-option-pills"><b>Print size options</b>{PRINT_SIZES.map((size) => <label key={size.id} className={item.printSizes.includes(size.id) ? "selected" : ""}><input type="checkbox" checked={item.printSizes.includes(size.id)} onChange={(event) => updateSetupItem(item.style.styleId, (current) => ({ ...current, printSizes: event.target.checked ? [...current.printSizes, size.id] : current.printSizes.filter((entry) => entry !== size.id) }))}/>{size.label}</label>)}</div></section>
            </> : <section className="sanmar-wizard-section"><header><h3>Available print zones</h3><span>Select every location customers may customize.</span></header><div className="sanmar-zone-tiles">{zones.map((zone) => <label className={item.printLocations.includes(zone) ? "selected" : ""} key={zone}><input type="checkbox" checked={item.printLocations.includes(zone)} onChange={(event) => updateSetupItem(item.style.styleId, (current) => ({ ...current, printLocations: event.target.checked ? [...current.printLocations, zone] : current.printLocations.filter((entry) => entry !== zone) }))}/><span>{zone}</span></label>)}</div>{!item.printLocations.length && <p className="sanmar-inline-error">Choose at least one print zone to continue.</p>}</section>}
          </article>;
        })}
        {message && <div className={`sanmar-wizard-message ${messageType}`}>{message}{messageType === "success" && <Link href="/advanced-admin/products">View products →</Link>}</div>}
        <footer className="sanmar-wizard-footer"><button type="button" className="ae-button" onClick={() => setStep(step === "zones" ? "images" : "catalog")}>← Back</button><span>{step === "images" ? `${setupItems.filter((item) => item.selectedColors.length).length} items have colors selected` : `${setupItems.filter((item) => item.printLocations.length).length} items have print zones selected`}</span>{step === "images" ? <button className="ae-button primary" type="button" disabled={setupItems.some((item) => !item.selectedColors.length)} onClick={() => setStep("zones")}>Next: choose print zones →</button> : <button className="ae-button primary" type="button" disabled={!canImport || importBusy} onClick={() => void importProducts()}>{importBusy ? "Importing…" : `Import ${setupItems.length} product${setupItems.length === 1 ? "" : "s"}`}</button>}</footer>
      </div>
      <style jsx>{`
        .sanmar-wizard{min-height:100vh;background:#f4f6f8;color:#13283d;padding-bottom:40px}.sanmar-wizard-bar{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:15px;padding:12px max(20px,calc((100vw - 1180px)/2));border-bottom:1px solid #dfe4e8;background:rgba(255,255,255,.97);backdrop-filter:blur(14px)}.sanmar-wizard-back{justify-self:start;border:0;background:none;color:#34516a;font:inherit;font-size:12px;font-weight:750;cursor:pointer}.sanmar-wizard-bar nav{display:flex;gap:9px}.sanmar-wizard-bar nav span{padding:8px 11px;border:1px solid #e1e5e9;border-radius:99px;color:#758291;font-size:10px;font-weight:750;white-space:nowrap}.sanmar-wizard-bar nav span.done{border-color:#c9dfd0;background:#f1f8f3;color:#34734a}.sanmar-wizard-bar nav span.active{border-color:#244c6d;background:#edf4f8;color:#1b4261}.sanmar-wizard-bar>:last-child{justify-self:end}.sanmar-wizard-main{width:min(100% - 32px,1060px);margin:0 auto}.sanmar-wizard-title{display:flex;align-items:end;justify-content:space-between;gap:20px;padding:30px 0 17px}.sanmar-wizard-title h1{margin:4px 0;font-size:clamp(26px,4vw,36px);letter-spacing:-.035em}.sanmar-wizard-title p:last-child{margin:0;color:#718091;font-size:13px}.sanmar-wizard-title>span{padding:8px 11px;border-radius:99px;background:#e8eef3;color:#405a70;font-size:11px;font-weight:800;white-space:nowrap}.sanmar-wizard-item{margin:0 0 17px;padding:20px;border:1px solid #dfe5e9;border-radius:16px;background:#fff;box-shadow:0 6px 24px #0e29400a}.sanmar-wizard-item-head{display:flex;align-items:center;gap:12px;padding-bottom:15px;border-bottom:1px solid #edf0f2}.sanmar-wizard-item-head img{width:54px;height:54px;object-fit:contain;border-radius:10px;background:#f2f4f5}.sanmar-wizard-item-head>div{display:grid;gap:3px;min-width:0;flex:1}.sanmar-wizard-item-head span{font-size:9px;color:#718091;text-transform:uppercase;letter-spacing:.06em;font-weight:800}.sanmar-wizard-item-head h2{margin:0;font-size:16px}.sanmar-wizard-item-head small{color:#83909c;font-size:10px}.sanmar-wizard-item-head>b{color:#63768a;font-size:11px;white-space:nowrap}.sanmar-config-fields{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin:15px 0}.sanmar-config-fields label{display:grid;gap:5px}.sanmar-config-fields label span{font-size:10px;font-weight:800;color:#586b7e}.sanmar-config-fields input,.sanmar-config-fields select{width:100%;height:39px;padding:0 10px;border:1px solid #dce3e8;border-radius:9px;background:#fff;color:#183047;font:inherit;font-size:12px}.sanmar-wizard-section{padding:15px 0;border-top:1px solid #edf0f2}.sanmar-wizard-section>header{display:flex;align-items:baseline;justify-content:space-between;gap:14px;margin-bottom:10px}.sanmar-wizard-section>header h3{margin:0;font-size:13px}.sanmar-wizard-section>header span{color:#788694;font-size:10px}.sanmar-wizard-section>header>div{display:flex;gap:12px}.sanmar-wizard-section>header>div button{border:0;background:none;color:#315d7d;font-size:10px;font-weight:800;cursor:pointer}.sanmar-color-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:7px}.sanmar-color-tiles label{display:grid;grid-template-columns:auto 58px 1fr;align-items:center;gap:9px;min-width:0;padding:8px;border:1px solid #e0e5e9;border-radius:10px;cursor:pointer}.sanmar-color-tiles label.selected{border-color:#355c78;background:#f5f9fb;box-shadow:inset 0 0 0 1px #355c78}.sanmar-color-tiles input,.sanmar-option-pills input,.sanmar-zone-tiles input{accent-color:#204a6a}.sanmar-color-tile-images{display:grid!important;grid-template-columns:1fr 1fr;align-items:center;width:58px;height:43px;gap:2px!important;overflow:hidden;border-radius:7px;background:#f2f4f5}.sanmar-color-tile-images img{width:100%;height:100%;min-width:0;object-fit:contain}.sanmar-color-tile-images i{grid-column:1/-1;color:#88939d;font-size:8px;font-style:normal;text-align:center}.sanmar-color-tiles .sanmar-color-tile-copy{display:grid;gap:3px;min-width:0}.sanmar-color-tiles b{font-size:11px}.sanmar-color-tiles small{overflow:hidden;color:#788694;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.sanmar-image-gallery-columns{display:grid;grid-template-columns:1fr 1fr;gap:15px}.sanmar-image-gallery h4{margin:0 0 8px;font-size:11px}.sanmar-image-gallery>div{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:8px}.sanmar-image-gallery button{min-width:0;padding:7px;border:1px solid #dfe5e9;border-radius:10px;background:#fff;color:#172f46;text-align:left;cursor:pointer}.sanmar-image-gallery button.selected{border-color:#285474;box-shadow:0 0 0 2px #28547422}.sanmar-image-gallery button>span{position:relative;display:block;width:100%;aspect-ratio:1;background:#f2f4f5;border-radius:7px;overflow:hidden}.sanmar-image-gallery button img{width:100%;height:100%;object-fit:contain}.sanmar-image-gallery button i{position:absolute;top:5px;right:5px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#1e4969;color:white;font-style:normal;font-size:11px}.sanmar-image-gallery button b,.sanmar-image-gallery button small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sanmar-image-gallery button b{margin-top:6px;font-size:10px}.sanmar-image-gallery button small{margin-top:3px;color:#7c8996;font-size:9px}.sanmar-image-gallery>p{color:#7b8791;font-size:11px}.sanmar-color-image-preview{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:12px;padding-top:11px;border-top:1px solid #edf0f2;color:#65788a;font-size:10px}.sanmar-color-image-preview>div{display:flex;gap:7px}.sanmar-color-image-preview img{width:55px;height:55px;border:1px solid #e1e6e9;border-radius:8px;object-fit:contain;background:#f4f6f7}.sanmar-option-pills{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin-top:9px}.sanmar-option-pills>b{flex:0 0 100%;font-size:10px;color:#576c7f}.sanmar-option-pills label{display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid #dce3e8;border-radius:99px;color:#53687a;font-size:10px;cursor:pointer}.sanmar-option-pills label.selected{border-color:#345a76;background:#eff5f8;color:#234b69}.sanmar-zone-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:9px}.sanmar-zone-tiles label{display:flex;align-items:center;gap:9px;min-height:48px;padding:10px 12px;border:1px solid #dce3e8;border-radius:11px;color:#53687a;font-size:12px;cursor:pointer}.sanmar-zone-tiles label.selected{border-color:#345a76;background:#eff5f8;color:#234b69}.sanmar-inline-error{color:#a23939;font-size:11px}.sanmar-wizard-message{display:flex;justify-content:space-between;gap:15px;margin:12px 0;padding:12px;border-radius:10px;font-size:11px}.sanmar-wizard-message.success{background:#eff8f1;color:#35764b}.sanmar-wizard-message.error{background:#fff0ed;color:#973f32}.sanmar-wizard-message a{color:inherit;font-weight:800}.sanmar-wizard-footer{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #dfe5e9;border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 8px 28px #10203316;backdrop-filter:blur(12px)}.sanmar-wizard-footer>span{color:#718091;font-size:10px}.sanmar-extra-options{padding-bottom:6px}@media(max-width:680px){.sanmar-wizard-bar{grid-template-columns:1fr auto;padding:9px 12px}.sanmar-wizard-bar nav{grid-column:1/-1;grid-row:2;justify-content:center;order:3}.sanmar-wizard-bar nav span{padding:6px 8px;font-size:8px}.sanmar-wizard-bar .sanmar-wizard-back{font-size:10px}.sanmar-wizard-main{width:calc(100% - 18px)}.sanmar-wizard-title{align-items:start;padding-top:22px}.sanmar-wizard-item{padding:13px}.sanmar-wizard-item-head>b{display:none}.sanmar-config-fields{grid-template-columns:1fr 1fr}.sanmar-config-fields label:first-child{grid-column:1/-1}.sanmar-image-gallery-columns{grid-template-columns:1fr}.sanmar-image-gallery>div{grid-template-columns:repeat(auto-fill,minmax(105px,1fr))}.sanmar-wizard-section>header{align-items:flex-start;flex-direction:column;gap:4px}.sanmar-wizard-footer{flex-wrap:wrap}.sanmar-wizard-footer>span{order:3;flex:0 0 100%;text-align:center}.sanmar-wizard-footer>.ae-button{flex:1}}
      `}</style>
    </main>;
  }

  return <div className="sanmar-catalog-flow">
    <div className="sanmar-catalog-main">
      <div className="sanmar-live-banner"><div><i/><div><strong>LIVE SANMAR CATALOG</strong><span>Account {accountHint || "connected"} · choose one or more products to configure before import.</span></div></div><button className="ae-button" disabled={busy} onClick={() => void load({ refresh: true })}>{busy ? "Refreshing…" : "Refresh catalog"}</button></div>
      <div className="sanmar-category-tabs">{["", ...categories].map((item) => <button key={item} className={category === item ? "active" : ""} disabled={busy} onClick={() => switchCategory(item)}><b>{item || "All product types"}</b></button>)}</div>
      <div className="sanmar-toolbar"><label className="sanmar-search"><span>Search {category || "all SanMar products"}</span><div><input value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load()} placeholder="Brand, product name, or style number"/><button className="ae-button primary" onClick={() => void load()}>Search</button></div></label><label className="sanmar-brand-filter"><span>Brand</span><select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{brands.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><button className="ae-button" onClick={() => void load()}>Apply</button></div>
      <div className="sanmar-quick"><span>Popular</span>{QUICK.map((value) => <button key={value} onClick={() => {setQ(value); void load({ search: value });}}>{value}</button>)}</div>
      <div className="sanmar-results-head"><div><strong>{total.toLocaleString()} styles</strong><small>Select items here. Image and print-zone choices happen in the next steps.</small></div>{busy && <span>Loading SanMar…</span>}</div>
      {styles.length ? <div className="sanmar-style-grid">{styles.map((style) => {
        const isSelected = selectedStyles.some((item) => item.styleId === style.styleId);
        const alreadyAdded = importedStyleIds.includes(style.styleId);
        return <button type="button" key={style.styleId} className={`sanmar-style-card${isSelected ? " selected" : ""}`} onClick={() => toggleStyle(style)} aria-pressed={isSelected}>
          <div className="sanmar-style-image">{style.imageUrl ? <img src={style.imageUrl} alt={style.title}/> : <span className="sanmar-image-fallback">SANMAR</span>}<em>{isSelected ? "SELECTED" : alreadyAdded ? "ADDED" : "LIVE"}<i>{isSelected ? "✓" : "+"}</i></em></div>
          <div className="sanmar-style-copy"><span>{style.brandName} · {style.styleId}</span><h3>{style.title}</h3><p>{style.description}</p><footer><small>{style.colorCount} colors</small><small>{style.sizeCount} sizes</small><small>{style.priceMin ? `${money(style.priceMin)}–${money(style.priceMax)}` : "Live pricing"}</small></footer></div>
        </button>;
      })}</div> : !busy && <div className="sanmar-empty"><h3>No products match this search.</h3><p>Try another brand or clear the search.</p></div>}
      {hasMore && <div className="sanmar-load-more"><button className="ae-button" disabled={busy} onClick={() => void load({ append: true })}>{busy ? "Loading…" : "Load more products"}</button></div>}
      <details className="sanmar-exact-fallback"><summary>Know the exact SanMar style number?</summary><div><input value={exactStyle} onChange={(event) => setExactStyle(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && void addExactStyle()} placeholder="Example: K500"/><button className="ae-button" disabled={!exactStyle.trim() || detailBusy} onClick={() => void addExactStyle()}>Add exact style</button></div></details>
      {message && <div className={`sanmar-wizard-message ${messageType}`}>{message}</div>}
    </div>
    <aside className="sanmar-selection-summary"><div><p className="ae-kicker">IMPORT SELECTION</p><h2>{selectedCount} item{selectedCount === 1 ? "" : "s"} selected</h2><p>Choose items in the catalog. Configure colors, images, and print zones on the next pages.</p></div>{selectedStyles.length > 0 ? <ul>{selectedStyles.map((style) => <li key={style.styleId}><span><b>{style.title}</b><small>{style.brandName} · {style.styleId}</small></span><button type="button" aria-label={`Remove ${style.title}`} onClick={() => toggleStyle(style)}>×</button></li>)}</ul> : <div className="sanmar-selection-empty">Your selected products will appear here.</div>}<button className="ae-button primary" type="button" disabled={!selectedCount || detailBusy} onClick={() => void openImageSetup()}>{detailBusy ? "Loading selected items…" : "Next: choose colors & images →"}</button></aside>
    <style jsx>{`
      .sanmar-catalog-flow{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;align-items:start}.sanmar-catalog-main,.sanmar-selection-summary{min-width:0;padding:18px;border:1px solid var(--ae-line);border-radius:16px;background:white}.sanmar-selection-summary{position:sticky;top:16px;display:grid;gap:13px}.sanmar-selection-summary h2{margin:3px 0;font-size:16px}.sanmar-selection-summary p:not(.ae-kicker){margin:4px 0;color:var(--ae-muted);font-size:10px;line-height:1.5}.sanmar-selection-summary ul{display:grid;gap:7px;margin:0;padding:0;list-style:none}.sanmar-selection-summary li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px;border:1px solid var(--ae-line);border-radius:10px}.sanmar-selection-summary li span{display:grid;gap:3px;min-width:0}.sanmar-selection-summary li b,.sanmar-selection-summary li small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sanmar-selection-summary li b{font-size:10px}.sanmar-selection-summary li small{color:var(--ae-muted);font-size:8px}.sanmar-selection-summary li button{border:0;background:none;color:#8d4545;font-size:17px;cursor:pointer}.sanmar-selection-empty{padding:18px 10px;border:1px dashed var(--ae-line);border-radius:10px;color:var(--ae-muted);font-size:10px;text-align:center}.sanmar-selection-summary>.ae-button{width:100%;white-space:normal}.sanmar-catalog-flow .sanmar-style-card{position:relative}.sanmar-catalog-flow .sanmar-style-image em{display:flex;align-items:center;gap:6px}.sanmar-catalog-flow .sanmar-style-image em i{display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:white;color:#142c43;font-style:normal;font-size:13px}.sanmar-catalog-flow .sanmar-style-card.selected{border-color:#183956;box-shadow:0 0 0 2px #18395620}.sanmar-catalog-flow .sanmar-style-copy footer{display:flex;flex-wrap:wrap;gap:8px}.sanmar-catalog-flow .sanmar-style-copy footer small{color:#657588;font-size:9px}
      .sanmar-catalog-flow .sanmar-live-banner{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;padding:12px 14px;border-radius:12px;background:#102b43;color:#fff}
      .sanmar-catalog-flow .sanmar-live-banner>div{display:flex;align-items:center;gap:10px;min-width:0}.sanmar-catalog-flow .sanmar-live-banner>div>div{display:grid;gap:3px}.sanmar-catalog-flow .sanmar-live-banner i{width:8px;height:8px;border-radius:50%;background:#56c986}.sanmar-catalog-flow .sanmar-live-banner strong{font-size:9px;letter-spacing:.08em}.sanmar-catalog-flow .sanmar-live-banner span{font-size:9px;opacity:.75}
      .sanmar-catalog-flow .sanmar-category-tabs{display:flex;gap:7px;margin:0 0 12px;overflow:auto}.sanmar-catalog-flow .sanmar-category-tabs button{flex:0 0 auto;padding:9px 11px;border:1px solid var(--ae-line);border-radius:10px;background:#fff;color:var(--ae-muted);font-size:10px;cursor:pointer}.sanmar-catalog-flow .sanmar-category-tabs button.active{border-color:#183956;background:#183956;color:#fff}
      .sanmar-catalog-flow .sanmar-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 180px auto;gap:9px;align-items:end;margin-bottom:10px}.sanmar-catalog-flow .sanmar-search,.sanmar-catalog-flow .sanmar-brand-filter{display:grid;gap:5px;min-width:0}.sanmar-catalog-flow .sanmar-search>span,.sanmar-catalog-flow .sanmar-brand-filter>span{font-size:9px;font-weight:800;color:#52677b}.sanmar-catalog-flow .sanmar-search>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.sanmar-catalog-flow .sanmar-search input,.sanmar-catalog-flow .sanmar-brand-filter select,.sanmar-catalog-flow .sanmar-exact-fallback input{height:39px;min-width:0;padding:0 10px;border:1px solid var(--ae-line);border-radius:9px;background:#fff;color:#172b3f;font:inherit;font-size:11px}
      .sanmar-catalog-flow .sanmar-quick{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding-bottom:11px;border-bottom:1px solid #edf0f2}.sanmar-catalog-flow .sanmar-quick>span{color:#718091;font-size:9px;font-weight:800;text-transform:uppercase}.sanmar-catalog-flow .sanmar-quick button{padding:6px 9px;border:1px solid var(--ae-line);border-radius:99px;background:white;color:#35526b;font-size:9px}
      .sanmar-catalog-flow .sanmar-results-head{display:flex;justify-content:space-between;gap:12px;padding:14px 0 10px}.sanmar-catalog-flow .sanmar-results-head>div{display:grid;gap:3px}.sanmar-catalog-flow .sanmar-results-head strong{font-size:13px}.sanmar-catalog-flow .sanmar-results-head small,.sanmar-catalog-flow .sanmar-results-head>span{color:#718091;font-size:9px}
      .sanmar-catalog-flow .sanmar-style-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.sanmar-catalog-flow .sanmar-style-card{min-width:0;padding:0;overflow:hidden;border:1px solid var(--ae-line);border-radius:12px;background:white;color:#172b3f;text-align:left;cursor:pointer}.sanmar-catalog-flow .sanmar-style-card:hover{border-color:#55728b}.sanmar-catalog-flow .sanmar-style-image{position:relative;display:grid;place-items:center;width:100%;aspect-ratio:1.15;background:#f4f5f6;overflow:hidden}.sanmar-catalog-flow .sanmar-style-image img{width:100%;height:100%;object-fit:contain}.sanmar-catalog-flow .sanmar-style-image em{position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:5px;padding:4px 6px;border-radius:99px;background:#eaf4ee;color:#35754a;font-size:8px;font-style:normal;font-weight:900}.sanmar-catalog-flow .sanmar-style-image em i{display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:white;color:#142c43;font-style:normal;font-size:12px}.sanmar-catalog-flow .sanmar-style-copy{display:grid;gap:4px;padding:10px}.sanmar-catalog-flow .sanmar-style-copy>span{color:#6e7e8e;font-size:8px;font-weight:800;text-transform:uppercase}.sanmar-catalog-flow .sanmar-style-copy h3{margin:0;font-size:12px;line-height:1.3}.sanmar-catalog-flow .sanmar-style-copy p{display:-webkit-box;min-height:26px;margin:0;overflow:hidden;color:#7a8793;font-size:9px;line-height:1.4;-webkit-line-clamp:2;-webkit-box-orient:vertical}.sanmar-catalog-flow .sanmar-style-copy footer{display:flex;flex-wrap:wrap;gap:7px;margin-top:4px}.sanmar-catalog-flow .sanmar-style-copy footer small{color:#657588;font-size:8px}.sanmar-catalog-flow .sanmar-exact-fallback{margin-top:14px;padding-top:12px;border-top:1px solid #edf0f2}.sanmar-catalog-flow .sanmar-exact-fallback summary{color:#35526b;font-size:10px;font-weight:800;cursor:pointer}.sanmar-catalog-flow .sanmar-exact-fallback>div{display:flex;gap:8px;margin-top:9px}.sanmar-catalog-flow .sanmar-empty{padding:35px;text-align:center;color:#738292}
      @media(max-width:900px){.sanmar-catalog-flow{grid-template-columns:1fr}.sanmar-selection-summary{position:static;order:-1}.sanmar-selection-summary ul{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}.sanmar-selection-summary>div:first-child{display:grid;grid-template-columns:1fr auto;align-items:center}.sanmar-selection-summary>div:first-child p:not(.ae-kicker){grid-column:1/-1}}@media(max-width:620px){.sanmar-catalog-main,.sanmar-selection-summary{padding:12px}.sanmar-selection-summary>div:first-child{display:block}}
    `}</style>
  </div>;
}
