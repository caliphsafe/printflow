"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
    }
  >;
};

type CategoryKey = "T-Shirts" | "Polos" | "Hats";

const CATEGORY_TO_SANMAR: Record<CategoryKey, string> = {
  "T-Shirts": "T-Shirts",
  Polos: "Polos/Knits",
  Hats: "Caps"
};

const QUICK: Record<CategoryKey, string[]> = {
  "T-Shirts": ["Port & Company", "Gildan", "District", "Sport-Tek"],
  Polos: ["Port Authority", "Nike", "Sport-Tek", "OGIO"],
  Hats: ["Port & Company", "New Era", "Sport-Tek", "Nike"]
};

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
  const [category, setCategory] = useState<CategoryKey>("T-Shirts");
  const [styles, setStyles] = useState<BrowseStyle[]>([]);
  const [selected, setSelected] = useState<BrowseStyle | null>(null);
  const [detail, setDetail] = useState<DetailStyle | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
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
    nextCategory?: CategoryKey;
    refresh?: boolean;
  }) {
    if (!connected) return;

    const nextCategory = options?.nextCategory || category;
    const append = options?.append === true;

    setBusy(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        category: CATEGORY_TO_SANMAR[nextCategory],
        q: options?.search ?? q,
        brand,
        offset: String(append ? styles.length : 0),
        limit: "36"
      });

      if (options?.refresh) params.set("refresh", "1");

      const response = await fetch(
        `/api/admin/suppliers/sanmar/styles?${params.toString()}`,
        { cache: "no-store" }
      );
      const data = await response.json();

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
      setTotal(Number(data.total || 0));
      setHasMore(data.hasMore === true);

      if (!append) {
        setSelected(null);
        setDetail(null);
        setSelectedColors([]);
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
    if (connected) void load({ nextCategory: "T-Shirts", search: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  async function choose(style: BrowseStyle) {
    setSelected(style);
    setDetail(null);
    setSelectedColors([]);
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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load this SanMar style.");
      }

      const next: DetailStyle = data.style;
      setDetail(next);
      setSelectedColors(
        Array.from(new Set(next.variants.map((item) => item.colorName)))
      );
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
      category: CATEGORY_TO_SANMAR[category],
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
          category,
          selectedColors
        })
      });

      const data = await response.json();

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

  function switchCategory(next: CategoryKey) {
    setBrand("");
    setQ("");
    void load({ nextCategory: next, search: "" });
  }

  if (!connected) {
    return (
      <section className="ae-card sanmar-connect-state">
        <div className="sanmar-wordmark">SANMAR</div>
        <h2>Connect SanMar to browse products.</h2>
        <p>
          Once connected, Advanced can browse T-shirts, polos and hats using
          live SanMar product data.
        </p>
        <Link className="ae-button primary" href="/advanced-admin/settings">
          Connect SanMar
        </Link>
      </section>
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
          {(["T-Shirts", "Polos", "Hats"] as CategoryKey[]).map((item) => (
            <button
              key={item}
              className={category === item ? "active" : ""}
              disabled={busy}
              onClick={() => switchCategory(item)}
            >
              <b>{item}</b>
              <small>
                {item === "T-Shirts"
                  ? "Tees"
                  : item === "Polos"
                  ? "Polos / Knits"
                  : "Caps"}
              </small>
            </button>
          ))}
        </div>

        <div className="sanmar-toolbar">
          <label className="sanmar-search">
            <span>Search {category}</span>
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
          {QUICK[category].map((value) => (
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
                    disabled={importBusy || !selectedColors.length}
                    onClick={() => void importProduct()}
                  >
                    {importBusy ? "Adding…" : "Add product to Advanced"}
                  </button>
                </div>
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
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 14px;
        }
        .sanmar-category-tabs button {
          display: grid;
          gap: 2px;
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
            grid-template-columns: 1fr;
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
