"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readApiResponse } from "@/lib/client-api-response";

type SupplierKey = "ss" | "sanmar";

type SupplierState = {
  connected: boolean;
  accountHint?: string | null;
  lastTestedAt?: string | null;
};

type Props = {
  suppliers: Record<SupplierKey, SupplierState>;
  targetBusiness?: "print" | "brand";
};

type Style = {
  styleId: string;
  brandName: string;
  styleName?: string;
  title: string;
  description: string;
  partNumber?: string;
  category: string;
  imageUrl: string;
  colorCount?: number;
  sizeCount?: number;
  priceMin?: number;
  priceMax?: number;
  supplier: SupplierKey;
};

type Product = {
  sku: string;
  skuId?: string;
  gtin?: string;
  styleId: string;
  brandName: string;
  styleName: string;
  colorName: string;
  sizeName: string;
  customerPrice: number;
  quantity: number;
  colorHex: string;
  swatchImageUrl?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  sideImageUrl?: string;
  supplier: SupplierKey;
};

type ColorSummary = {
  name: string;
  colorHex: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  swatchImageUrl?: string;
  sizeCount: number;
  inventory: number;
  priceMin: number;
  priceMax: number;
};

const QUICK = [
  "Gildan 5000",
  "Bella + Canvas 3001",
  "Comfort Colors 1717",
  "polo",
  "hat"
];

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);

const supplierLabel = (supplier: SupplierKey) =>
  supplier === "sanmar" ? "SanMar" : "S&S Activewear";

export default function SupplierCatalogBrowser({
  suppliers,
  targetBusiness = "print"
}: Props) {
  const [supplier, setSupplier] = useState<SupplierKey>(
    suppliers.sanmar.connected ? "sanmar" : "ss"
  );
  const [styles, setStyles] = useState<Style[]>([]);
  const [selected, setSelected] = useState<Style | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
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
  const [messageType, setMessageType] =
    useState<"success" | "error" | "info">("info");

  const connected = suppliers[supplier].connected;

  const connectedSuppliers = useMemo(
    () =>
      (["sanmar", "ss"] as SupplierKey[]).filter(
        (key) => suppliers[key].connected
      ),
    [suppliers]
  );

  function switchSupplier(next: SupplierKey) {
    if (next === supplier) return;

    setSupplier(next);
    setQ("");
    setBrand("");
    setCategory("");
    setStyles([]);
    setSelected(null);
    setProducts([]);
    setSelectedColors([]);
    setBrands([]);
    setCategories([]);
    setTotal(0);
    setHasMore(false);
    setMessage("");
  }

  async function load(options?: {
    append?: boolean;
    search?: string;
    refresh?: boolean;
  }) {
    if (!connected) return;

    const append = options?.append === true;
    setBusy(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        supplier,
        q: options?.search ?? q,
        brand,
        category,
        offset: String(append ? styles.length : 0),
        limit: "36"
      });

      if (options?.refresh) params.set("refresh", "1");

      const response = await fetch(
        `/api/admin/suppliers/catalog?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Unable to load the ${supplierLabel(supplier)} catalog.`
        );
      }

      setStyles((current) =>
        append ? [...current, ...(data.styles || [])] : data.styles || []
      );
      setBrands(data.brands || []);
      setCategories(data.categories || []);
      setTotal(Number(data.total || 0));
      setHasMore(data.hasMore === true);

      if (data.warning) {
        setMessageType("info");
        setMessage(String(data.warning));
      }

      if (!append) {
        setSelected(null);
        setProducts([]);
        setSelectedColors([]);
      }
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the supplier catalog."
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (connected) void load({ search: "" });
  }, [supplier, connected]);

  async function choose(style: Style) {
    setSelected(style);
    setProducts([]);
    setSelectedColors([]);
    setMessage("");
    setDetailBusy(true);

    try {
      const params = new URLSearchParams({
        supplier,
        style: style.styleId
      });

      const response = await fetch(
        `/api/admin/suppliers/catalog/detail?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Unable to load this supplier style.");
      }

      const rows: Product[] = data.products || [];
      setProducts(rows);
      setSelectedColors(
        Array.from(new Set(rows.map((item) => item.colorName)))
      );

      if (!rows.length) {
        setMessageType("info");
        setMessage(
          `No active ${supplierLabel(
            supplier
          )} SKUs were returned for this style.`
        );
      }
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to load this style."
      );
    } finally {
      setDetailBusy(false);
    }
  }

  const colors = useMemo<ColorSummary[]>(() => {
    const groups = new Map<string, Product[]>();

    products.forEach((row) => {
      groups.set(row.colorName, [
        ...(groups.get(row.colorName) || []),
        row
      ]);
    });

    return Array.from(groups.entries())
      .map(([name, rows]) => {
        const sample =
          rows.find(
            (row) =>
              row.frontImageUrl ||
              row.backImageUrl ||
              row.swatchImageUrl
          ) || rows[0];

        const prices = rows
          .map((row) => row.customerPrice)
          .filter((value) => value > 0);

        return {
          name,
          colorHex: sample?.colorHex || "#777777",
          frontImageUrl: sample?.frontImageUrl,
          backImageUrl: sample?.backImageUrl,
          swatchImageUrl: sample?.swatchImageUrl,
          sizeCount: new Set(rows.map((row) => row.sizeName)).size,
          inventory: rows.reduce(
            (sum, row) => sum + Math.max(0, row.quantity || 0),
            0
          ),
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
      const response = await fetch("/api/admin/suppliers/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier,
          products,
          selectedColors,
          style: selected,
          targetBusiness
        })
      });

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Unable to import this product.");
      }

      setMessageType("success");
      setMessage(
        `${selected.brandName} ${
          selected.styleName || selected.styleId
        } was imported from ${supplierLabel(supplier)}.`
      );
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to import this product."
      );
    } finally {
      setImportBusy(false);
    }
  }

  if (!connectedSuppliers.length) {
    return (
      <section className="admin-card supplier-catalog-connect-state">
        <span>SUPPLIERS</span>
        <h2>Connect a supplier to open the live catalog.</h2>
        <p>
          Connect SanMar, S&amp;S Activewear, or both under the Suppliers
          settings.
        </p>
        <Link className="primary-button" href="/dashboard/suppliers">
          Manage supplier connections
        </Link>
      </section>
    );
  }

  if (!connected) {
    const other = supplier === "sanmar" ? "ss" : "sanmar";

    return (
      <section className="supplier-dual-workspace supplier-catalog-layout">
        <SupplierPicker
          supplier={supplier}
          setSupplier={switchSupplier}
          suppliers={suppliers}
        />

        <section className="admin-card supplier-catalog-connect-state">
          <span>{supplierLabel(supplier)}</span>
          <h2>{supplierLabel(supplier)} is not connected.</h2>
          <p>
            Select a connected supplier above, or connect this supplier before
            browsing its live catalog.
          </p>
          <div className="supplier-action-row">
            {suppliers[other].connected && (
              <button
                className="primary-button"
                onClick={() => switchSupplier(other)}
              >
                Use {supplierLabel(other)}
              </button>
            )}
            <Link className="secondary-button" href="/dashboard/suppliers">
              Connect {supplierLabel(supplier)}
            </Link>
          </div>
        </section>

        <CatalogLayoutStyles />
      </section>
    );
  }

  return (
    <div className="supplier-dual-workspace supplier-catalog-layout">
      <SupplierPicker
        supplier={supplier}
        setSupplier={switchSupplier}
        suppliers={suppliers}
      />

      <section className="admin-card supplier-live-main">
        <div className="live-catalog-banner">
          <div>
            <i className="live-pulse" />
            <div>
              <strong>
                {supplierLabel(supplier)} · Live supplier catalog
              </strong>
              <p>
                Authenticated account{" "}
                {suppliers[supplier].accountHint || "connected"} · live
                supplier products, variants, pricing, inventory and images.
              </p>
            </div>
          </div>

          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => load({ refresh: true })}
          >
            {busy ? "Refreshing…" : "Refresh catalog"}
          </button>
        </div>

        {targetBusiness === "brand" && (
          <div className="business-target-note">
            <strong>Brand sourcing.</strong>
            <span>
              Imported garments are added as Brand sources and are not
              automatically published to Print Shop Products.
            </span>
          </div>
        )}

        <div className="supplier-live-toolbar">
          <div className="supplier-live-search">
            <label>Search live products</label>
            <div>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) =>
                  event.key === "Enter" && void load()
                }
                placeholder={
                  supplier === "sanmar"
                    ? "Style, brand, product name, or description"
                    : "Brand, style number, title, or part number"
                }
              />
              <button className="primary-button" onClick={() => load()}>
                Search
              </button>
            </div>
          </div>

          <div className="supplier-filter-row">
            <label>
              <span>Brand</span>
              <select
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
              >
                <option value="">All brands</option>
                {brands.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>

            <button className="secondary-button" onClick={() => load()}>
              Apply filters
            </button>
          </div>
        </div>

        {supplier === "ss" ? (
          <div className="supplier-quick-searches">
            <span>Popular searches</span>
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
        ) : (
          <div className="supplier-quick-searches sanmar-search-hint">
            <span>Full SanMar catalog</span>
            <small>
              Browse everything in your cached SanMar feed, or narrow it by
              brand, category, product name, or style number.
            </small>
          </div>
        )}

        <div className="supplier-results-heading">
          <div>
            <strong>{total.toLocaleString()} live styles</strong>
            <small>
              Select a style to load exact colors, sizes and supplier SKUs.
            </small>
          </div>
          {busy && <span className="catalog-loading-state">Loading…</span>}
        </div>

        {styles.length ? (
          <div className="supplier-live-grid supplier-expanded-product-grid">
            {styles.map((style) => (
              <button
                key={`${style.supplier}-${style.styleId}`}
                className={
                  selected?.styleId === style.styleId
                    ? "supplier-live-card selected"
                    : "supplier-live-card"
                }
                onClick={() => choose(style)}
              >
                <div className="supplier-live-card-image">
                  {style.imageUrl ? (
                    <img src={style.imageUrl} alt={style.title} />
                  ) : (
                    <div className="supplier-image-fallback">
                      {supplierLabel(style.supplier)}
                    </div>
                  )}
                  <span className="live-data-chip">
                    {supplierLabel(style.supplier)}
                  </span>
                </div>

                <div className="supplier-live-card-copy">
                  <span>
                    {style.brandName} ·{" "}
                    {style.styleName || style.styleId}
                  </span>
                  <h3>{style.title}</h3>
                  <p>{style.description}</p>
                  <div>
                    <small>{style.category}</small>
                    <small>{style.partNumber || style.styleId}</small>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          !busy && (
            <div className="supplier-catalog-empty">
              <h3>No live styles match this search.</h3>
              <p>
                Try a brand, style number, product type, or clear the filters.
              </p>
            </div>
          )
        )}

        {hasMore && (
          <div className="supplier-load-more">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => load({ append: true })}
            >
              {busy ? "Loading…" : "Load more products"}
            </button>
          </div>
        )}
      </section>

      <aside className="admin-card supplier-live-inspector">
        {!selected ? (
          <div className="supplier-inspector-empty">
            <div className="supplier-inspector-icon">↗</div>
            <h2>Select a live style</h2>
            <p>
              Colors, front/back images, supplier cost, inventory, sizes and
              exact SKUs will load here.
            </p>
          </div>
        ) : (
          <>
            <div className="supplier-inspector-heading">
              <div>
                <p className="eyebrow">
                  LIVE {supplierLabel(supplier).toUpperCase()} PRODUCT
                </p>
                <h2>
                  {selected.brandName}{" "}
                  {selected.styleName || selected.styleId}
                </h2>
                <p>{selected.title}</p>
              </div>
              <span className="status-pill connected">Live</span>
            </div>

            <dl className="supplier-facts live-facts">
              <div>
                <dt>Supplier</dt>
                <dd>{supplierLabel(supplier)}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{selected.category || "Apparel"}</dd>
              </div>
              <div>
                <dt>Style</dt>
                <dd>{selected.styleId}</dd>
              </div>
            </dl>

            {detailBusy ? (
              <div className="supplier-detail-loading">
                <span />
                <strong>Loading live colors and inventory…</strong>
                <small>
                  Direct from your {supplierLabel(supplier)} account.
                </small>
              </div>
            ) : (
              <>
                <div className="supplier-color-toolbar">
                  <div>
                    <h3>Choose colors to add</h3>
                    <p>
                      {selectedColors.length} of {colors.length} selected
                    </p>
                  </div>
                  <div>
                    <button
                      className="text-button"
                      onClick={() =>
                        setSelectedColors(colors.map((item) => item.name))
                      }
                    >
                      Select all
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setSelectedColors([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="supplier-live-color-list">
                  {colors.map((color) => (
                    <label
                      key={color.name}
                      className={
                        selectedColors.includes(color.name)
                          ? "supplier-live-color selected"
                          : "supplier-live-color"
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

                      <div className="supplier-live-color-images">
                        {color.frontImageUrl ? (
                          <img
                            src={color.frontImageUrl}
                            alt={`${color.name} front`}
                          />
                        ) : (
                          <span style={{ background: color.colorHex }} />
                        )}

                        {color.backImageUrl && (
                          <img
                            src={color.backImageUrl}
                            alt={`${color.name} back`}
                          />
                        )}
                      </div>

                      <div className="supplier-live-color-copy">
                        <div>
                          <span
                            className="color-dot"
                            style={{ background: color.colorHex }}
                          />
                          <strong>{color.name}</strong>
                        </div>
                        <small>
                          {color.sizeCount} sizes ·{" "}
                          {color.inventory.toLocaleString()} units
                        </small>
                        <small>
                          {color.priceMin === color.priceMax
                            ? money(color.priceMin)
                            : `${money(color.priceMin)}–${money(
                                color.priceMax
                              )}`}{" "}
                          wholesale
                        </small>
                      </div>
                    </label>
                  ))}
                </div>

                {!!colors.length && (
                  <div className="supplier-import-footer">
                    <div>
                      <strong>{selectedColors.length} colors</strong>
                      <small>
                        {
                          products.filter((item) =>
                            selectedColors.includes(item.colorName)
                          ).length
                        }{" "}
                        exact SKUs
                      </small>
                    </div>

                    <button
                      className="primary-button"
                      disabled={importBusy || !selectedColors.length}
                      onClick={importProduct}
                    >
                      {importBusy
                        ? "Adding…"
                        : targetBusiness === "brand"
                          ? "Add to Brand Garments"
                          : "Import to Print Products"}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {message && (
          <div
            className={
              messageType === "success"
                ? "success-message catalog-message"
                : messageType === "error"
                  ? "error-message catalog-message"
                  : "catalog-info-message catalog-message"
            }
          >
            {message}
            {messageType === "success" && (
              <Link
                href={
                  targetBusiness === "brand"
                    ? "/dashboard/brand-garments"
                    : "/dashboard/products"
                }
              >
                {targetBusiness === "brand"
                  ? "Brand Garments →"
                  : "Print Products →"}
              </Link>
            )}
          </div>
        )}
      </aside>

      <CatalogLayoutStyles />
    </div>
  );
}

function SupplierPicker({
  supplier,
  setSupplier,
  suppliers
}: {
  supplier: SupplierKey;
  setSupplier: (value: SupplierKey) => void;
  suppliers: Record<SupplierKey, SupplierState>;
}) {
  return (
    <nav className="supplier-picker supplier-picker-tabs" aria-label="Supplier catalog">
      <div className="supplier-picker-title">
        <p>SUPPLIER SOURCE</p>
        <strong>Choose catalog</strong>
      </div>

      <div className="supplier-picker-options">
        {(["sanmar", "ss"] as SupplierKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={
              supplier === key
                ? "supplier-picker-button active"
                : "supplier-picker-button"
            }
            onClick={() => setSupplier(key)}
          >
            <span className="supplier-picker-row">
              <strong>{supplierLabel(key)}</strong>
              <span
                className={
                  suppliers[key].connected
                    ? "supplier-status connected"
                    : "supplier-status offline"
                }
              >
                {suppliers[key].connected ? "Connected" : "Not connected"}
              </span>
            </span>
            <small>
              {suppliers[key].connected
                ? suppliers[key].accountHint || "Live account"
                : "Connect to browse"}
            </small>
          </button>
        ))}
      </div>
    </nav>
  );
}

function CatalogLayoutStyles() {
  return (
    <style jsx global>{`
      /*
        Supplier source is now a top tab bar instead of a permanent left rail.
        This restores that horizontal space to the product browser.
      */
      .supplier-catalog-layout {
        display: grid !important;
        grid-template-columns:
          minmax(0, 1fr)
          minmax(360px, 420px) !important;
        gap: 20px !important;
        align-items: start;
      }

      .supplier-catalog-layout > .supplier-picker-tabs {
        position: static !important;
        top: auto !important;
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: end;
        gap: 18px;
        margin: 0 0 2px;
        padding: 0;
      }

      .supplier-picker-tabs .supplier-picker-title {
        min-width: 150px;
        padding: 0 0 4px;
      }

      .supplier-picker-tabs .supplier-picker-title p {
        margin: 0 0 4px;
        color: var(--muted, #777);
        font-size: 10px;
        font-weight: 850;
        letter-spacing: .12em;
      }

      .supplier-picker-tabs .supplier-picker-title strong {
        font-size: 15px;
      }

      .supplier-picker-tabs .supplier-picker-options {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .supplier-picker-tabs .supplier-picker-button {
        appearance: none;
        width: 100%;
        min-height: 66px;
        padding: 12px 16px;
        border: 1px solid rgba(20,20,20,.12);
        border-radius: 14px 14px 4px 4px;
        background: rgba(255,255,255,.82);
        color: inherit;
        text-align: left;
        cursor: pointer;
        display: grid;
        gap: 6px;
        box-shadow: none;
        transform: none;
        transition:
          border-color .18s ease,
          background .18s ease,
          box-shadow .18s ease;
      }

      .supplier-picker-tabs .supplier-picker-button:hover {
        border-color: rgba(20,20,20,.32);
        transform: none;
      }

      .supplier-picker-tabs .supplier-picker-button.active {
        border-color: #111;
        border-bottom-width: 4px;
        background: #111;
        color: #fff;
        box-shadow: 0 8px 24px rgba(0,0,0,.08);
      }

      .supplier-picker-tabs .supplier-picker-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .supplier-picker-tabs .supplier-picker-button strong {
        font-size: 15px;
        line-height: 1.15;
      }

      .supplier-picker-tabs .supplier-picker-button small {
        min-width: 0;
        overflow: hidden;
        color: #777;
        font-size: 11px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .supplier-picker-tabs .supplier-picker-button.active small {
        color: rgba(255,255,255,.72);
      }

      .supplier-picker-tabs .supplier-status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 7px;
        border-radius: 999px;
        background: #f1f1f1;
        color: #777;
        font-size: 9px;
        font-weight: 850;
        letter-spacing: .05em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .supplier-picker-tabs .supplier-status.connected {
        background: #e6f5ea;
        color: #18794e;
      }

      .supplier-picker-tabs
        .supplier-picker-button.active
        .supplier-status.connected {
        background: #dff4e5;
        color: #146c43;
      }

      .supplier-picker-tabs
        .supplier-picker-button.active
        .supplier-status.offline {
        background: rgba(255,255,255,.12);
        color: rgba(255,255,255,.68);
      }

      /*
        Larger product cards. auto-fit keeps cards from being squeezed into
        narrow fixed columns when the inspector is visible.
      */
      .supplier-catalog-layout .supplier-expanded-product-grid {
        grid-template-columns:
          repeat(auto-fit, minmax(min(100%, 240px), 1fr)) !important;
        gap: 16px !important;
      }

      .supplier-catalog-layout .supplier-live-card {
        border-radius: 19px;
      }

      .supplier-catalog-layout .supplier-live-card-image {
        aspect-ratio: 1 / 1;
        min-height: 220px;
      }

      .supplier-catalog-layout .supplier-live-card-image img {
        padding: 10px;
      }

      .supplier-catalog-layout .supplier-live-card-copy {
        gap: 6px;
        padding: 16px 17px 17px;
      }

      .supplier-catalog-layout .supplier-live-card-copy h3 {
        font-size: 17px;
        line-height: 1.2;
      }

      .supplier-catalog-layout .supplier-live-card-copy p {
        min-height: 40px;
        font-size: 12.5px;
      }

      .supplier-catalog-layout .sanmar-search-hint {
        align-items: flex-start !important;
        gap: 5px !important;
      }

      .supplier-catalog-layout .sanmar-search-hint small {
        color: #777;
        line-height: 1.4;
      }

      .supplier-catalog-layout > .supplier-catalog-connect-state {
        grid-column: 1 / -1;
      }

      @media (max-width: 1180px) {
        .supplier-catalog-layout {
          grid-template-columns: 1fr !important;
        }

        .supplier-catalog-layout .supplier-live-inspector {
          position: static;
          top: auto;
          max-height: none;
          overflow: visible;
        }

        .supplier-catalog-layout .supplier-expanded-product-grid {
          grid-template-columns:
            repeat(auto-fit, minmax(min(100%, 250px), 1fr)) !important;
        }
      }

      @media (max-width: 760px) {
        .supplier-catalog-layout {
          display: block !important;
        }

        .supplier-catalog-layout > .supplier-picker-tabs {
          display: block;
          margin-bottom: 14px;
        }

        .supplier-picker-tabs .supplier-picker-title {
          margin-bottom: 9px;
        }

        .supplier-picker-tabs .supplier-picker-options {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .supplier-picker-tabs .supplier-picker-button {
          min-height: 62px;
          padding: 11px 12px;
        }

        .supplier-picker-tabs .supplier-picker-row {
          align-items: flex-start;
          flex-direction: column;
          gap: 5px;
        }

        .supplier-catalog-layout .supplier-expanded-product-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 12px !important;
        }

        .supplier-catalog-layout .supplier-live-card-image {
          min-height: 0;
        }
      }

      @media (max-width: 520px) {
        .supplier-picker-tabs .supplier-picker-options {
          grid-template-columns: 1fr;
        }

        .supplier-picker-tabs .supplier-picker-row {
          flex-direction: row;
          align-items: center;
        }

        .supplier-catalog-layout .supplier-expanded-product-grid {
          grid-template-columns: 1fr !important;
        }

        .supplier-catalog-layout .supplier-live-card {
          display: grid;
          grid-template-columns: 132px minmax(0, 1fr);
        }

        .supplier-catalog-layout .supplier-live-card-image {
          height: 100%;
          min-height: 150px;
          aspect-ratio: auto;
        }
      }
    `}</style>
  );
}
