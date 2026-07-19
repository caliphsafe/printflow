"use client";
import { useState } from "react";

type Style={styleId:string;brandName:string;styleName:string;title:string;description:string;partNumber:string;imageUrl:string};
type Product={sku:string;skuId:string;gtin:string;styleId:string;brandName:string;styleName:string;title:string;partNumber:string;colorName:string;sizeName:string;customerPrice:number;quantity:number;colorHex:string;swatchImageUrl:string;frontImageUrl:string;backImageUrl:string};
export default function SSCatalogImporter({connected}:{connected:boolean}){
 const [open,setOpen]=useState(false),[q,setQ]=useState(''),[styles,setStyles]=useState<Style[]>([]),[products,setProducts]=useState<Product[]>([]),[selected,setSelected]=useState<string[]>([]),[loading,setLoading]=useState(false),[message,setMessage]=useState('');
 async function search(){if(q.trim().length<2)return;setLoading(true);setMessage('');const r=await fetch(`/api/admin/suppliers/ss/styles?q=${encodeURIComponent(q)}`);const d=await r.json();setLoading(false);if(!r.ok)return setMessage(d.error||'Unable to search.');setStyles(d.styles||[]);}
 async function choose(style:Style){setLoading(true);setMessage('');const r=await fetch(`/api/admin/suppliers/ss/style/${style.styleId}`);const d=await r.json();setLoading(false);if(!r.ok)return setMessage(d.error||'Unable to load style.');setProducts(d.products||[]);setSelected(Array.from(new Set((d.products||[]).map((x:Product)=>x.colorName))));}
 async function importStyle(){setLoading(true);setMessage('');const r=await fetch('/api/admin/suppliers/ss/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({products,selectedColors:selected})});const d=await r.json();setLoading(false);if(!r.ok)return setMessage(d.error||'Unable to import.');window.location.reload();}
 const colors=Array.from(new Map(products.map(x=>[x.colorName,x])).values());
 return <>
  <button className="secondary-button compact" disabled={!connected} onClick={()=>setOpen(true)}>S&amp;S catalog</button>
  {!connected&&<small className="supplier-import-hint">Connect S&amp;S under Integrations first.</small>}
  {open&&<div className="modal-backdrop" onMouseDown={()=>setOpen(false)}><div className="supplier-modal" onMouseDown={e=>e.stopPropagation()}>
   <div className="modal-head"><div><p className="eyebrow">S&amp;S ACTIVEWEAR</p><h2>Import blank garments</h2></div><button className="icon-button" onClick={()=>setOpen(false)}>×</button></div>
   {!products.length?<><div className="supplier-search"><input placeholder="Search Gildan 5000, Bella 3001…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}/><button className="primary-button fit-button" disabled={loading} onClick={search}>{loading?'Searching…':'Search'}</button></div>
    <div className="supplier-style-results">{styles.map(style=><button key={style.styleId} className="supplier-style-row" onClick={()=>choose(style)}><div><strong>{style.brandName} {style.styleName}</strong><span>{style.title}</span><small>{style.partNumber}</small></div><span>View colors →</span></button>)}</div></>:
    <><button className="text-button" onClick={()=>{setProducts([]);setSelected([])}}>← Back to search</button><div className="import-style-summary"><div><strong>{products[0]?.brandName} {products[0]?.styleName}</strong><span>{products[0]?.title}</span></div><small>{colors.length} colors · {new Set(products.map(x=>x.sizeName)).size} sizes · {products.length} SKUs</small></div>
    <div className="supplier-color-grid">{colors.map(color=><label key={color.colorName} className={selected.includes(color.colorName)?'supplier-color-card selected':'supplier-color-card'}><input type="checkbox" checked={selected.includes(color.colorName)} onChange={e=>setSelected(e.target.checked?[...selected,color.colorName]:selected.filter(x=>x!==color.colorName))}/>{color.frontImageUrl?<img src={color.frontImageUrl} alt=""/>:<span className="supplier-color-placeholder" style={{background:color.colorHex}}/>}<strong>{color.colorName}</strong><small>{products.filter(x=>x.colorName===color.colorName).length} sizes</small></label>)}</div>
    <div className="modal-actions"><span>{selected.length} colors selected</span><button className="primary-button fit-button" disabled={loading||!selected.length} onClick={importStyle}>{loading?'Importing…':'Import selected blank'}</button></div></>}
   {message&&<div className="error-message catalog-message">{message}</div>}
  </div></div>}
 </>;
}
