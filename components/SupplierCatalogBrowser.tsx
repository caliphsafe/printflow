"use client";
import { useEffect,useMemo,useState } from "react";
type Variant={id:string;sku:string;color_name:string;color_hex:string;size_name:string;wholesale_price:number;inventory_quantity:number;image_front_url?:string;image_back_url?:string};
type Style={id:string;provider:string;supplier_name:string;brand_name:string;style_name:string;title:string;description?:string;category:string;part_number?:string;image_front_url?:string;image_back_url?:string;source_mode:string;supplier_catalog_variants:Variant[]};
export default function SupplierCatalogBrowser(){
 const [styles,setStyles]=useState<Style[]>([]),[q,setQ]=useState(''),[selected,setSelected]=useState<Style|null>(null),[colors,setColors]=useState<string[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function load(search=''){setBusy(true);const r=await fetch(`/api/admin/suppliers/catalog?q=${encodeURIComponent(search)}`);const d=await r.json();setBusy(false);if(!r.ok)return setMessage(d.error||'Unable to load catalog.');setStyles(d.styles||[])}
 useEffect(()=>{load()},[]);
 const colorRows=useMemo(()=>selected?Array.from(new Map(selected.supplier_catalog_variants.map(v=>[v.color_name,v])).values()):[],[selected]);
 function choose(style:Style){setSelected(style);setColors(Array.from(new Set(style.supplier_catalog_variants.map(v=>v.color_name))));setMessage('')}
 async function importProduct(){if(!selected)return;setBusy(true);const r=await fetch('/api/admin/suppliers/import-demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({styleId:selected.id,selectedColors:colors})});const d=await r.json();setBusy(false);if(!r.ok)return setMessage(d.error||'Import failed.');setMessage('Imported into Products. Customer pricing can now be configured.');}
 return <div className="supplier-catalog-shell">
  <section className="admin-card supplier-catalog-panel">
   <div className="supplier-catalog-toolbar"><div><p className="eyebrow">SUPPLIER CATALOG</p><h2>Browse blanks</h2></div><div className="supplier-search compact-search"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load(q)} placeholder="Search brand, style, or part number"/><button className="secondary-button compact" onClick={()=>load(q)}>Search</button></div></div>
   <div className="demo-mode-banner"><strong>Demo catalog mode</strong><span>These products use local sample assets and simulated cost/inventory data. They are safe for interface testing and cannot place a supplier order.</span></div>
   <div className="supplier-browser-grid">{styles.map(style=><button className={selected?.id===style.id?'supplier-product-card selected':'supplier-product-card'} key={style.id} onClick={()=>choose(style)}>
    <div className="supplier-product-image"><img src={style.image_front_url||'/demo-blanks/core-tee-front.svg'} alt=""/><span className="demo-chip">DEMO</span></div><div><small>{style.supplier_name}</small><h3>{style.brand_name} {style.style_name}</h3><p>{style.title}</p><span>{new Set(style.supplier_catalog_variants.map(v=>v.color_name)).size} colors · {new Set(style.supplier_catalog_variants.map(v=>v.size_name)).size} sizes</span></div>
   </button>)}</div>
  </section>
  <aside className="admin-card supplier-import-inspector">{!selected?<div className="empty-state compact-empty"><h3>Select a garment</h3><p>Review supplier data, choose colors and import it into your customer catalog.</p></div>:<>
   <p className="eyebrow">IMPORT PRODUCT</p><h2>{selected.brand_name} {selected.style_name}</h2><p>{selected.description||selected.title}</p>
   <div className="supplier-dual-preview"><figure><img src={selected.image_front_url||''} alt="Front"/><figcaption>Front</figcaption></figure><figure><img src={selected.image_back_url||''} alt="Back"/><figcaption>Back</figcaption></figure></div>
   <dl className="supplier-facts"><div><dt>Supplier</dt><dd>{selected.supplier_name}</dd></div><div><dt>Part number</dt><dd>{selected.part_number||'—'}</dd></div><div><dt>Source</dt><dd>Demo data</dd></div></dl>
   <h3>Colors to offer</h3><div className="supplier-color-checks">{colorRows.map(v=><label key={v.color_name}><input type="checkbox" checked={colors.includes(v.color_name)} onChange={e=>setColors(e.target.checked?[...colors,v.color_name]:colors.filter(c=>c!==v.color_name))}/><span className="color-dot" style={{background:v.color_hex}}/><span><strong>{v.color_name}</strong><small>{selected.supplier_catalog_variants.filter(x=>x.color_name===v.color_name).length} sizes</small></span></label>)}</div>
   <button className="primary-button" disabled={busy||!colors.length} onClick={importProduct}>{busy?'Importing…':'Import selected colors'}</button>
   {message&&<div className={message.startsWith('Imported')?'success-message':'error-message catalog-message'}>{message}</div>}
  </>}</aside>
 </div>
}
