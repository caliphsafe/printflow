import { notFound } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";

export default async function OrderPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const {supabase,shop}=await getAdminContext(); if(!shop) notFound();
 const {data:o}=await supabase.from('designs').select('*').eq('id',id).eq('shop_id',shop.id).single(); if(!o) notFound();
 const [art,preview]=await Promise.all([
  supabase.storage.from('artwork').createSignedUrl(o.original_artwork_path,3600),
  supabase.storage.from('previews').createSignedUrl(o.preview_path,3600)
 ]);
 return <><header className="admin-header"><div><p className="eyebrow">{o.display_id}</p><h1>{o.customer_name}</h1><p>{o.customer_email} {o.customer_phone ? `· ${o.customer_phone}`:''}</p></div><span className="status-pill">{o.status.replaceAll('_',' ')}</span></header>
 <div className="detail-grid"><section className="admin-card"><h2>Production details</h2><dl className="details-list"><div><dt>Package</dt><dd>{o.package_label}</dd></div><div><dt>Color</dt><dd>{o.shirt_color_name}</dd></div><div><dt>Location</dt><dd>{o.print_location}</dd></div><div><dt>Sizes</dt><dd>{(o.size_breakdown||[]).filter((x:any)=>x.quantity>0).map((x:any)=>`${x.size}: ${x.quantity}`).join(', ')}</dd></div><div><dt>Notes</dt><dd>{o.customer_notes||'—'}</dd></div></dl></section>
 <section className="admin-card"><h2>Files</h2>{preview.data?.signedUrl && <img className="order-preview" src={preview.data.signedUrl} alt="Shirt preview"/>}<div className="file-actions">{art.data?.signedUrl && <a className="secondary-button" href={art.data.signedUrl}>Download original</a>}{preview.data?.signedUrl && <a className="secondary-button" href={preview.data.signedUrl}>Download preview</a>}</div></section></div></>;
}
