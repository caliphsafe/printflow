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
  customerPrice: number;
  quantity: number;
  colorHex: string;
  swatchImageUrl: string;
  frontImageUrl: string;
  backImageUrl: string;
  sideImageUrl: string;
};

type ColorSummary = {
  name: string;
  colorHex: string;
  frontImageUrl: string;
  backImageUrl: string;
  sizeCount: number;
  inventory: number;
  priceMin: number;
  priceMax: number;
};

type Props = {
  connected: boolean;
  accountHint?: string | null;
  targetBusiness?: "print" | "brand";
};

const QUICK = ["Gildan 5000", "Bella + Canvas 3001", "Comfort Colors 1717", "hoodie", "polo"];
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

export default function SupplierCatalogBrowser({ connected, accountHint, targetBusiness = "print" }: Props) {
  const brandTarget = targetBusiness === "brand";
  const [styles, setStyles] = useState<LiveStyle[]>([]);
  const [selected, setSelected] = useState<LiveStyle | null>(null);
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"success" | "error" | "info">("info");

  async function load(options?: { append?: boolean; search?: string; refresh?: boolean }) {
    if (!connected) return;
    const append = options?.append === true;
    setBusy(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        q: options?.search ?? q,
        brand,
        category,
        offset: String(append ? styles.length : 0),
        limit: "36"
      });
      if (options?.refresh) params.set("refresh", "1");

      const response = await fetch(`/api/admin/suppliers/ss/styles?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load the live S&S catalog.");

      setStyles((current) => append ? [...current, ...(data.styles || [])] : data.styles || []);
      setBrands(data.brands || []);
      setCategories(data.categories || []);
      setTotal(Number(data.total || 0));
      setHasMore(data.hasMore === true);

      if (!append) {
        setSelected(null);
        setProducts([]);
        setSelectedColors([]);
      }
    } catch (caught) {
      setType("error");
      setMessage(caught instanceof Error ? caught.message : "Unable to load the live catalog.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (connected) void load({ search: "" });
  }, [connected]);

  async function choose(style: LiveStyle) {
    setSelected(style);
    setProducts([]);
    setSelectedColors([]);
    setMessage("");
    setDetailBusy(true);

    try {
      const response = await fetch(`/api/admin/suppliers/ss/style/${encodeURIComponent(style.styleId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load this style.");

      const rows: LiveProduct[] = data.products || [];
      setProducts(rows);
      setSelectedColors(Array.from(new Set(rows.map((item) => item.colorName))));

      if (!rows.length) {
        setType("info");
        setMessage("S&S returned no active SKUs for this style.");
      }
    } catch (caught) {
      setType("error");
      setMessage(caught instanceof Error ? caught.message : "Unable to load this style.");
    } finally {
      setDetailBusy(false);
    }
  }

  const colors = useMemo<ColorSummary[]>(() => {
    const groups = new Map<string, LiveProduct[]>();
    products.forEach((row) => groups.set(row.colorName, [...(groups.get(row.colorName) || []), row]));

    return Array.from(groups.entries())
      .map(([name, rows]) => {
        const sample = rows.find((item) => item.frontImageUrl) || rows[0];
        const prices = rows.map((item) => item.customerPrice).filter((value) => value > 0);
        return {
          name,
          colorHex: sample?.colorHex || "#777777",
          frontImageUrl: sample?.frontImageUrl || "",
          backImageUrl: sample?.backImageUrl || "",
          sizeCount: new Set(rows.map((item) => item.sizeName)).size,
          inventory: rows.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0),
          priceMin: prices.length ? Math.min(...prices) : 0,
          priceMax: prices.length ? Math.max(...prices) : 0
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  async function importProduct() {
    if (!selected || !products.length || !selectedColors.length) return;
    setImportBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/suppliers/ss/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products,
          selectedColors,
          style: selected,
          targetBusiness
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to import this product.");

      setType("success");
      setMessage(
        brandTarget
          ? `${selected.brandName} ${selected.styleName} was added to the Brand garment library without publishing it to the Print Shop.`
          : `${selected.brandName} ${selected.styleName} was imported into Print Shop Products.`
      );
    } catch (caught) {
      setType("error");
      setMessage(caught instanceof Error ? caught.message : "Unable to import this product.");
    } finally {
      setImportBusy(false);
    }
  }

  if (!connected) {
    return (
      <section className="admin-card supplier-catalog-connect-state">
        <span>S&amp;S</span>
        <h2>Connect S&amp;S to open the live catalog.</h2>
        <p>{brandTarget ? "The Brand business can source its own garment library from the connected supplier account." : "Connect the Print Shop’s approved supplier account to browse live garments."}</p>
        <Link className="primary-button" href="/dashboard/suppliers#ss-settings">Connect S&amp;S Activewear</Link>
      </section>
    );
  }

  return (
    <div className={`supplier-live-workspace ${brandTarget ? "brand-target" : "print-target"}`}>
      <section className="admin-card supplier-live-main">
        <div className="live-catalog-banner">
          <div>
            <i className="live-pulse" />
            <div>
              <strong>{brandTarget ? "Brand sourcing · Live S&S catalog" : "Print sourcing · Live S&S catalog"}</strong>
              <p>Authenticated account {accountHint || "connected"} · wholesale prices, images, SKUs, and inventory come from S&amp;S.</p>
            </div>
          </div>
          <button className="secondary-button" disabled={busy} onClick={() => load({ refresh: true })}>{busy ? "Refreshing…" : "Refresh catalog"}</button>
        </div>

        {brandTarget && (
          <div className="business-target-note">
            <strong>Adding here creates a Brand source garment only.</strong>
            <span>It will not be published in Print Shop Products or the custom-order storefront.</span>
          </div>
        )}

        <div className="supplier-live-toolbar">
          <div className="supplier-live-search">
            <label>Search live products</label>
            <div>
              <input value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void load()} placeholder="Brand, style number, title, or part number" />
              <button className="primary-button" onClick={() => load()}>Search</button>
            </div>
          </div>

          <div className="supplier-filter-row">
            <label><span>Brand</span><select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="">All brands</option>{brands.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
            <button className="secondary-button" onClick={() => load()}>Apply filters</button>
          </div>
        </div>

        <div className="supplier-quick-searches">
          <span>Popular searches</span>
          {QUICK.map((value) => <button key={value} onClick={() => { setQ(value); void load({ search: value }); }}>{value}</button>)}
        </div>

        <div className="supplier-results-heading">
          <div><strong>{total.toLocaleString()} live styles</strong><small>Select a style to load exact color and size variants.</small></div>
          {busy && <span className="catalog-loading-state">Loading…</span>}
        </div>

        {styles.length ? (
          <div className="supplier-live-grid">
            {styles.map((style) => (
              <button key={style.styleId} className={selected?.styleId === style.styleId ? "supplier-live-card selected" : "supplier-live-card"} onClick={() => choose(style)}>
                <div className="supplier-live-card-image">
                  {style.imageUrl ? <img src={style.imageUrl} alt={style.title} /> : <div className="supplier-image-fallback">S&amp;S</div>}
                  <span className="live-data-chip">LIVE</span>
                </div>
                <div className="supplier-live-card-copy">
                  <span>{style.brandName} · {style.styleName}</span>
                  <h3>{style.title}</h3>
                  <p>{style.description}</p>
                  <div><small>{style.category}</small><small>{style.partNumber}</small></div>
                </div>
              </button>
            ))}
          </div>
        ) : !busy && <div className="supplier-catalog-empty"><h3>No live styles match this search.</h3><p>Try a brand, style number, garment type, or clear the filters.</p></div>}

        {hasMore && <div className="supplier-load-more"><button className="secondary-button" disabled={busy} onClick={() => load({ append: true })}>{busy ? "Loading…" : "Load more products"}</button></div>}
      </section>

      <aside className="admin-card supplier-live-inspector">
        {!selected ? (
          <div className="supplier-inspector-empty">
            <div className="supplier-inspector-icon">↗</div>
            <h2>Select a live style</h2>
            <p>Colors, front/back images, wholesale costs, inventory, sizes, and exact SKUs will load here.</p>
          </div>
        ) : (
          <>
            <div className="supplier-inspector-heading">
              <div><p className="eyebrow">LIVE S&amp;S PRODUCT</p><h2>{selected.brandName} {selected.styleName}</h2><p>{selected.title}</p></div>
              <span className="status-pill connected">Live</span>
            </div>

            <dl className="supplier-facts live-facts">
              <div><dt>Category</dt><dd>{selected.category || "Apparel"}</dd></div>
              <div><dt>Part number</dt><dd>{selected.partNumber || "—"}</dd></div>
              <div><dt>Style ID</dt><dd>{selected.styleId}</dd></div>
            </dl>

            {detailBusy ? (
              <div className="supplier-detail-loading"><span /><strong>Loading live colors and inventory…</strong><small>Direct from your S&amp;S account.</small></div>
            ) : (
              <>
                <div className="supplier-color-toolbar">
                  <div><h3>Choose colors to add</h3><p>{selectedColors.length} of {colors.length} selected</p></div>
                  <div><button className="text-button" onClick={() => setSelectedColors(colors.map((item) => item.name))}>Select all</button><button className="text-button" onClick={() => setSelectedColors([])}>Clear</button></div>
                </div>

                <div className="supplier-live-color-list">
                  {colors.map((color) => (
                    <label key={color.name} className={selectedColors.includes(color.name) ? "supplier-live-color selected" : "supplier-live-color"}>
                      <input type="checkbox" checked={selectedColors.includes(color.name)} onChange={(event) => setSelectedColors(event.target.checked ? [...selectedColors, color.name] : selectedColors.filter((value) => value !== color.name))} />
                      <div className="supplier-live-color-images">
                        {color.frontImageUrl ? <img src={color.frontImageUrl} alt={`${color.name} front`} /> : <span style={{ background: color.colorHex }} />}
                        {color.backImageUrl && <img src={color.backImageUrl} alt={`${color.name} back`} />}
                      </div>
                      <div className="supplier-live-color-copy">
                        <div><span className="color-dot" style={{ background: color.colorHex }} /><strong>{color.name}</strong></div>
                        <small>{color.sizeCount} sizes · {color.inventory.toLocaleString()} units</small>
                        <small>{color.priceMin === color.priceMax ? money(color.priceMin) : `${money(color.priceMin)}–${money(color.priceMax)}`} wholesale</small>
                      </div>
                    </label>
                  ))}
                </div>

                {colors.length > 0 && (
                  <div className="supplier-import-footer">
                    <div><strong>{selectedColors.length} colors</strong><small>{products.filter((item) => selectedColors.includes(item.colorName)).length} exact SKUs</small></div>
                    <button className="primary-button" disabled={importBusy || !selectedColors.length} onClick={importProduct}>
                      {importBusy ? "Adding…" : brandTarget ? "Add to Brand Garments" : "Import to Print Products"}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {message && (
          <div className={`${type === "success" ? "success-message" : type === "error" ? "error-message" : "catalog-info-message"} catalog-message`}>
            {message}
            {type === "success" && <Link href={brandTarget ? "/dashboard/brand-garments" : "/dashboard/products"}>{brandTarget ? "Brand Garments →" : "Print Products →"}</Link>}
          </div>
        )}
      </aside>

      <style jsx>{`
        .business-target-note{display:grid;gap:2px;margin:10px 0;padding:9px 11px;border-radius:9px;background:#eef1f9;border:1px solid #d7deef}.business-target-note strong{font-size:9px}.business-target-note span{font-size:7px;color:#67708a}
      `}</style>
    </div>
  );
}
