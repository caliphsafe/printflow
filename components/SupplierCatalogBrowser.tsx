"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LiveStyle = {
  styleId: string;
  brandName: string;
  styleName: string;
  title: string;
  description: string;
  partNumber: string;
  category: string;
  imageUrl: string;
};

type LiveProduct = {
  sku: string;
  skuId: string;
  gtin: string;
  styleId: string;
  brandName: string;
  styleName: string;
  colorName: string;
  sizeName: string;
  sizeOrder: string;
  customerPrice: number;
  quantity: number;
  colorHex: string;
  swatchImageUrl: string;
  frontImageUrl: string;
  backImageUrl: string;
  sideImageUrl: string;
};

type DemoVariant = {
  id: string;
  sku: string;
  color_name: string;
  color_hex: string;
  size_name: string;
  wholesale_price: number;
  inventory_quantity: number;
  image_front_url?: string;
  image_back_url?: string;
};

type DemoStyle = {
  id: string;
  provider: string;
  supplier_name: string;
  brand_name: string;
  style_name: string;
  title: string;
  description?: string;
  category: string;
  part_number?: string;
  image_front_url?: string;
  image_back_url?: string;
  source_mode: string;
  supplier_catalog_variants: DemoVariant[];
};

type Props = { connected: boolean; accountHint?: string | null };
type Mode = "live" | "demo";

type ColorSummary = {
  name: string;
  colorHex: string;
  swatchImageUrl: string;
  frontImageUrl: string;
  backImageUrl: string;
  sizeCount: number;
  inventory: number;
  priceMin: number;
  priceMax: number;
};

const QUICK_SEARCHES = ["Gildan 5000", "Bella + Canvas 3001", "Comfort Colors 1717", "hoodie", "polo"];

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

export default function SupplierCatalogBrowser({ connected, accountHint }: Props) {
  const [mode, setMode] = useState<Mode>(connected ? "live" : "demo");
  const [liveStyles, setLiveStyles] = useState<LiveStyle[]>([]);
  const [demoStyles, setDemoStyles] = useState<DemoStyle[]>([]);
  const [selectedLive, setSelectedLive] = useState<LiveStyle | null>(null);
  const [selectedDemo, setSelectedDemo] = useState<DemoStyle | null>(null);
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [importedProductId, setImportedProductId] = useState<string | null>(null);

  async function loadLive(options?: { append?: boolean; search?: string; brand?: string; category?: string; refresh?: boolean }) {
    if (!connected) return;
    const append = options?.append === true;
    const searchValue = options?.search ?? q;
    const brandValue = options?.brand ?? brand;
    const categoryValue = options?.category ?? category;
    const offset = append ? liveStyles.length : 0;
    setCatalogBusy(true);
    setMessage("");
    const params = new URLSearchParams({ q: searchValue, brand: brandValue, category: categoryValue, offset: String(offset), limit: "36" });
    if (options?.refresh) params.set("refresh", "1");
    try {
      const response = await fetch(`/api/admin/suppliers/ss/styles?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load the S&S catalog.");
      setLiveStyles((current) => append ? [...current, ...(data.styles || [])] : (data.styles || []));
      setBrands(data.brands || []);
      setCategories(data.categories || []);
      setTotal(Number(data.total || 0));
      setHasMore(data.hasMore === true);
      if (!append) {
        setSelectedLive(null);
        setProducts([]);
        setSelectedColors([]);
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Unable to load the S&S catalog.");
    } finally {
      setCatalogBusy(false);
    }
  }

  async function loadDemo(search = q) {
    setCatalogBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/suppliers/catalog?q=${encodeURIComponent(search)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load demo products.");
      setDemoStyles(data.styles || []);
      setSelectedDemo(null);
      setSelectedColors([]);
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Unable to load demo products.");
    } finally {
      setCatalogBusy(false);
    }
  }

  useEffect(() => {
    if (mode === "live" && connected) void loadLive();
    if (mode === "demo") void loadDemo("");
    // The mode switch intentionally triggers a fresh supplier view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, connected]);

  async function chooseLive(style: LiveStyle) {
    setSelectedLive(style);
    setProducts([]);
    setSelectedColors([]);
    setImportedProductId(null);
    setMessage("");
    setDetailBusy(true);
    try {
      const response = await fetch(`/api/admin/suppliers/ss/style/${encodeURIComponent(style.styleId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load S&S colors and sizes.");
      const rows: LiveProduct[] = data.products || [];
      setProducts(rows);
      setSelectedColors(Array.from(new Set(rows.map((item) => item.colorName))));
      if (!rows.length) {
        setMessageType("info");
        setMessage("S&S returned no active SKUs for this style.");
      }
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Unable to load this S&S product.");
    } finally {
      setDetailBusy(false);
    }
  }

  function chooseDemo(style: DemoStyle) {
    setSelectedDemo(style);
    setSelectedColors(Array.from(new Set(style.supplier_catalog_variants.map((variant) => variant.color_name))));
    setImportedProductId(null);
    setMessage("");
  }

  const liveColors = useMemo<ColorSummary[]>(() => {
    const groups = new Map<string, LiveProduct[]>();
    for (const product of products) groups.set(product.colorName, [...(groups.get(product.colorName) || []), product]);
    return Array.from(groups.entries()).map(([name, variants]) => {
      const sample = variants.find((item) => item.frontImageUrl) || variants[0];
      const prices = variants.map((item) => item.customerPrice).filter((value) => value > 0);
      return {
        name,
        colorHex: sample?.colorHex || "#777777",
        swatchImageUrl: sample?.swatchImageUrl || "",
        frontImageUrl: sample?.frontImageUrl || "",
        backImageUrl: sample?.backImageUrl || "",
        sizeCount: new Set(variants.map((item) => item.sizeName)).size,
        inventory: variants.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0),
        priceMin: prices.length ? Math.min(...prices) : 0,
        priceMax: prices.length ? Math.max(...prices) : 0
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const demoColors = useMemo(() => {
    if (!selectedDemo) return [];
    return Array.from(new Map(selectedDemo.supplier_catalog_variants.map((variant) => [variant.color_name, variant])).values());
  }, [selectedDemo]);

  async function importLiveProduct() {
    if (!selectedLive || !products.length || !selectedColors.length) return;
    setImportBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/suppliers/ss/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products, selectedColors, style: selectedLive })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to import this S&S product.");
      setImportedProductId(data.product?.id || "imported");
      setMessageType("success");
      setMessage(`${selectedLive.brandName} ${selectedLive.styleName} was imported into Products.`);
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Unable to import this S&S product.");
    } finally {
      setImportBusy(false);
    }
  }

  async function importDemoProduct() {
    if (!selectedDemo || !selectedColors.length) return;
    setImportBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/suppliers/import-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: selectedDemo.id, selectedColors })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Demo import failed.");
      setImportedProductId(data.product?.id || "imported");
      setMessageType("success");
      setMessage("Demo garment imported into Products.");
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Demo import failed.");
    } finally {
      setImportBusy(false);
    }
  }

  function submitSearch() {
    if (mode === "live") void loadLive();
    else void loadDemo(q);
  }

  const activeLive = mode === "live";
  const selected = activeLive ? selectedLive : selectedDemo;

  return <div className="supplier-live-workspace">
    <section className="admin-card supplier-live-main">
      <div className="supplier-source-tabs" role="tablist" aria-label="Supplier catalog source">
        <button type="button" role="tab" aria-selected={activeLive} className={activeLive ? "active" : ""} disabled={!connected} onClick={() => setMode("live")}>
          <span className="source-status live" />
          <span><strong>S&amp;S live catalog</strong><small>{connected ? `Connected${accountHint ? ` · ${accountHint}` : ""}` : "Connect S&S to enable"}</small></span>
        </button>
        <button type="button" role="tab" aria-selected={!activeLive} className={!activeLive ? "active" : ""} onClick={() => setMode("demo")}>
          <span className="source-status demo" />
          <span><strong>Demo catalog</strong><small>Interface testing only</small></span>
        </button>
      </div>

      {activeLive ? <div className="live-catalog-banner">
        <div><span className="live-pulse" /><div><strong>Live S&amp;S Activewear data</strong><p>Styles come directly from S&amp;S. Exact wholesale prices, color images, sizes, SKUs, and inventory load when you select a style.</p></div></div>
        <button type="button" className="text-button" disabled={catalogBusy} onClick={() => loadLive({ refresh: true })}>Refresh catalog</button>
      </div> : <div className="demo-mode-banner"><strong>Demo catalog mode</strong><span>Local sample products remain available only for safe interface testing. They cannot place a supplier order.</span></div>}

      <div className="supplier-live-toolbar">
        <div className="supplier-live-search">
          <label htmlFor="supplier-catalog-search">Search garments</label>
          <div><input id="supplier-catalog-search" value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitSearch()} placeholder={activeLive ? "Brand, style, product name, or part number" : "Search demo products"} /><button type="button" className="primary-button" disabled={catalogBusy} onClick={submitSearch}>{catalogBusy ? "Loading…" : "Search"}</button></div>
        </div>
        {activeLive && <div className="supplier-filter-row">
          <label><span>Brand</span><select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button type="button" className="secondary-button" disabled={catalogBusy} onClick={() => loadLive()}>Apply filters</button>
        </div>}
      </div>

      {activeLive && <div className="supplier-quick-searches"><span>Popular searches</span>{QUICK_SEARCHES.map((item) => <button type="button" key={item} onClick={() => { setQ(item); void loadLive({ search: item }); }}>{item}</button>)}</div>}

      <div className="supplier-results-heading">
        <div><strong>{activeLive ? `${total.toLocaleString()} matching S&S styles` : `${demoStyles.length} demo styles`}</strong><small>{activeLive ? "Select a style to load live colors, costs, and availability." : "Select a sample style to test importing."}</small></div>
        {catalogBusy && <span className="catalog-loading-state">Updating catalog…</span>}
      </div>

      {!catalogBusy && activeLive && !liveStyles.length && <div className="empty-state supplier-catalog-empty"><h3>No S&amp;S styles found</h3><p>Try a broader search such as Gildan, Bella, T-shirt, hoodie, or a supplier part number.</p></div>}

      <div className="supplier-live-grid">
        {(activeLive ? liveStyles : demoStyles).map((raw) => {
          if (activeLive) {
            const style = raw as LiveStyle;
            return <button type="button" className={selectedLive?.styleId === style.styleId ? "supplier-live-card selected" : "supplier-live-card"} key={style.styleId} onClick={() => chooseLive(style)}>
              <div className="supplier-live-card-image">{style.imageUrl ? <img src={style.imageUrl} alt={`${style.brandName} ${style.styleName}`} /> : <div className="supplier-image-fallback">S&amp;S</div>}<span className="live-data-chip">LIVE</span></div>
              <div className="supplier-live-card-copy"><span>{style.brandName}</span><h3>{style.styleName}</h3><p>{style.title}</p><div><small>{style.category}</small><small>{style.partNumber || `Style ${style.styleId}`}</small></div></div>
            </button>;
          }
          const style = raw as DemoStyle;
          return <button type="button" className={selectedDemo?.id === style.id ? "supplier-live-card selected" : "supplier-live-card"} key={style.id} onClick={() => chooseDemo(style)}>
            <div className="supplier-live-card-image"><img src={style.image_front_url || "/demo-blanks/core-tee-front.svg"} alt={`${style.brand_name} ${style.style_name}`} /><span className="demo-chip">DEMO</span></div>
            <div className="supplier-live-card-copy"><span>{style.brand_name}</span><h3>{style.style_name}</h3><p>{style.title}</p><div><small>{style.category}</small><small>{style.part_number || "Sample"}</small></div></div>
          </button>;
        })}
      </div>

      {activeLive && hasMore && <div className="supplier-load-more"><button type="button" className="secondary-button" disabled={catalogBusy} onClick={() => loadLive({ append: true })}>{catalogBusy ? "Loading…" : `Load more styles (${liveStyles.length} of ${total})`}</button></div>}
    </section>

    <aside className="admin-card supplier-live-inspector">
      {!selected ? <div className="empty-state supplier-inspector-empty"><div className="supplier-inspector-icon">↗</div><h3>Choose a blank garment</h3><p>Select any style to review its available colors, size SKUs, wholesale costs, inventory, and garment imagery before importing it.</p></div> : activeLive ? <>
        <div className="supplier-inspector-heading"><div><p className="eyebrow">S&amp;S ACTIVEWEAR · LIVE</p><h2>{selectedLive?.brandName} {selectedLive?.styleName}</h2><p>{selectedLive?.title}</p></div><span className="status-pill connected">Live</span></div>
        <dl className="supplier-facts live-facts"><div><dt>Category</dt><dd>{selectedLive?.category || "Apparel"}</dd></div><div><dt>Part number</dt><dd>{selectedLive?.partNumber || "—"}</dd></div><div><dt>Style ID</dt><dd>{selectedLive?.styleId}</dd></div></dl>

        {detailBusy ? <div className="supplier-detail-loading"><span /><strong>Loading live colors and inventory…</strong><small>This request comes directly from your connected S&amp;S account.</small></div> : <>
          {!!liveColors.length && <div className="supplier-color-toolbar"><div><h3>Choose colors to import</h3><p>{selectedColors.length} of {liveColors.length} selected</p></div><div><button type="button" className="text-button" onClick={() => setSelectedColors(liveColors.map((item) => item.name))}>Select all</button><button type="button" className="text-button" onClick={() => setSelectedColors([])}>Clear</button></div></div>}
          <div className="supplier-live-color-list">{liveColors.map((color) => <label key={color.name} className={selectedColors.includes(color.name) ? "supplier-live-color selected" : "supplier-live-color"}>
            <input type="checkbox" checked={selectedColors.includes(color.name)} onChange={(event) => setSelectedColors(event.target.checked ? [...selectedColors, color.name] : selectedColors.filter((item) => item !== color.name))} />
            <div className="supplier-live-color-images">{color.frontImageUrl ? <img src={color.frontImageUrl} alt={`${color.name} front`} /> : <span style={{ background: color.colorHex }} />}{color.backImageUrl ? <img src={color.backImageUrl} alt={`${color.name} back`} /> : null}</div>
            <div className="supplier-live-color-copy"><div><span className="color-dot" style={{ background: color.colorHex }} /><strong>{color.name}</strong></div><small>{color.sizeCount} sizes · {color.inventory.toLocaleString()} units available</small><small>{color.priceMin === color.priceMax ? money(color.priceMin) : `${money(color.priceMin)}–${money(color.priceMax)}`} wholesale</small></div>
          </label>)}</div>
          {!!liveColors.length && <div className="supplier-import-footer"><div><strong>{selectedColors.length} colors</strong><small>{products.filter((item) => selectedColors.includes(item.colorName)).length} exact supplier SKUs will be imported</small></div><button type="button" className="primary-button" disabled={importBusy || !selectedColors.length} onClick={importLiveProduct}>{importBusy ? "Importing…" : "Import selected colors"}</button></div>}
        </>}
      </> : <>
        <div className="supplier-inspector-heading"><div><p className="eyebrow">DEMO SUPPLIER</p><h2>{selectedDemo?.brand_name} {selectedDemo?.style_name}</h2><p>{selectedDemo?.description || selectedDemo?.title}</p></div><span className="status-pill">Demo</span></div>
        <div className="supplier-dual-preview"><figure><img src={selectedDemo?.image_front_url || ""} alt="Front" /><figcaption>Front</figcaption></figure><figure><img src={selectedDemo?.image_back_url || ""} alt="Back" /><figcaption>Back</figcaption></figure></div>
        <dl className="supplier-facts"><div><dt>Supplier</dt><dd>{selectedDemo?.supplier_name}</dd></div><div><dt>Part number</dt><dd>{selectedDemo?.part_number || "—"}</dd></div><div><dt>Source</dt><dd>Demo data</dd></div></dl>
        <div className="supplier-color-toolbar"><div><h3>Choose colors to import</h3><p>{selectedColors.length} selected</p></div></div>
        <div className="supplier-color-checks">{demoColors.map((variant) => <label key={variant.color_name}><input type="checkbox" checked={selectedColors.includes(variant.color_name)} onChange={(event) => setSelectedColors(event.target.checked ? [...selectedColors, variant.color_name] : selectedColors.filter((item) => item !== variant.color_name))} /><span className="color-dot" style={{ background: variant.color_hex }} /><span><strong>{variant.color_name}</strong><small>{selectedDemo?.supplier_catalog_variants.filter((item) => item.color_name === variant.color_name).length} sizes</small></span></label>)}</div>
        <button type="button" className="primary-button full-button" disabled={importBusy || !selectedColors.length} onClick={importDemoProduct}>{importBusy ? "Importing…" : "Import demo colors"}</button>
      </>}

      {message && <div className={`${messageType === "success" ? "success-message" : messageType === "error" ? "error-message" : "catalog-info-message"} catalog-message`}>{message}{messageType === "success" && importedProductId && <Link href="/dashboard/products">Open Products →</Link>}</div>}
    </aside>
  </div>;
}
