import Link from "next/link";
import { redirect } from "next/navigation";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeBrandBusinessProfile } from "@/lib/brand-retail";
import { designOffer } from "@/lib/brand-builder";
import { platformShopAccess } from "@/lib/shop-mode";

export const dynamic="force-dynamic";

export default async function BrandStorefrontControls(){
  const {supabase,shop}=await getAdminContext();
  if(!shop)return null;
  if(!platformShopAccess(shop.settings).brandMerch)redirect("/dashboard/mode");
  const [{data:businessRow},{data:garments},{data:designs},{count:payments}]=await Promise.all([
    supabase.from("brand_business_profiles").select("id,name,settings").eq("shop_id",shop.id).maybeSingle(),
    supabase.from("brand_garments").select("id,active,configuration").eq("shop_id",shop.id),
    supabase.from("brand_designs").select("id,active,metadata").eq("shop_id",shop.id),
    supabase.from("integration_connections").select("id",{count:"exact",head:true}).eq("shop_id",shop.id).eq("category","payment").eq("status","connected")
  ]);
  const business=normalizeBrandBusinessProfile(businessRow,shop.name);
  const garmentReady=(garments||[]).some((x:any)=>x.active&&Number(x.configuration?.retailPrice||0)>0);
  const designReady=(designs||[]).some((x:any)=>x.active&&Number((x.metadata as any)?.customerOffer?.retailPrice??0)>=0);
  const paymentReady=Number(payments||0)>0;
  const steps=[{label:"At least one priced garment",done:garmentReady,href:"/dashboard/brand-garments"},{label:"At least one approved design",done:designReady,href:"/dashboard/designs"},{label:"Payments connected",done:paymentReady,href:"/dashboard/integrations"},{label:"Brand store published",done:business.settings.active,href:"/dashboard/brand-settings"}];
  const score=Math.round(steps.filter(x=>x.done).length/steps.length*100);
  const origin=(process.env.NEXT_PUBLIC_SITE_URL||process.env.NEXT_PUBLIC_APP_URL||"").replace(/\/$/,"");
  const full=`${origin}/b/${shop.slug}`,embed=`${origin}/e/${shop.slug}`;
  return <><BrandWorkflowRail active="store"/><header className="admin-header"><div><p className="eyebrow">BRAND BUILDER · STEP 03</p><h1>Storefront controls</h1><p>Your Brand storefront is a guided builder: garment first, design second, size/quantity third. No fixed product URLs are required.</p></div><div className="header-actions"><Link className="ghost-button" href="/preview/brand" target="_blank">Preview Builder ↗</Link><Link className="secondary-button" href="/dashboard/brand-settings">Store Design</Link></div></header>
  <section className="admin-card storefront-v3-status"><div><span>{business.settings.active?"PUBLIC BUILDER · LIVE":"PUBLIC BUILDER · DRAFT"}</span><h2>{business.name}</h2><p>Customer flow: Garment → Design → Order</p></div><strong>{score}% ready</strong><Link className="primary-button" href="/preview/brand" target="_blank">Preview customer experience</Link></section>
  <div className="storefront-v3-grid"><section className="admin-card readiness"><div className="card-heading"><div><p className="section-kicker">LAUNCH CHECK</p><h2>Builder readiness</h2></div><strong>{steps.filter(x=>x.done).length}/{steps.length}</strong></div>{steps.map((x,i)=><Link key={x.label} href={x.href} className={x.done?"done":""}><span>{x.done?"✓":i+1}</span><div><strong>{x.label}</strong><small>{x.done?"Ready":"Needs attention"}</small></div><b>{x.done?"Ready":"Fix →"}</b></Link>)}</section>
  <aside className="admin-card builder-explainer"><p className="section-kicker">CUSTOMER EXPERIENCE</p><h2>How the Brand builder works</h2><div><span>1</span><p><strong>Choose garment</strong>Customer sees the garment base price.</p></div><div><span>2</span><p><strong>Add design</strong>Customer sees Front Heart, Front Full, and Back Full options approved for that garment.</p></div><div><span>3</span><p><strong>See mockups</strong>Front and back previews update before checkout.</p></div><div><span>4</span><p><strong>Order</strong>Garment price + design price(s) = unit price.</p></div></aside></div>
  <div className="storefront-links-v3"><section className="admin-card"><p className="section-kicker">FULL BUILDER</p><h2>{full}</h2><p>Use for direct Brand shopping links.</p><a className="secondary-button" href={`/b/${shop.slug}`} target="_blank">Open public route ↗</a></section><section className="admin-card"><p className="section-kicker">EMBED BUILDER</p><h2>{embed}</h2><p>Compact flow for embedding inside an existing Brand website.</p><a className="secondary-button" href={`/e/${shop.slug}`} target="_blank">Open embed route ↗</a></section></div>
  <style>{`.storefront-v3-status{display:grid;grid-template-columns:1fr auto auto;gap:18px;align-items:center;padding:18px;margin-bottom:10px;border-left:4px solid #1f2947}.storefront-v3-status span{font-size:7px;font-weight:900;letter-spacing:.1em;color:#777}.storefront-v3-status h2{margin:3px 0}.storefront-v3-status p{margin:0;color:#777}.storefront-v3-status>strong{font-size:24px}.storefront-v3-grid{display:grid;grid-template-columns:1fr 360px;gap:10px}.readiness,.builder-explainer{padding:17px}.readiness>a{display:grid;grid-template-columns:25px 1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #eee;color:inherit;text-decoration:none}.readiness>a>span{display:grid;place-items:center;width:23px;height:23px;border-radius:99px;background:#eee;font-size:7px}.readiness>a.done>span{background:#e8f4ec;color:#2c7a4e}.readiness strong,.readiness small{display:block}.readiness>a strong{font-size:8px}.readiness>a small{font-size:6px;color:#888}.readiness>a b{font-size:7px;color:#777}.builder-explainer h2{margin:3px 0 10px}.builder-explainer>div{display:grid;grid-template-columns:25px 1fr;gap:7px;align-items:start;padding:8px 0;border-bottom:1px solid #eee}.builder-explainer>div>span{display:grid;place-items:center;width:23px;height:23px;border-radius:99px;background:#1f2947;color:#fff;font-size:7px}.builder-explainer p{margin:0;font-size:7px;color:#777}.builder-explainer p strong{display:block;margin-bottom:2px;color:#171717;font-size:8px}.storefront-links-v3{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.storefront-links-v3>section{padding:17px}.storefront-links-v3 h2{font-size:12px}.storefront-links-v3 p:not(.section-kicker){color:#777;font-size:8px}@media(max-width:850px){.storefront-v3-status,.storefront-v3-grid,.storefront-links-v3{grid-template-columns:1fr}}`}</style></>;
}
