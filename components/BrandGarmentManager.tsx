"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  brandZoneKey,
  normalizeBrandGarmentSetup,
  type BrandGarmentSetup
} from "@/lib/brand-commerce";
import { normalizePrintArea } from "@/lib/catalog";
import type { CatalogProduct, DesignSide, PrintArea, PrintSize } from "@/lib/types";

function assetUrl(url?: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname.endsWith("ssactivewear.com")) return `/api/public/supplier-image?url=${encodeURIComponent(parsed.toString())}`;
    return url;
  } catch { return url; }
}

function supplierCostRange(product: CatalogProduct) {
  const costs = (product.configuration.supplier?.variants || [])
    .filter((item) => item.active !== false && Number(item.customerPrice) > 0)
    .map((item) => Number(item.customerPrice));
  if (!costs.length) return null;
  return { min: Math.min(...costs), max: Math.max(...costs) };
}

export default function BrandGarmentManager({
  products,
  initialGarments
}: {
  products: CatalogProduct[];
  initialGarments: Record<string, BrandGarmentSetup>;
}) {
  const first = products[0];
  const [selectedId, setSelectedId] = useState(first?.id || "");
  const product = products.find((item) => item.id === selectedId) || first;
  const [setups, setSetups] = useState<Record<string, BrandGarmentSetup>>(() =>
    Object.fromEntries(products.map((item) => [item.id, normalizeBrandGarmentSetup(initialGarments[item.id], item)]))
  );
  const [saved, setSaved] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((item) => [item.id, JSON.stringify(normalizeBrandGarmentSetup(initialGarments[item.id], item))]))
  );
  const [tab, setTab] = useState<"sell" | "zones">("sell");
  const [side, setSide] = useState<DesignSide>("front");
  const [size, setSize] = useState<PrintSize>("full");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!product) return null;
  const setup = setups[product.id];
  const dirty = JSON.stringify(setup) !== saved[product.id];
  const cost = supplierCostRange(product);
  const color = product.configuration.colors.find((item) => item.id === setup.defaultColorId) || product.configuration.colors[0];
  const zone = setup.zones[brandZoneKey(side,size)];

  function patch(next: Partial<BrandGarmentSetup>) {
    setSetups((current) => ({ ...current, [product.id]: { ...current[product.id], ...next } }));
  }
  function patchZone(next: PrintArea) {
    setSetups((current) => ({
      ...current,
      [product.id]: {
        ...current[product.id],
        zones: { ...current[product.id].zones, [brandZoneKey(side,size)]: normalizePrintArea(next, zone) }
      }
    }));
  }
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/brand-commerce/garments", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({productId:product.id,configuration:setup})
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to save garment.");
      const normalized=normalizeBrandGarmentSetup(data.configuration,product);
      setSetups((current)=>({...current,[product.id]:normalized}));
      setSaved((current)=>({...current,[product.id]:JSON.stringify(normalized)}));
      setMessage("Saved. This garment and price are live in the Brand builder.");
    } catch(e){setMessage(e instanceof Error?e.message:"Unable to save garment.");}
    finally{setBusy(false);}
  }

  return <div className="brand-garment-v3">
    <aside className="admin-card garment-v3-library">
      <div><p className="eyebrow">GARMENTS</p><h2>Brand blanks</h2><small>Base products customers choose first.</small></div>
      <div className="garment-v3-list">{products.map((item)=>{
        const s=setups[item.id]; const c=item.configuration.colors.find((x)=>x.id===s.defaultColorId)||item.configuration.colors[0];
        return <button key={item.id} className={item.id===product.id?"active":""} onClick={()=>{setSelectedId(item.id);setMessage("");}}>
          <span>{c?.frontImageUrl?<img src={assetUrl(c.frontImageUrl)} alt=""/>:item.name[0]}</span>
          <div><strong>{item.name}</strong><small>${Number(s.retailPrice||0).toFixed(2)} · {s.active?"Live":"Hidden"}</small></div>
        </button>})}</div>
    </aside>

    <section className="garment-v3-editor">
      <header className="admin-card garment-v3-head">
        <div><p className="eyebrow">BRAND GARMENT</p><h1>{product.name}</h1><p>The customer starts here. Set the garment's base selling price, available variants, and where Brand designs can print.</p></div>
        <label className="modern-switch"><input type="checkbox" checked={setup.active} onChange={(e)=>patch({active:e.target.checked})}/><span/><b>{setup.active?"Live":"Hidden"}</b></label>
      </header>

      <nav className="garment-v3-tabs">
        <button className={tab==="sell"?"active":""} onClick={()=>setTab("sell")}><span>01</span><div><strong>Garment & Price</strong><small>Customer options</small></div></button>
        <button className={tab==="zones"?"active":""} onClick={()=>setTab("zones")}><span>02</span><div><strong>Print Areas</strong><small>Design placement limits</small></div></button>
      </nav>

      {tab==="sell"&&<div className="garment-v3-content">
        <section className="admin-card garment-price-card">
          <div><p className="section-kicker">CUSTOMER BASE PRICE</p><h2>What does the garment cost before a design?</h2><p>The storefront adds the selected design price to this garment price.</p></div>
          <label><span>Garment selling price</span><div className="money-input"><b>$</b><input type="number" min="0" step=".50" value={setup.retailPrice||""} onChange={(e)=>patch({retailPrice:Math.max(0,Number(e.target.value)||0)})}/></div></label>
          <div className="garment-cost-context"><span>Supplier cost</span><strong>{cost?`$${cost.min.toFixed(2)}${cost.max!==cost.min?`–$${cost.max.toFixed(2)}`:""}`:"Manual / unavailable"}</strong><small>For reference only. The customer sees the garment selling price.</small></div>
        </section>

        <section className="admin-card garment-options-card">
          <div className="card-heading"><div><p className="section-kicker">CUSTOMER OPTIONS</p><h2>Colors & sizes</h2></div><span>{setup.activeColorIds.length} colors · {setup.sizes.length} sizes</span></div>
          <h3>Colors</h3>
          <div className="brand-option-grid colors">{product.configuration.colors.map((item)=><label key={item.id} className={setup.activeColorIds.includes(item.id)?"selected":""}><input type="checkbox" checked={setup.activeColorIds.includes(item.id)} onChange={(e)=>patch({activeColorIds:e.target.checked?[...new Set([...setup.activeColorIds,item.id])]:setup.activeColorIds.filter((id)=>id!==item.id)})}/><i style={{background:item.hex}}/><span>{item.name}</span></label>)}</div>
          <h3>Sizes</h3>
          <div className="brand-option-grid sizes">{product.configuration.sizes.map((item)=><label key={item} className={setup.sizes.includes(item)?"selected":""}><input type="checkbox" checked={setup.sizes.includes(item)} onChange={(e)=>patch({sizes:e.target.checked?[...new Set([...setup.sizes,item])]:setup.sizes.filter((x)=>x!==item)})}/><span>{item}</span></label>)}</div>
          <label className="default-color"><span>Default storefront color</span><select value={setup.defaultColorId||""} onChange={(e)=>patch({defaultColorId:e.target.value})}>{product.configuration.colors.filter((x)=>setup.activeColorIds.includes(x.id)).map((x)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        </section>
      </div>}

      {tab==="zones"&&<div className="garment-v3-content">
        <section className="admin-card zone-selector-card">
          <div><p className="section-kicker">AVAILABLE DESIGN TYPES</p><h2>What designs can customers add?</h2><p>These controls determine which design types can be approved for this garment.</p></div>
          <div className="location-toggles">
            <label className={setup.frontEnabled?"selected":""}><input type="checkbox" checked={setup.frontEnabled} onChange={(e)=>patch({frontEnabled:e.target.checked})}/><span>Front</span></label>
            <label className={setup.backEnabled?"selected":""}><input type="checkbox" checked={setup.backEnabled} onChange={(e)=>patch({backEnabled:e.target.checked})}/><span>Back</span></label>
            <label className={setup.printSizes.includes("heart")?"selected":""}><input type="checkbox" checked={setup.printSizes.includes("heart")} onChange={(e)=>patch({printSizes:e.target.checked?[...new Set([...setup.printSizes,"heart" as PrintSize])]:setup.printSizes.filter((x)=>x!=="heart")})}/><span>Heart Size</span></label>
            <label className={setup.printSizes.includes("full")?"selected":""}><input type="checkbox" checked={setup.printSizes.includes("full")} onChange={(e)=>patch({printSizes:e.target.checked?[...new Set([...setup.printSizes,"full" as PrintSize])]:setup.printSizes.filter((x)=>x!=="full")})}/><span>Full Size</span></label>
          </div>
        </section>

        <section className="admin-card garment-zone-editor">
          <div className="zone-editor-toolbar">
            <div><button className={side==="front"?"active":""} onClick={()=>setSide("front")}>Front</button><button className={side==="back"?"active":""} onClick={()=>setSide("back")}>Back</button></div>
            <div><button className={size==="heart"?"active":""} onClick={()=>setSize("heart")}>Heart Size</button><button className={size==="full"?"active":""} onClick={()=>setSize("full")}>Full Size</button></div>
          </div>
          <ZoneCanvas product={product} color={color} side={side} value={zone} onChange={patchZone}/>
          <div className="zone-dimensions"><label><span>Physical max width</span><div><input type="number" step=".25" min="1" value={zone.widthInches||4} onChange={(e)=>patchZone({...zone,widthInches:Number(e.target.value)||1})}/><b>in</b></div></label><label><span>Physical max height</span><div><input type="number" step=".25" min="1" value={zone.heightInches||4} onChange={(e)=>patchZone({...zone,heightInches:Number(e.target.value)||1})}/><b>in</b></div></label></div>
          <small>Drag the green zone over the real garment and resize from the lower-right handle. Designs approved for this placement stay inside this area.</small>
        </section>
      </div>}

      {message&&<div className={message.startsWith("Saved")?"success-message":"error-message"}>{message}</div>}
      {dirty&&<button className="brand-floating-save" disabled={busy} onClick={save}>{busy?"Saving…":"Save garment"}</button>}
    </section>

    <style jsx>{`
      .brand-garment-v3{display:grid;grid-template-columns:250px minmax(0,1fr);gap:12px;align-items:start}.garment-v3-library{position:sticky;top:14px;padding:13px}.garment-v3-library h2{margin:2px 0}.garment-v3-library>div:first-child>small{color:#888;font-size:7px}.garment-v3-list{display:grid;gap:4px;margin-top:10px}.garment-v3-list button{display:grid;grid-template-columns:45px 1fr;gap:8px;align-items:center;padding:6px;border:1px solid transparent;border-radius:9px;background:transparent;color:#171717;text-align:left}.garment-v3-list button.active{background:#f2f3f6;border-color:#d7dce9}.garment-v3-list button>span{display:grid;place-items:center;width:45px;height:45px;border-radius:7px;background:#f3f3ef;overflow:hidden}.garment-v3-list img{width:100%;height:100%;object-fit:contain}.garment-v3-list strong,.garment-v3-list small{display:block}.garment-v3-list strong{font-size:8px}.garment-v3-list small{margin-top:2px;color:#888;font-size:7px}.garment-v3-editor{display:grid;gap:10px}.garment-v3-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:17px}.garment-v3-head h1{margin:3px 0}.garment-v3-head p:not(.eyebrow){max-width:700px;margin:0;color:#777}.garment-v3-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:5px;border:1px solid #e1e1dc;border-radius:12px;background:#f1f1ed}.garment-v3-tabs button{display:grid;grid-template-columns:27px 1fr;gap:7px;align-items:center;padding:8px;border:0;border-radius:8px;background:transparent;color:#777;text-align:left}.garment-v3-tabs button.active{background:#fff;color:#171717;box-shadow:0 4px 14px rgba(0,0,0,.05)}.garment-v3-tabs button>span{display:grid;place-items:center;width:25px;height:25px;border-radius:99px;background:#ddd;font-size:7px;font-weight:900}.garment-v3-tabs button.active>span{background:#1f2947;color:#fff}.garment-v3-tabs strong,.garment-v3-tabs small{display:block}.garment-v3-tabs strong{font-size:8px}.garment-v3-tabs small{font-size:6px}.garment-v3-content{display:grid;gap:10px}.garment-price-card{display:grid;grid-template-columns:minmax(0,1fr) 220px 220px;gap:16px;align-items:center;padding:17px}.garment-price-card h2{margin:3px 0}.garment-price-card p:not(.section-kicker){margin:0;color:#777;font-size:8px}.garment-price-card>label>span{display:block;margin-bottom:5px;font-size:8px;font-weight:850}.money-input{display:grid;grid-template-columns:25px 1fr;align-items:center;border:1px solid #ddd;border-radius:8px;background:#fff}.money-input b{text-align:center}.money-input input{border:0}.garment-cost-context{padding:10px;border-radius:8px;background:#f4f4f0}.garment-cost-context span,.garment-cost-context strong,.garment-cost-context small{display:block}.garment-cost-context span{font-size:7px;color:#888}.garment-cost-context strong{margin:3px 0;font-size:12px}.garment-cost-context small{font-size:6px;color:#888}.garment-options-card,.zone-selector-card,.garment-zone-editor{padding:17px}.garment-options-card h3{margin:16px 0 7px;font-size:9px}.brand-option-grid{display:flex;flex-wrap:wrap;gap:5px}.brand-option-grid label{display:flex;align-items:center;gap:5px;padding:6px 8px;border:1px solid #ddd;border-radius:8px;font-size:7px}.brand-option-grid label.selected{border-color:#1f2947;background:#f0f2f8}.brand-option-grid input{display:none}.brand-option-grid i{width:14px;height:14px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}.default-color{display:grid;gap:5px;max-width:300px;margin-top:16px}.default-color>span{font-size:8px;font-weight:800}.location-toggles{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px}.location-toggles label{padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:8px}.location-toggles label.selected{background:#1f2947;color:#fff;border-color:#1f2947}.location-toggles input{display:none}.zone-selector-card h2{margin:3px 0}.zone-selector-card p:not(.section-kicker){margin:0;color:#777;font-size:8px}.zone-editor-toolbar{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px}.zone-editor-toolbar>div{display:flex;gap:4px}.zone-editor-toolbar button{padding:6px 9px;border:0;border-radius:7px;background:#eee;font-size:7px}.zone-editor-toolbar button.active{background:#171717;color:#fff}.zone-dimensions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.zone-dimensions label>span{display:block;margin-bottom:4px;font-size:7px;font-weight:800}.zone-dimensions label>div{display:grid;grid-template-columns:1fr 30px;border:1px solid #ddd;border-radius:7px;overflow:hidden}.zone-dimensions input{border:0}.zone-dimensions b{display:grid;place-items:center;background:#eee;font-size:7px}.garment-zone-editor>small{display:block;margin-top:8px;color:#777;font-size:7px}.brand-floating-save{position:fixed;right:24px;top:22px;z-index:100;padding:10px 15px;border:0;border-radius:9px;background:#171717;color:#fff;font-size:8px;font-weight:900;box-shadow:0 10px 28px rgba(0,0,0,.18)}
      @media(max-width:950px){.brand-garment-v3{grid-template-columns:1fr}.garment-v3-library{position:static}.garment-v3-list{grid-template-columns:repeat(2,1fr)}.garment-price-card{grid-template-columns:1fr 1fr}.garment-price-card>div:first-child{grid-column:1/-1}}
      @media(max-width:620px){.garment-v3-tabs,.garment-price-card,.zone-dimensions{grid-template-columns:1fr}.garment-v3-list{grid-template-columns:1fr}.brand-floating-save{right:12px;top:12px}}
    `}</style>
  </div>;
}

function ZoneCanvas({product,color,side,value,onChange}:{product:CatalogProduct;color:any;side:DesignSide;value:PrintArea;onChange:(value:PrintArea)=>void}) {
  const ref=useRef<SVGSVGElement|null>(null);
  const drag=useRef<any>(null);
  function point(e:ReactPointerEvent<SVGElement>){const r=ref.current!.getBoundingClientRect();return{x:((e.clientX-r.left)/r.width)*800,y:((e.clientY-r.top)/r.height)*800};}
  function begin(kind:"move"|"resize",e:ReactPointerEvent<SVGElement>){e.preventDefault();drag.current={kind,p:point(e),start:{...value}};e.currentTarget.setPointerCapture(e.pointerId);}
  function move(e:ReactPointerEvent<SVGElement>){if(!drag.current)return;const p=point(e),dx=p.x-drag.current.p.x,dy=p.y-drag.current.p.y,s=drag.current.start;let next={...s};if(drag.current.kind==="move"){next.x=Math.max(0,Math.min(800-s.width,s.x+dx));next.y=Math.max(0,Math.min(800-s.height,s.y+dy));next.defaultX=next.x;next.defaultY=next.y;}else{next.width=Math.max(50,Math.min(800-s.x,s.width+dx));next.height=Math.max(50,Math.min(800-s.y,s.height+dy));next.artworkWidth=next.width;next.artworkHeight=next.height;}onChange(next);}
  const img=side==="back"?color?.backImageUrl||product.configuration.mockupImageUrl:color?.frontImageUrl||product.configuration.mockupImageUrl;
  return <svg ref={ref} viewBox="0 0 800 800" onPointerMove={move} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} style={{width:"100%",maxHeight:560,background:"#f3f3ef",borderRadius:10}}>
    <rect width="800" height="800" fill="#f3f3ef"/>{img&&<image href={assetUrl(img)} x="28" y="28" width="744" height="744" preserveAspectRatio="xMidYMid meet"/>}
    <rect x={value.x} y={value.y} width={value.width} height={value.height} rx="8" fill="rgba(21,153,88,.18)" stroke="#159958" strokeWidth="4" onPointerDown={(e)=>begin("move",e)} style={{cursor:"move"}}/>
    <circle cx={value.x+value.width} cy={value.y+value.height} r="14" fill="#111" onPointerDown={(e)=>begin("resize",e)} style={{cursor:"nwse-resize"}}/>
  </svg>;
}
