import { notFound } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import OrderBlanksButton from "@/components/OrderBlanksButton";
import BlankOrderDraftButton from "@/components/BlankOrderDraftButton";
export const dynamic="force-dynamic";
export default async function OrderPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const {supabase,shop}=await getAdminContext(); if(!shop)notFound();
 const [{data:o},{data:supplierOrder},{data:connection},{data:draft}]=await Promise.all([
  supabase.from('designs').select('*').eq('id',id).eq('shop_id',shop.id).single(),
  supabase.from('supplier_orders').select('*').eq('design_id',id).eq('provider','ss-activewear').maybeSingle(),
  supabase.from('supplier_connections').select('settings,status').eq('shop_id',shop.id).eq('provider','ss-activewear').maybeSingle(),
  supabase.from('supplier_order_drafts').select('status,estimated_total').eq('design_id',id).maybeSingle()
 ]); if(!o)notFound();
 const [art,preview]=await Promise.all([supabase.storage.from('artwork').createSignedUrl(o.original_artwork_path,3600),supabase.storage.from('previews').createSignedUrl(o.preview_path,3600)]);
 const supplierItems=Array.isArray(o.supplier_items)?o.supplier_items:[]; const testMode=connection?.settings?.testMode!==false;
 return <><header className="admin-header"><div><p className="eyebrow">{o.display_id}</p><h1>{o.customer_name}</h1><p>{o.customer_email} {o.customer_phone?`· ${o.customer_phone}`:''}</p></div><span className="status-pill">{o.status.replaceAll('_',' ')}</span></header>
 <div className="detail-grid"><section className="admin-card"><h2>Production details</h2><dl className="details-list"><div><dt>Product</dt><dd>{o.product_name}</dd></div><div><dt>Package</dt><dd>{o.package_label}</dd></div><div><dt>Color</dt><dd>{o.shirt_color_name}</dd></div><div><dt>Location</dt><dd>{o.print_location}</dd></div><div><dt>Sizes</dt><dd>{(o.size_breakdown||[]).filter((x:any)=>x.quantity>0).map((x:any)=>`${x.size}: ${x.quantity}`).join(', ')}</dd></div><div><dt>Notes</dt><dd>{o.customer_notes||'—'}</dd></div></dl></section>
 <section className="admin-card"><h2>Files</h2>{preview.data?.signedUrl&&<img className="order-preview" src={preview.data.signedUrl} alt="Shirt preview"/>}<div className="file-actions">{art.data?.signedUrl&&<a className="secondary-button" href={art.data.signedUrl}>Download original</a>}{preview.data?.signedUrl&&<a className="secondary-button" href={preview.data.signedUrl}>Download preview</a>}</div></section></div>
 {supplierItems.length>0&&<section className="admin-card supplier-order-card"><div className="card-heading"><div><p className="eyebrow">SUPPLIER FULFILLMENT</p><h2>Blank purchase</h2></div><span className="status-pill">{connection?.status==='connected'?(testMode?'S&S test mode':'S&S live ordering'):'Draft workflow'}</span></div><div className="supplier-line-list">{supplierItems.map((x:any)=><div className="supplier-line" key={x.sku}><div><strong>{x.brandName} {x.styleName}</strong><span>{x.colorName} · {x.sizeName}</span></div><div><strong>{x.quantity} pcs</strong><span>{x.sku}</span></div></div>)}</div><BlankOrderDraftButton designId={o.id} enabled={o.status==='paid'&&supplierItems.length>0} existing={draft}/>{supplierOrder&&<div className="supplier-order-confirmation"><span>S&S order number</span><strong>{(supplierOrder.external_order_numbers||[]).join(', ')||'Submitted'}</strong></div>}<OrderBlanksButton designId={o.id} enabled={o.status==='paid'&&connection?.status==='connected'&&supplierItems.length>0} testMode={testMode} alreadyOrdered={Boolean(supplierOrder)}/></section>}
 </>;
}
