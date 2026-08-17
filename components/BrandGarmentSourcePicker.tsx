"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultBrandGarmentSetup } from "@/lib/brand-commerce";
import type { CatalogProduct } from "@/lib/types";

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

export default function BrandGarmentSourcePicker({ products }: { products: CatalogProduct[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((item) =>
      !q || `${item.name} ${item.configuration.customization.category} ${item.configuration.supplier?.brandName || ""}`.toLowerCase().includes(q)
    );
  }, [products, query]);

  async function add(product: CatalogProduct) {
    setBusyId(product.id);
    setError("");

    try {
      const configuration = { ...defaultBrandGarmentSetup(product), active: true };
      const response = await fetch("/api/admin/brand-commerce/garments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, configuration })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to add garment.");

      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add garment.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <button className="primary-button" type="button" onClick={() => setOpen(true)}>+ Add Brand garment</button>

      {open && (
        <div className="brand-source-backdrop" role="dialog" aria-modal="true">
          <section className="brand-source-panel">
            <header>
              <div>
                <p className="eyebrow">BRAND SOURCING</p>
                <h2>Add a garment</h2>
                <p>Choose a source blank for the Brand business. This does not add it to the Print Shop.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)}>×</button>
            </header>

            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search available supplier garments…" />

            {error && <div className="error-message">{error}</div>}

            <div className="brand-source-grid">
              {visible.map((product) => {
                const color = product.configuration.colors.find((item) => item.active !== false) || product.configuration.colors[0];
                const cost = product.configuration.supplier?.variants
                  .filter((item) => item.active !== false && Number(item.customerPrice) > 0)
                  .map((item) => Number(item.customerPrice))
                  .sort((a, b) => a - b)[0];

                return (
                  <article key={product.id}>
                    <div className="source-image">
                      {color?.frontImageUrl ? <img src={assetUrl(color.frontImageUrl)} alt="" /> : <span>{product.name.slice(0, 1)}</span>}
                    </div>
                    <div>
                      <small>{product.configuration.supplier?.brandName || product.configuration.customization.category}</small>
                      <h3>{product.name}</h3>
                      <p>{product.configuration.colors.filter((item) => item.active !== false).length} colors · {product.configuration.sizes.length} sizes</p>
                      <strong>{cost ? `Blank from $${cost.toFixed(2)}` : "Manual cost"}</strong>
                    </div>
                    <button type="button" disabled={Boolean(busyId)} onClick={() => add(product)}>
                      {busyId === product.id ? "Adding…" : "Add to Brand"}
                    </button>
                  </article>
                );
              })}

              {!visible.length && <div className="source-empty"><h3>No garments available</h3><p>Import more supplier products first, or clear the search.</p></div>}
            </div>
          </section>

          <style jsx>{`
            .brand-source-backdrop{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.55);backdrop-filter:blur(5px)}
            .brand-source-panel{display:grid;gap:12px;width:min(980px,100%);max-height:88vh;padding:18px;border-radius:17px;background:#fff;box-shadow:0 25px 80px rgba(0,0,0,.3);overflow:hidden}
            .brand-source-panel>header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.brand-source-panel h2{margin:3px 0}.brand-source-panel header p:not(.eyebrow){margin:0;color:#777;font-size:9px}.brand-source-panel header>button{display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:99px;background:#f0f0ec;font-size:19px}
            .brand-source-panel>input{width:100%;box-sizing:border-box}.brand-source-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;overflow:auto;padding-right:4px}.brand-source-grid article{display:grid;grid-template-columns:82px minmax(0,1fr);gap:9px;padding:10px;border:1px solid #e1e1dc;border-radius:11px}.source-image{display:grid;place-items:center;width:82px;height:82px;border-radius:8px;background:#f5f5f1;overflow:hidden}.source-image img{width:100%;height:100%;object-fit:contain}.brand-source-grid small{font-size:7px;color:#777;text-transform:uppercase}.brand-source-grid h3{margin:3px 0;font-size:11px}.brand-source-grid p{margin:0;color:#777;font-size:8px}.brand-source-grid strong{display:block;margin-top:5px;font-size:9px}.brand-source-grid article>button{grid-column:1/-1;padding:9px;border:0;border-radius:8px;background:#171717;color:#fff;font-size:9px;font-weight:800}.source-empty{grid-column:1/-1;text-align:center;padding:35px}.source-empty p{color:#777}
            @media(max-width:800px){.brand-source-grid{grid-template-columns:1fr 1fr}}
            @media(max-width:560px){.brand-source-backdrop{padding:8px}.brand-source-panel{max-height:94vh}.brand-source-grid{grid-template-columns:1fr}}
          `}</style>
        </div>
      )}
    </>
  );
}
