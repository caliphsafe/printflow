"use client";

import { createClient } from "@supabase/supabase-js";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { brandArtworkUrl, garmentContrast } from "@/lib/brand-designs";
import { designOffer, designPlacementLabel, garmentSupportsOffer } from "@/lib/brand-builder";
import { printAreaFor } from "@/lib/catalog";
import type { BrandDesign, BrandDesignProductRule, BrandLockedPlacement } from "@/lib/brand-types";
import type { CatalogProduct, DesignSide, PrintSize } from "@/lib/types";

const W=800,H=800;
type VariantDraft={id?:string;variant_type:"light"|"dark"|"universal";artwork_path:string;original_filename?:string;mime_type?:string;active:boolean};
type Draft={id?:string;name:string;description:string;categoryId:string;newCategory:string;active:boolean;featured:boolean;retailPrice:number;side:DesignSide;printSize:PrintSize;variants:VariantDraft[];productRules:BrandDesignProductRule[]};

function assetUrl(url?:string){if(!url)return"";try{const u=new URL(url,window.location.origin);return u.hostname.endsWith("ssactivewear.com")?`/api/public/supplier-image?url=${encodeURIComponent(u.toString())}`:url}catch{return url}}
function key(side:DesignSide,size:PrintSize){return`${side}-${size}`}
function fresh():Draft{return{name:"",description:"",categoryId:"",newCategory:"",active:true,featured:false,retailPrice:0,side:"front",printSize:"full",variants:[{variant_type:"light",artwork_path:"",active:true},{variant_type:"dark",artwork_path:"",active:true},{variant_type:"universal",artwork_path:"",active:true}],productRules:[]}}
function fromDesign(d:BrandDesign):Draft{const offer=designOffer(d);return{id:d.id,name:d.name,description:d.description||"",categoryId:d.category_id||"",newCategory:"",active:d.active,featured:d.featured,retailPrice:offer.retailPrice,side:offer.side,printSize:offer.printSize,variants:(["light","dark","universal"]as const).map(t=>{const v=d.variants.find(x=>x.variant_type===t);return v?{id:v.id,variant_type:t,artwork_path:v.artwork_path,original_filename:v.original_filename||undefined,mime_type:v.mime_type||undefined,active:v.active}:{variant_type:t,artwork_path:"",active:true}}),productRules:d.productRules||[]}}
function defaultPlacement(product:CatalogProduct,side:DesignSide,size:PrintSize):BrandLockedPlacement{const a=printAreaFor(product.configuration,side,size);const w=Math.min(a.artworkWidth||a.width,a.width)*.82,h=Math.min(a.artworkHeight||a.height,a.height)*.82;return{enabled:true,side,printSize:size,decorationMethod:product.configuration.customization.decorationMethods[0]||"Screen Print",widthInches:Number(a.widthInches||4),heightInches:Number(a.heightInches||4),surcharge:0,placement:{x:a.defaultX??a.x+(a.width-w)/2,y:a.defaultY??a.y+(a.height-h)/2,width:w,height:h,rotation:0}}}

export default function BrandDesignManager({initialDesigns,categories,products}:{initialDesigns:BrandDesign[];categories:Array<{id:string;name:string}>;products:CatalogProduct[]}) {
  const [designs,setDesigns]=useState(initialDesigns);
  const [draft,setDraft]=useState<Draft>(initialDesigns[0]?fromDesign(initialDesigns[0]):fresh());
  const [selectedProductId,setSelectedProductId]=useState(initialDesigns[0]?.productRules?.[0]?.productId||products[0]?.id||"");
  const product=products.find(x=>x.id===selectedProductId)||products[0];
  const [colorId,setColorId]=useState(product?.configuration.defaultColorId||product?.configuration.colors[0]?.id||"");
  const [previewUrls,setPreviewUrls]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");
  const visible=useMemo(()=>designs.filter(x=>`${x.name} ${x.description||""}`.toLowerCase().includes(search.toLowerCase())),[designs,search]);

  const placementKey=key(draft.side,draft.printSize);
  const rule=draft.productRules.find(x=>x.productId===product?.id);
  const locked=rule?.placements?.[placementKey];
  const color=product?.configuration.colors.find(x=>x.id===colorId)||product?.configuration.colors[0];
  const contrast=color?garmentContrast(color as any):"light";
  const variant=draft.variants.find(x=>x.variant_type===contrast&&x.artwork_path)||draft.variants.find(x=>x.variant_type==="universal"&&x.artwork_path)||draft.variants.find(x=>x.artwork_path);
  const art=variant?(previewUrls[variant.variant_type]||(variant.id?brandArtworkUrl(variant.id):"")):"";

  function select(d:BrandDesign){const next=fromDesign(d);setDraft(next);const pid=next.productRules[0]?.productId||products[0]?.id||"";setSelectedProductId(pid);const p=products.find(x=>x.id===pid)||products[0];setColorId(p?.configuration.defaultColorId||p?.configuration.colors[0]?.id||"");setPreviewUrls({});setMessage("")}
  function patchRule(productId:string,up:(r:BrandDesignProductRule)=>BrandDesignProductRule){setDraft(c=>{const ex=c.productRules.find(x=>x.productId===productId);if(!ex)return c;return{...c,productRules:c.productRules.map(x=>x.productId===productId?up(x):x)}})}
  function assign(p:CatalogProduct,on:boolean){setDraft(c=>on?c.productRules.some(x=>x.productId===p.id)?c:{...c,productRules:[...c.productRules,{productId:p.id,placements:{[key(c.side,c.printSize)]:defaultPlacement(p,c.side,c.printSize)}}]}:{...c,productRules:c.productRules.filter(x=>x.productId!==p.id)})}
  function ensurePlacement(){if(!product)return;setDraft(c=>{const existing=c.productRules.find(x=>x.productId===product.id);const next=defaultPlacement(product,c.side,c.printSize);if(!existing)return{...c,productRules:[...c.productRules,{productId:product.id,placements:{[key(c.side,c.printSize)]:next}}]};return{...c,productRules:c.productRules.map(x=>x.productId===product.id?{...x,placements:{[key(c.side,c.printSize)]:x.placements[key(c.side,c.printSize)]||next}}:x)}})}
  function patchPlacement(patch:Partial<BrandLockedPlacement>){if(!product||!locked)return;patchRule(product.id,r=>({...r,placements:{...r.placements,[placementKey]:{...locked,...patch}}}))}

  async function upload(type:VariantDraft["variant_type"],file?:File){if(!file)return;setBusy(`upload-${type}`);setMessage("");try{const prep=await fetch("/api/admin/brand-designs/artwork",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:file.name,sizeBytes:file.size,variantType:type,designId:draft.id||"draft"})});const data=await prep.json();if(!prep.ok)throw new Error(data.error||"Unable to prepare upload.");const supa=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false}});const result=await supa.storage.from(data.bucket).uploadToSignedUrl(data.path,data.token,file,{contentType:data.contentType||file.type});if(result.error)throw result.error;const url=URL.createObjectURL(file);setPreviewUrls(c=>({...c,[type]:url}));setDraft(c=>({...c,variants:c.variants.map(v=>v.variant_type===type?{...v,artwork_path:data.path,original_filename:file.name,mime_type:data.contentType||file.type,active:true}:v)}))}catch(e){setMessage(e instanceof Error?e.message:"Upload failed.")}finally{setBusy("")}}
  async function save(){if(!draft.name.trim())return setMessage("Enter a design name.");if(!draft.variants.some(x=>x.artwork_path))return setMessage("Upload light, dark, or universal artwork.");if(!draft.productRules.length)return setMessage("Approve this design for at least one garment.");setBusy("save");setMessage("");try{const res=await fetch("/api/admin/brand-designs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({design:{...draft,customerOffer:{retailPrice:draft.retailPrice,side:draft.side,printSize:draft.printSize}}})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Unable to save design.");window.location.reload()}catch(e){setMessage(e instanceof Error?e.message:"Unable to save design.")}finally{setBusy("")}}
  async function remove(){if(!draft.id||!confirm(`Delete ${draft.name}?`))return;const res=await fetch(`/api/admin/brand-designs?id=${draft.id}`,{method:"DELETE"});if(res.ok)location.reload();}

  return <div className="brand-design-v3">
    <aside className="admin-card design-library-v3">
      <div className="library-title"><div><p className="eyebrow">DESIGNS</p><h2>Artwork library</h2></div><button onClick={()=>{setDraft(fresh());setMessage("");}}>New</button></div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search designs"/>
      <div className="design-list-v3">{visible.map(d=><button key={d.id} className={draft.id===d.id?"active":""} onClick={()=>select(d)}><span>{d.name.slice(0,2).toUpperCase()}</span><div><strong>{d.name}</strong><small>{designPlacementLabel(d)} · +${designOffer(d).retailPrice.toFixed(2)}</small></div></button>)}</div>
    </aside>

    <section className="design-editor-v3">
      <header className="admin-card design-head-v3"><div><p className="eyebrow">DESIGN OFFER</p><h1>{draft.id?draft.name:"New design"}</h1><p>Each design has one customer placement type and one add-on price. Approve it on the garments where it can be produced correctly.</p></div><label className="modern-switch"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/><span/><b>{draft.active?"Live":"Hidden"}</b></label></header>

      <div className="design-v3-grid">
        <div className="design-form-v3">
          <section className="admin-card">
            <div className="section-title"><span>01</span><div><h2>Design details & price</h2><p>Customers pay this design price in addition to the garment price.</p></div></div>
            <div className="clean-form-grid">
              <label><span>Design name</span><input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
              <label><span>Design price</span><div className="money-field"><b>$</b><input type="number" min="0" step=".50" value={draft.retailPrice||""} onChange={e=>setDraft({...draft,retailPrice:Math.max(0,Number(e.target.value)||0)})}/></div></label>
              <label><span>Category</span><select value={draft.categoryId} onChange={e=>setDraft({...draft,categoryId:e.target.value})}><option value="">Uncategorized</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label><span>New category</span><input value={draft.newCategory} onChange={e=>setDraft({...draft,newCategory:e.target.value})} placeholder="Optional"/></label>
              <label className="wide"><span>Description</span><textarea rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
            </div>
          </section>

          <section className="admin-card">
            <div className="section-title"><span>02</span><div><h2>Customer placement</h2><p>Choose exactly how this design is sold. Front Heart and Front Full are mutually exclusive choices for this design.</p></div></div>
            <div className="placement-choice-v3">
              <button className={draft.side==="front"&&draft.printSize==="heart"?"active":""} onClick={()=>{setDraft({...draft,side:"front",printSize:"heart",productRules:[]});setSelectedProductId(products[0]?.id||"")}}><span>FH</span><div><strong>Front · Heart Size</strong><small>Left/center chest style design</small></div></button>
              <button className={draft.side==="front"&&draft.printSize==="full"?"active":""} onClick={()=>{setDraft({...draft,side:"front",printSize:"full",productRules:[]});setSelectedProductId(products[0]?.id||"")}}><span>FF</span><div><strong>Front · Full Size</strong><small>Primary full-front design</small></div></button>
              <button className={draft.side==="back"?"active":""} onClick={()=>{setDraft({...draft,side:"back",printSize:"full",productRules:[]});setSelectedProductId(products[0]?.id||"")}}><span>BF</span><div><strong>Back · Full Size</strong><small>Full back design</small></div></button>
            </div>
          </section>

          <section className="admin-card">
            <div className="section-title"><span>03</span><div><h2>Artwork for garment colors</h2><p>Upload a version for light garments and dark garments. Universal is a fallback.</p></div></div>
            <div className="artwork-upload-v3">{draft.variants.map(v=><div key={v.variant_type}><strong>{v.variant_type==="light"?"Light garments":v.variant_type==="dark"?"Dark garments":"Universal fallback"}</strong><div className="art-preview-v3">{previewUrls[v.variant_type]?<img src={previewUrls[v.variant_type]} alt=""/>:v.id&&v.artwork_path?<img src={brandArtworkUrl(v.id)} alt=""/>:<span>No artwork</span>}</div><label>{busy===`upload-${v.variant_type}`?"Uploading…":v.artwork_path?"Replace artwork":"Upload artwork"}<input type="file" accept=".png,.jpg,.jpeg,.webp,.svg" disabled={!!busy} onChange={e=>{const input=e.currentTarget;void upload(v.variant_type,input.files?.[0]).finally(()=>input.value="")}}/></label></div>)}</div>
          </section>

          <section className="admin-card">
            <div className="section-title"><span>04</span><div><h2>Compatible garments</h2><p>Choose which Brand garments can offer this design. Then visually approve its exact placement on each garment.</p></div></div>
            <div className="compatible-garments-v3">{products.map(p=>{const assigned=draft.productRules.some(r=>r.productId===p.id);const supported=garmentSupportsOffer(p,{retailPrice:draft.retailPrice,side:draft.side,printSize:draft.printSize});return <label key={p.id} className={`${assigned?"selected":""} ${!supported?"disabled":""}`}><input type="checkbox" disabled={!supported} checked={assigned} onChange={e=>assign(p,e.target.checked)}/><span><strong>{p.name}</strong><small>{supported?`${p.configuration.colors.length} colors · ${p.configuration.sizes.length} sizes`:`This garment does not allow ${draft.side} ${draft.printSize}`}</small></span><i>{assigned?"✓":supported?"":"—"}</i></label>})}</div>
          </section>
        </div>

        <aside className="admin-card design-preview-v3">
          <div className="preview-heading-v3"><div><p className="eyebrow">PRODUCTION PREVIEW</p><h2>Approve placement</h2></div><span>{draft.side==="back"?"BACK":draft.printSize==="heart"?"FRONT HEART":"FRONT FULL"}</span></div>
          {product?<><select value={selectedProductId} onChange={e=>{setSelectedProductId(e.target.value);const p=products.find(x=>x.id===e.target.value);setColorId(p?.configuration.defaultColorId||p?.configuration.colors[0]?.id||"")}}>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <div className="preview-color-chips">{product.configuration.colors.map(c=><button key={c.id} className={color?.id===c.id?"active":""} title={c.name} onClick={()=>setColorId(c.id)}><i style={{background:c.hex}}/></button>)}</div>
          <DesignCanvas product={product} color={color} side={draft.side} art={art} placement={locked} onChange={patch=>patchPlacement({placement:patch})}/>
          {!rule&&<button className="approve-garment" onClick={()=>{assign(product,true);setTimeout(ensurePlacement,0)}}>Approve design for this garment</button>}
          {rule&&!locked&&<button className="approve-garment" onClick={ensurePlacement}>Create {draft.side} placement</button>}
          {locked&&<div className="placement-fields-v3"><label><span>Print width</span><div><input type="number" step=".25" value={locked.widthInches} onChange={e=>patchPlacement({widthInches:Number(e.target.value)||1})}/><b>in</b></div></label><label><span>Print height</span><div><input type="number" step=".25" value={locked.heightInches} onChange={e=>patchPlacement({heightInches:Number(e.target.value)||1})}/><b>in</b></div></label><label className="wide"><span>Decoration method</span><select value={locked.decorationMethod} onChange={e=>patchPlacement({decorationMethod:e.target.value})}>{product.configuration.customization.decorationMethods.map(m=><option key={m}>{m}</option>)}</select></label></div>}
          </>:<p>No Brand garments are available yet.</p>}
          <div className="design-price-preview"><span>Customer design add-on</span><strong>+${draft.retailPrice.toFixed(2)}</strong></div>
        </aside>
      </div>

      {message&&<div className={message.includes("saved")?"success-message":"error-message"}>{message}</div>}
      <div className="design-actions-v3">{draft.id&&<button className="danger-button" onClick={remove}>Delete</button>}<button className="primary-button" disabled={!!busy} onClick={save}>{busy==="save"?"Saving…":"Save design"}</button></div>
    </section>

    <style jsx>{`
      .brand-design-v3{display:grid;grid-template-columns:245px minmax(0,1fr);gap:12px;align-items:start}.design-library-v3{position:sticky;top:14px;padding:13px}.library-title{display:flex;justify-content:space-between;align-items:center}.library-title h2{margin:2px 0}.library-title button{padding:6px 8px;border:1px solid #ddd;border-radius:7px;background:#fff;font-size:7px}.design-library-v3>input{width:100%;box-sizing:border-box;margin:9px 0}.design-list-v3{display:grid;gap:4px}.design-list-v3 button{display:grid;grid-template-columns:32px 1fr;gap:7px;align-items:center;padding:7px;border:1px solid transparent;border-radius:8px;background:transparent;color:#171717;text-align:left}.design-list-v3 button.active{background:#f1f2f7;border-color:#d8dce8}.design-list-v3 button>span{display:grid;place-items:center;width:30px;height:30px;border-radius:7px;background:#1f2947;color:#fff;font-size:7px}.design-list-v3 strong,.design-list-v3 small{display:block}.design-list-v3 strong{font-size:8px}.design-list-v3 small{font-size:6px;color:#888}.design-editor-v3{display:grid;gap:10px}.design-head-v3{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:17px}.design-head-v3 h1{margin:3px 0}.design-head-v3 p:not(.eyebrow){max-width:700px;margin:0;color:#777}.design-v3-grid{display:grid;grid-template-columns:minmax(0,1fr) 410px;gap:10px;align-items:start}.design-form-v3{display:grid;gap:10px}.design-form-v3>section,.design-preview-v3{padding:17px}.section-title{display:grid;grid-template-columns:28px 1fr;gap:8px;align-items:start;margin-bottom:12px}.section-title>span{display:grid;place-items:center;width:27px;height:27px;border-radius:99px;background:#1f2947;color:#fff;font-size:7px;font-weight:900}.section-title h2{margin:1px 0;font-size:13px}.section-title p{margin:0;color:#888;font-size:7px}.clean-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.clean-form-grid label{display:grid;gap:4px}.clean-form-grid label>span{font-size:7px;font-weight:800}.clean-form-grid .wide{grid-column:1/-1}.money-field{display:grid;grid-template-columns:26px 1fr;align-items:center;border:1px solid #ddd;border-radius:7px}.money-field b{text-align:center}.money-field input{border:0}.placement-choice-v3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.placement-choice-v3 button{display:grid;grid-template-columns:32px 1fr;gap:7px;align-items:center;padding:9px;border:1px solid #ddd;border-radius:9px;background:#fff;color:#171717;text-align:left}.placement-choice-v3 button.active{border-color:#1f2947;background:#f0f2f8}.placement-choice-v3 button>span{display:grid;place-items:center;width:30px;height:30px;border-radius:7px;background:#eee;font-size:7px;font-weight:900}.placement-choice-v3 button.active>span{background:#1f2947;color:#fff}.placement-choice-v3 strong,.placement-choice-v3 small{display:block}.placement-choice-v3 strong{font-size:8px}.placement-choice-v3 small{font-size:6px;color:#888}.artwork-upload-v3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.artwork-upload-v3>div{display:grid;gap:6px;padding:8px;border:1px solid #ddd;border-radius:9px}.artwork-upload-v3 strong{font-size:7px}.art-preview-v3{height:120px;padding:10px;border-radius:7px;background:#f3f3ef}.art-preview-v3 img{width:100%;height:100%;object-fit:contain}.art-preview-v3 span{display:grid;place-items:center;height:100%;font-size:7px;color:#999}.artwork-upload-v3 label{padding:7px;border-radius:7px;background:#171717;color:#fff;text-align:center;font-size:7px}.artwork-upload-v3 input{display:none}.compatible-garments-v3{display:grid;grid-template-columns:1fr 1fr;gap:5px}.compatible-garments-v3 label{display:grid;grid-template-columns:auto 1fr 20px;gap:7px;align-items:center;padding:8px;border:1px solid #ddd;border-radius:8px}.compatible-garments-v3 label.selected{background:#f0f2f8;border-color:#c7cede}.compatible-garments-v3 label.disabled{opacity:.45;background:#f5f5f2}.compatible-garments-v3 strong,.compatible-garments-v3 small{display:block}.compatible-garments-v3 strong{font-size:8px}.compatible-garments-v3 small{font-size:6px;color:#888}.compatible-garments-v3 i{display:grid;place-items:center;width:18px;height:18px;border-radius:99px;background:#1f2947;color:#fff;font-size:7px;font-style:normal}.design-preview-v3{position:sticky;top:14px}.preview-heading-v3{display:flex;justify-content:space-between}.preview-heading-v3 h2{margin:2px 0}.preview-heading-v3>span{padding:5px 7px;border-radius:99px;background:#f0f2f8;color:#1f2947;font-size:6px;font-weight:900}.design-preview-v3>select{width:100%;margin:9px 0}.preview-color-chips{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:7px}.preview-color-chips button{display:grid;place-items:center;width:24px;height:24px;border:1px solid #ddd;border-radius:99px;background:#fff}.preview-color-chips button.active{border:2px solid #171717}.preview-color-chips i{width:15px;height:15px;border-radius:99px;border:1px solid rgba(0,0,0,.15)}.approve-garment{width:100%;margin-top:8px;padding:9px;border:0;border-radius:8px;background:#1f2947;color:#fff;font-size:8px;font-weight:800}.placement-fields-v3{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.placement-fields-v3 label>span{display:block;margin-bottom:4px;font-size:7px;font-weight:800}.placement-fields-v3 label>div{display:grid;grid-template-columns:1fr 25px;border:1px solid #ddd;border-radius:7px;overflow:hidden}.placement-fields-v3 input{border:0}.placement-fields-v3 b{display:grid;place-items:center;background:#eee;font-size:6px}.placement-fields-v3 .wide{grid-column:1/-1}.design-price-preview{display:flex;justify-content:space-between;align-items:center;margin-top:9px;padding:9px;border-radius:8px;background:#f3f3ef}.design-price-preview span{font-size:7px}.design-price-preview strong{font-size:14px}.design-actions-v3{display:flex;justify-content:flex-end;gap:7px}
      @media(max-width:1050px){.brand-design-v3{grid-template-columns:1fr}.design-library-v3{position:static}.design-v3-grid{grid-template-columns:1fr}.design-preview-v3{position:static}.design-list-v3{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:650px){.clean-form-grid,.placement-choice-v3,.artwork-upload-v3,.compatible-garments-v3{grid-template-columns:1fr}.design-list-v3{grid-template-columns:1fr}}
    `}</style>
  </div>;
}

function DesignCanvas({product,color,side,art,placement,onChange}:{product:CatalogProduct;color:any;side:DesignSide;art:string;placement?:BrandLockedPlacement;onChange:(p:BrandLockedPlacement["placement"])=>void}) {
  const ref=useRef<SVGSVGElement|null>(null),drag=useRef<any>(null);
  const img=side==="back"?color?.backImageUrl||product.configuration.mockupImageUrl:color?.frontImageUrl||product.configuration.mockupImageUrl;
  function point(e:ReactPointerEvent<SVGElement>){const r=ref.current!.getBoundingClientRect();return{x:((e.clientX-r.left)/r.width)*W,y:((e.clientY-r.top)/r.height)*H}}
  function begin(kind:"move"|"resize",e:ReactPointerEvent<SVGElement>){if(!placement)return;e.preventDefault();drag.current={kind,p:point(e),start:{...placement.placement}};e.currentTarget.setPointerCapture(e.pointerId)}
  function move(e:ReactPointerEvent<SVGElement>){if(!drag.current||!placement)return;const p=point(e),dx=p.x-drag.current.p.x,dy=p.y-drag.current.p.y,s=drag.current.start,a=printAreaFor(product.configuration,side,placement.printSize);let next={...s};if(drag.current.kind==="move"){next.x=Math.max(a.x,Math.min(a.x+a.width-s.width,s.x+dx));next.y=Math.max(a.y,Math.min(a.y+a.height-s.height,s.y+dy))}else{const ratio=s.height/s.width;let w=Math.max(35,Math.min(a.x+a.width-s.x,s.width+dx)),h=w*ratio;if(h>a.y+a.height-s.y){h=a.y+a.height-s.y;w=h/ratio}next.width=w;next.height=h}onChange(next)}
  return <svg ref={ref} viewBox="0 0 800 800" onPointerMove={move} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null} style={{width:"100%",background:"#f3f3ef",borderRadius:10}}>
    <rect width="800" height="800" fill="#f3f3ef"/>{img&&<image href={assetUrl(img)} x="28" y="28" width="744" height="744" preserveAspectRatio="xMidYMid meet"/>}{placement&&art&&<><image href={art} x={placement.placement.x} y={placement.placement.y} width={placement.placement.width} height={placement.placement.height} onPointerDown={e=>begin("move",e)} style={{cursor:"move"}}/><rect x={placement.placement.x} y={placement.placement.y} width={placement.placement.width} height={placement.placement.height} fill="none" stroke="#111" strokeWidth="2" pointerEvents="none"/><circle cx={placement.placement.x+placement.placement.width} cy={placement.placement.y+placement.placement.height} r="13" fill="#111" onPointerDown={e=>begin("resize",e)} style={{cursor:"nwse-resize"}}/></>}
  </svg>;
}
