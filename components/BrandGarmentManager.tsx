"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  brandZoneKey,
  defaultBrandGarmentSetup,
  normalizeBrandGarmentSetup,
  type BrandGarmentSetup
} from "@/lib/brand-commerce";
import { normalizePrintArea } from "@/lib/catalog";
import type { CatalogProduct, DesignSide, PrintArea, PrintSize } from "@/lib/types";

const W = 800;
const H = 800;

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

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export default function BrandGarmentManager({
  products,
  initialGarments
}: {
  products: CatalogProduct[];
  initialGarments: Record<string, unknown>;
}) {
  const [garmentConfigs, setGarmentConfigs] = useState<Record<string, unknown>>(initialGarments);
  const first = products.find((item) => garmentConfigs[item.id]) || products[0];
  const [selectedId, setSelectedId] = useState(first?.id || "");
  const product = products.find((item) => item.id === selectedId) || products[0];

  const initialSetup = product
    ? normalizeBrandGarmentSetup(garmentConfigs[product.id], product)
    : null;

  const [draft, setDraft] = useState<BrandGarmentSetup | null>(initialSetup);
  const [saved, setSaved] = useState(initialSetup ? JSON.stringify(initialSetup) : "");
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<DesignSide>("front");
  const [size, setSize] = useState<PrintSize>("full");
  const [previewColorId, setPreviewColorId] = useState(product?.configuration.defaultColorId || product?.configuration.colors[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [panel, setPanel] = useState<"overview" | "zones">("overview");

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((item) => !q || `${item.name} ${item.configuration.customization.category}`.toLowerCase().includes(q));
  }, [products, query]);

  const dirty = Boolean(draft) && JSON.stringify(draft) !== saved;
  const color = product?.configuration.colors.find((item) => item.id === previewColorId)
    || product?.configuration.colors[0];

  const zone = draft ? draft.zones[brandZoneKey(side, size)] : null;

  function choose(next: CatalogProduct) {
    if (dirty && !window.confirm("You have unsaved Brand garment changes. Switch without saving?")) return;
    const setup = normalizeBrandGarmentSetup(garmentConfigs[next.id], next);
    setSelectedId(next.id);
    setDraft(copy(setup));
    setSaved(JSON.stringify(setup));
    setPreviewColorId(setup.defaultColorId || next.configuration.colors[0]?.id || "");
    setSide("front");
    setSize(setup.printSizes.includes("full") ? "full" : setup.printSizes[0] || "full");
    setMessage("");
  }

  function patch(next: Partial<BrandGarmentSetup>) {
    if (!draft) return;
    setDraft({ ...draft, ...next });
  }

  function patchZone(value: PrintArea) {
    if (!draft) return;
    const key = brandZoneKey(side, size);
    setDraft({
      ...draft,
      zones: {
        ...draft.zones,
        [key]: normalizePrintArea(value, draft.zones[key])
      }
    });
  }

  async function save() {
    if (!product || !draft || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/brand-commerce/garments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, configuration: draft })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Brand garment.");
      const normalized = data.configuration as BrandGarmentSetup;
      setDraft(normalized);
      setSaved(JSON.stringify(normalized));
      setGarmentConfigs((current) => ({ ...current, [product.id]: normalized }));
      setMessage("Brand garment saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save Brand garment.");
    } finally {
      setBusy(false);
    }
  }

  if (!product || !draft) {
    return <section className="admin-card"><h2>No garments available</h2><p>Import a supplier garment first, then add it to Brand.</p></section>;
  }

  const enabledColors = product.configuration.colors.filter((item) => draft.activeColorIds.includes(item.id));
  const enabledSides: DesignSide[] = [
    ...(draft.frontEnabled ? ["front"] as DesignSide[] : []),
    ...(draft.backEnabled ? ["back"] as DesignSide[] : [])
  ];

  return (
    <div className="brand-garment-shell">
      <aside className="admin-card brand-garment-library">
        <div className="library-head"><div><p className="eyebrow">BRAND GARMENTS</p><h2>Catalog</h2></div></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search supplier garments" />
        <div className="garment-list">
          {visibleProducts.map((item) => {
            const setup = normalizeBrandGarmentSetup(garmentConfigs[item.id], item);
            const firstColor = item.configuration.colors.find((candidate) => candidate.id === setup.defaultColorId)
              || item.configuration.colors[0];
            return (
              <button key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => choose(item)}>
                <span className="garment-thumb">
                  {firstColor?.frontImageUrl
                    ? <img src={assetUrl(firstColor.frontImageUrl)} alt="" />
                    : item.name.slice(0, 1)}
                </span>
                <span><strong>{item.name}</strong><small>{item.configuration.customization.category}</small></span>
                <i className={setup.active ? "live" : ""} />
              </button>
            );
          })}
        </div>
      </aside>

      <section className="brand-garment-editor">
        <header className="admin-card garment-editor-head">
          <div>
            <p className="eyebrow">BRAND COMMERCE</p>
            <h1>{product.name}</h1>
            <p>Configure this garment specifically for Brand / Merch. Print Shop settings are not used here.</p>
          </div>
          <label className="modern-switch">
            <input type="checkbox" checked={draft.active} onChange={(event) => patch({ active: event.target.checked })} />
            <span /><b>{draft.active ? "In Brand" : "Not in Brand"}</b>
          </label>
        </header>

        <nav className="garment-editor-tabs">
          <button className={panel === "overview" ? "active" : ""} onClick={() => setPanel("overview")}>
            <span>01</span><div><strong>Colors & Sizes</strong><small>Customer garment options</small></div>
          </button>
          <button className={panel === "zones" ? "active" : ""} onClick={() => setPanel("zones")}>
            <span>02</span><div><strong>Print Areas</strong><small>Brand-only production zones</small></div>
          </button>
        </nav>

        {panel === "overview" && <section className="admin-card setup-section">
          <SectionTitle number="1" title="Brand availability" text="Choose the exact colors, sizes and default presentation for Brand customers." />
          <div className="brand-availability-grid">
            <div>
              <h3>Colors</h3>
              <div className="brand-color-list">
                {product.configuration.colors.map((item) => {
                  const active = draft.activeColorIds.includes(item.id);
                  return (
                    <article key={item.id} className={active ? "active" : ""}>
                      <label>
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(event) => {
                            const ids = event.target.checked
                              ? [...new Set([...draft.activeColorIds, item.id])]
                              : draft.activeColorIds.filter((id) => id !== item.id);
                            patch({
                              activeColorIds: ids,
                              defaultColorId: ids.includes(draft.defaultColorId || "") ? draft.defaultColorId : ids[0]
                            });
                          }}
                        />
                        <i style={{ background: item.hex }} />
                        <span>{item.name}</span>
                      </label>
                      {active && (
                        <button type="button" className={draft.defaultColorId === item.id ? "default" : ""} onClick={() => patch({ defaultColorId: item.id })}>
                          {draft.defaultColorId === item.id ? "Default" : "Make default"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>

            <div>
              <h3>Sizes</h3>
              <div className="brand-size-list">
                {product.configuration.sizes.map((item) => (
                  <label key={item} className={draft.sizes.includes(item) ? "active" : ""}>
                    <input
                      type="checkbox"
                      checked={draft.sizes.includes(item)}
                      onChange={(event) => patch({
                        sizes: event.target.checked
                          ? [...new Set([...draft.sizes, item])]
                          : draft.sizes.filter((sizeName) => sizeName !== item)
                      })}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>

              <h3>Decoration methods</h3>
              <div className="method-tags">
                {["Screen Print", "DTF", "Embroidery"].map((method) => (
                  <label key={method} className={draft.decorationMethods.includes(method) ? "active" : ""}>
                    <input
                      type="checkbox"
                      checked={draft.decorationMethods.includes(method)}
                      onChange={(event) => patch({
                        decorationMethods: event.target.checked
                          ? [...new Set([...draft.decorationMethods, method])]
                          : draft.decorationMethods.filter((item) => item !== method)
                      })}
                    />
                    <span>{method}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>}

        {panel === "zones" && <section className="admin-card setup-section">
          <SectionTitle number="2" title="Brand print locations" text="Define Brand-only printable areas visually. These zones do not change the Custom Print storefront." />

          <div className="zone-toolbar">
            <label>
              <span>Reference color</span>
              <select value={color?.id || ""} onChange={(event) => setPreviewColorId(event.target.value)}>
                {enabledColors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>

            <div className="toggle-group">
              <span>Sides</span>
              <label><input type="checkbox" checked={draft.frontEnabled} onChange={(event) => { patch({ frontEnabled: event.target.checked }); if (!event.target.checked && side === "front") setSide("back"); }} />Front</label>
              <label><input type="checkbox" checked={draft.backEnabled} onChange={(event) => { patch({ backEnabled: event.target.checked }); if (!event.target.checked && side === "back") setSide("front"); }} />Back</label>
            </div>

            <div className="toggle-group">
              <span>Print sizes</span>
              {(["heart", "full"] as PrintSize[]).map((item) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={draft.printSizes.includes(item)}
                    onChange={(event) => {
                      const values = event.target.checked
                        ? [...new Set([...draft.printSizes, item])]
                        : draft.printSizes.filter((value) => value !== item);
                      patch({ printSizes: values });
                      if (!values.includes(size) && values.length) setSize(values[0]);
                    }}
                  />
                  {item === "heart" ? "Heart Size" : "Full Size"}
                </label>
              ))}
            </div>
          </div>

          {enabledSides.length && draft.printSizes.length && zone ? (
            <div className="brand-zone-layout">
              <div className="zone-canvas-card">
                <div className="zone-tabs">
                  {enabledSides.map((item) => <button key={item} className={side === item ? "active" : ""} onClick={() => setSide(item)}>{item === "front" ? "Front" : "Back"}</button>)}
                  {draft.printSizes.map((item) => <button key={item} className={size === item ? "active size" : "size"} onClick={() => setSize(item)}>{item === "heart" ? "Heart" : "Full"}</button>)}
                </div>
                <BrandZoneCanvas
                  product={product}
                  colorId={color?.id || ""}
                  side={side}
                  value={zone}
                  onChange={patchZone}
                />
              </div>

              <aside className="zone-controls">
                <h3>{side === "front" ? "Front" : "Back"} · {size === "heart" ? "Heart Size" : "Full Size"}</h3>
                <p>The outlined box is the Brand movement/placement zone used by the visual Design Builder.</p>
                <div className="dimension-grid">
                  <NumberField label="Physical width" suffix="in" value={zone.widthInches || 4} onChange={(widthInches) => patchZone({ ...zone, widthInches })} />
                  <NumberField label="Physical height" suffix="in" value={zone.heightInches || 4} onChange={(heightInches) => patchZone({ ...zone, heightInches })} />
                </div>
                <button className="secondary-button" onClick={() => {
                  const defaults = defaultBrandGarmentSetup(product);
                  patchZone(defaults.zones[brandZoneKey(side, size)]);
                }}>Reset this Brand zone</button>
              </aside>
            </div>
          ) : (
            <div className="zone-empty">Enable at least one side and one print size to configure Brand print locations.</div>
          )}
        </section>}

        {message && <div className={message.includes("saved") ? "success-message" : "error-message"}>{message}</div>}

        {dirty && (
          <div className="brand-save-dock">
            <div><strong>Unsaved Brand garment changes</strong><small>Only the Brand / Merch workspace is affected.</small></div>
            <button className="primary-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Brand garment"}</button>
          </div>
        )}
      </section>

      <style jsx>{`
        .brand-garment-shell{display:grid;grid-template-columns:270px minmax(0,1fr);gap:16px;align-items:start}
        .brand-garment-library{position:sticky;top:20px;padding:15px;max-height:calc(100vh - 40px);overflow:auto}
        .library-head h2{margin:2px 0 10px}
        .brand-garment-library>input{width:100%;box-sizing:border-box}
        .garment-list{display:grid;gap:5px;margin-top:8px}
        .garment-list button{display:grid;grid-template-columns:38px minmax(0,1fr) 7px;gap:8px;align-items:center;padding:8px;border:1px solid transparent;border-radius:9px;background:transparent;color:inherit;text-align:left}
        .garment-list button.active{background:#f5f5f1;border-color:#ddd}
        .garment-thumb{display:grid;place-items:center;width:38px;height:38px;border-radius:8px;background:#f0f0ec;overflow:hidden}
        .garment-thumb img{width:100%;height:100%;object-fit:contain}.garment-list strong{display:block;font-size:10px}.garment-list small{display:block;color:#777;font-size:8px}.garment-list i{width:7px;height:7px;border-radius:99px;background:#bbb}.garment-list i.live{background:#34a064}
        .brand-garment-editor{display:grid;gap:12px;min-width:0}.garment-editor-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:5px;border:1px solid #e2e2dd;border-radius:12px;background:#f3f3ef}.garment-editor-tabs button{display:grid;grid-template-columns:25px minmax(0,1fr);gap:7px;align-items:center;padding:9px;border:0;border-radius:8px;background:transparent;color:#686868;text-align:left}.garment-editor-tabs button.active{background:#fff;color:#171717;box-shadow:0 4px 14px rgba(0,0,0,.06)}.garment-editor-tabs button>span{display:grid;place-items:center;width:24px;height:24px;border-radius:99px;background:#e6e6e1;font-size:7px;font-weight:900}.garment-editor-tabs button.active>span{background:#1f2947;color:#fff}.garment-editor-tabs strong,.garment-editor-tabs small{display:block}.garment-editor-tabs strong{font-size:9px}.garment-editor-tabs small{font-size:7px;color:#888}.garment-editor-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:20px}.garment-editor-head h1{margin:3px 0 5px}.garment-editor-head p{margin:0;color:#777;max-width:700px}
        .setup-section{padding:20px}.brand-availability-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}.brand-availability-grid h3{margin:0 0 8px;font-size:11px}
        .brand-color-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.brand-color-list article{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border:1px solid #e1e1dc;border-radius:9px}.brand-color-list article.active{background:#fafaf7;border-color:#aaa}.brand-color-list label{display:flex;align-items:center;gap:6px;min-width:0}.brand-color-list i{width:15px;height:15px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}.brand-color-list span{font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brand-color-list button{border:0;background:transparent;color:#777;font-size:7px}.brand-color-list button.default{color:#111;font-weight:850}
        .brand-size-list,.method-tags{display:flex;flex-wrap:wrap;gap:5px}.brand-size-list label,.method-tags label{display:flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:8px}.brand-size-list label.active,.method-tags label.active{border-color:#111;background:#f5f5f1}.brand-size-list input,.method-tags input{display:none}
        .brand-availability-grid>div:last-child h3:not(:first-child){margin-top:16px}
        .zone-toolbar{display:grid;grid-template-columns:minmax(180px,.7fr) 1fr 1fr;gap:9px;align-items:end;margin-bottom:12px}.zone-toolbar>label{display:grid;gap:4px}.zone-toolbar span{font-size:8px;font-weight:800;color:#666}.toggle-group{display:flex;flex-wrap:wrap;gap:5px}.toggle-group>span{width:100%}.toggle-group label{display:flex;align-items:center;gap:5px;padding:6px 8px;border-radius:8px;background:#f5f5f1;font-size:8px}
        .brand-zone-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:12px}.zone-canvas-card{min-width:0;border:1px solid #e1e1dc;border-radius:13px;overflow:hidden;background:#f5f5f1}.zone-tabs{display:flex;gap:4px;padding:8px;background:#fff;border-bottom:1px solid #eee}.zone-tabs button{padding:6px 9px;border:0;border-radius:7px;background:#f1f1ed;font-size:8px}.zone-tabs button.active{background:#171717;color:#fff}.zone-tabs button.size{margin-left:3px}
        .zone-controls{display:grid;align-content:start;gap:10px;padding:15px;border:1px solid #e1e1dc;border-radius:12px;background:#fafaf7}.zone-controls h3{margin:0}.zone-controls p{margin:0;color:#777;font-size:9px;line-height:1.5}.dimension-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.zone-empty{padding:28px;border:1px dashed #ccc;border-radius:12px;text-align:center;color:#777;font-size:10px}
        .brand-save-dock{position:sticky;bottom:14px;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:14px;margin-left:auto;width:min(560px,100%);padding:10px 12px;border:1px solid #d5d5cf;border-radius:12px;background:rgba(255,255,255,.96);box-shadow:0 14px 35px rgba(0,0,0,.12);backdrop-filter:blur(10px)}.brand-save-dock strong{display:block;font-size:10px}.brand-save-dock small{display:block;color:#777;font-size:8px}
        @media(max-width:1050px){.brand-zone-layout{grid-template-columns:1fr}.zone-controls{grid-template-columns:1fr}.brand-availability-grid{grid-template-columns:1fr}}
        @media(max-width:900px){.brand-garment-shell{grid-template-columns:1fr}.brand-garment-library{position:static;max-height:none}.garment-list{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}}
        @media(max-width:650px){.garment-editor-head{display:grid;padding:16px}.setup-section{padding:16px}.brand-color-list{grid-template-columns:1fr}.zone-toolbar{grid-template-columns:1fr}.dimension-grid{grid-template-columns:1fr}.brand-save-dock{bottom:7px;display:grid;width:100%;box-sizing:border-box}}
      `}</style>
    </div>
  );
}

function SectionTitle({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <header className="section-title">
      <span>{number}</span>
      <div><h2>{title}</h2><p>{text}</p></div>
      <style jsx>{`
        .section-title{display:flex;gap:10px;align-items:flex-start;margin-bottom:16px}
        .section-title>span{display:grid;place-items:center;width:27px;height:27px;flex:0 0 27px;border-radius:99px;background:#171717;color:#fff;font-size:9px;font-weight:850}
        .section-title h2{margin:0 0 3px;font-size:16px}.section-title p{margin:0;color:#777;font-size:9px}
      `}</style>
    </header>
  );
}

function NumberField({ label, suffix, value, onChange }: { label: string; suffix: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div><input type="number" min=".5" step=".25" value={value} onChange={(event) => onChange(Math.max(.5, Number(event.target.value) || .5))} /><b>{suffix}</b></div>
      <style jsx>{`
        .number-field{display:grid;gap:4px}.number-field>span{font-size:8px;font-weight:800}.number-field>div{display:grid;grid-template-columns:minmax(0,1fr) 28px}.number-field input{min-width:0;width:100%;box-sizing:border-box}.number-field b{display:grid;place-items:center;background:#eee;border-radius:0 7px 7px 0;font-size:8px}
      `}</style>
    </label>
  );
}

function BrandZoneCanvas({
  product,
  colorId,
  side,
  value,
  onChange
}: {
  product: CatalogProduct;
  colorId: string;
  side: DesignSide;
  value: PrintArea;
  onChange: (value: PrintArea) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<any>(null);
  const color = product.configuration.colors.find((item) => item.id === colorId) || product.configuration.colors[0];
  const imageUrl = side === "front"
    ? color?.frontImageUrl || product.configuration.mockupImageUrl
    : color?.backImageUrl || product.configuration.mockupImageUrl;

  function point(event: ReactPointerEvent<SVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H
    };
  }

  function begin(kind: "move" | "resize", event: ReactPointerEvent<SVGElement>) {
    event.preventDefault();
    dragRef.current = { kind, p: point(event), area: { ...value } };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: ReactPointerEvent<SVGElement>) {
    if (!dragRef.current) return;
    const current = point(event);
    const dx = current.x - dragRef.current.p.x;
    const dy = current.y - dragRef.current.p.y;
    const start: PrintArea = dragRef.current.area;

    if (dragRef.current.kind === "move") {
      onChange({
        ...start,
        x: Math.max(0, Math.min(W - start.width, start.x + dx)),
        y: Math.max(0, Math.min(H - start.height, start.y + dy))
      });
    } else {
      onChange({
        ...start,
        width: Math.max(60, Math.min(W - start.x, start.width + dx)),
        height: Math.max(60, Math.min(H - start.y, start.height + dy))
      });
    }
  }

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={() => (dragRef.current = null)} onPointerCancel={() => (dragRef.current = null)}>
      <rect width={W} height={H} fill="#f3f3ef" />
      {imageUrl
        ? <image href={assetUrl(imageUrl)} x="32" y="32" width="736" height="736" preserveAspectRatio="xMidYMid meet" />
        : <path d="M255 150 110 245l75 135 78-42v330h274V338l78 42 75-135-145-95-65 55H320z" fill={color?.hex || "#ddd"} stroke="#bbb" strokeWidth="3" />}
      <rect
        x={value.x}
        y={value.y}
        width={value.width}
        height={value.height}
        rx="9"
        fill="rgba(24,126,78,.13)"
        stroke="#168255"
        strokeWidth="4"
        onPointerDown={(event) => begin("move", event)}
        style={{ cursor: "move" }}
      />
      <text x={value.x + value.width / 2} y={value.y + value.height / 2} textAnchor="middle" dominantBaseline="middle" fontSize="19" fontWeight="800" fill="#111" pointerEvents="none">
        Brand print zone
      </text>
      <circle
        cx={value.x + value.width}
        cy={value.y + value.height}
        r="15"
        fill="#111"
        onPointerDown={(event) => begin("resize", event)}
        style={{ cursor: "nwse-resize" }}
      />
    </svg>
  );
}
