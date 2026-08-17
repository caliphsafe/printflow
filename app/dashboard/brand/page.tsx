import Link from "next/link";
import { redirect } from "next/navigation";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeBrandBusinessProfile } from "@/lib/brand-retail";
import { designOffer } from "@/lib/brand-builder";
import { platformShopAccess } from "@/lib/shop-mode";

function money(v:number){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v)}

export const dynamic="force-dynamic";

export default async function BrandOverview(){
  const {supabase,shop}=await getAdminContext();
  if(!shop)return null;
  if(!platformShopAccess(shop.settings).brandMerch)redirect("/dashboard/mode");

  const [{data:businessRow},{data:garments},{data:designs},{data:orders},{count:payments}]=await Promise.all([
    supabase.from("brand_business_profiles").select("id,name,settings").eq("shop_id",shop.id).maybeSingle(),
    supabase.from("brand_garments").select("id,active,configuration").eq("shop_id",shop.id),
    supabase.from("brand_designs").select("id,name,active,metadata").eq("shop_id",shop.id),
    supabase.from("designs").select("id,display_id,customer_name,product_name,package_quantity,package_price,paid_amount,status,payment_status,created_at,design_configuration").eq("shop_id",shop.id).eq("order_source","brand").order("created_at",{ascending:false}).limit(50),
    supabase.from("integration_connections").select("id",{count:"exact",head:true}).eq("shop_id",shop.id).eq("category","payment").eq("status","connected")
  ]);
  const business=normalizeBrandBusinessProfile(businessRow,shop.name);
  const liveGarments=(garments||[]).filter((x:any)=>x.active&&Number(x.configuration?.retailPrice||0)>0);
  const liveDesigns=(designs||[]).filter((x:any)=>x.active&&designOffer({...x,variants:[],productIds:[],productRules:[]} as any).retailPrice>=0);
  const rows=orders||[];
  const paid=rows.filter((x:any)=>x.payment_status==="paid"||["paid","in_production","delivered"].includes(x.status));
  const revenue=paid.reduce((s:number,x:any)=>s+Number(x.paid_amount??x.package_price??0),0);
  const units=paid.reduce((s:number,x:any)=>s+Number(x.package_quantity||0),0);
  const ready=liveGarments.length>0&&liveDesigns.length>0&&Number(payments||0)>0;
  const steps=[
    {label:"Garments priced",done:liveGarments.length>0,href:"/dashboard/brand-garments",copy:`${liveGarments.length} ready`},
    {label:"Designs available",done:liveDesigns.length>0,href:"/dashboard/designs",copy:`${liveDesigns.length} ready`},
    {label:"Payments connected",done:Number(payments||0)>0,href:"/dashboard/integrations",copy:payments?"Connected":"Needs setup"},
    {label:"Store published",done:business.settings.active,href:"/dashboard/brand-settings",copy:business.settings.active?"Live":"Draft"}
  ];
  const completion=Math.round(steps.filter(x=>x.done).length/steps.length*100);

  return <><BrandWorkflowRail/><header className="admin-header"><div><p className="eyebrow">BRAND / MERCH · {business.name}</p><h1>Build-your-own merchandise.</h1><p>Your customer chooses a garment first, adds an approved design, sees the front/back mockup, then buys the finished piece.</p></div><div className="header-actions"><Link className="ghost-button" href="/preview/brand">Preview Builder</Link><Link className="secondary-button" href="/dashboard/designs">Add Design</Link></div></header>

  <section className="builder-model-card admin-card"><div><span>CUSTOMER FLOW</span><h2>Garment <i>+</i> Design <i>=</i> Finished item</h2><p>There are no fixed one-design products and no product URL step. Pricing is additive and transparent.</p></div><div className="builder-model-math"><div><small>Garment</small><strong>Base price</strong></div><b>+</b><div><small>Design</small><strong>Add-on price</strong></div><b>=</b><div><small>Customer pays</small><strong>Unit total</strong></div></div></section>

  <section className="brand-v3-metrics"><article><span>Gross sales</span><strong>{money(revenue)}</strong><small>{paid.length} paid Brand orders</small></article><article><span>Units sold</span><strong>{units}</strong><small>Build-your-own items</small></article><article><span>Live garments</span><strong>{liveGarments.length}</strong><small>{garments?.length||0} configured</small></article><article><span>Live designs</span><strong>{liveDesigns.length}</strong><small>{designs?.length||0} uploaded</small></article></section>

  <div className="brand-v3-grid"><section className="admin-card readiness-v3"><div className="card-heading"><div><p className="section-kicker">BUILDER READINESS</p><h2>{completion}% ready</h2></div><strong>{ready?"Builder ready":"Setup needed"}</strong></div><div className="readiness-bar"><i style={{width:`${completion}%`}}/></div><div className="readiness-list-v3">{steps.map((x,i)=><Link href={x.href} key={x.label} className={x.done?"done":""}><span>{x.done?"✓":i+1}</span><div><strong>{x.label}</strong><small>{x.copy}</small></div><b>{x.done?"Ready":"Fix →"}</b></Link>)}</div></section>
  <aside className="admin-card quick-v3"><p className="section-kicker">QUICK ACTIONS</p><h2>Keep building</h2><Link href="/dashboard/brand-garments"><span>01</span><div><strong>Garments & pricing</strong><small>Choose blanks and base prices</small></div></Link><Link href="/dashboard/designs"><span>02</span><div><strong>Designs & pricing</strong><small>Upload artwork and set add-on prices</small></div></Link><Link href="/preview/brand"><span>03</span><div><strong>Preview customer builder</strong><small>Test the full experience before launch</small></div></Link></aside></div>

  <section className="admin-card recent-v3"><div className="card-heading"><div><p className="section-kicker">RECENT BRAND ORDERS</p><h2>Built by customers</h2></div><Link href="/dashboard/brand-orders">All orders</Link></div>{rows.length?<div className="dashboard-table"><div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Garment</span><span>Units</span><span>Value</span><span>Status</span></div>{rows.slice(0,6).map((x:any)=><Link key={x.id} href={`/dashboard/orders/${x.id}`} className="dashboard-table-row"><span><strong>{x.display_id}</strong></span><span>{x.customer_name}</span><span>{x.product_name}</span><span>{x.package_quantity}</span><span>{money(Number(x.paid_amount??x.package_price??0))}</span><span>{String(x.payment_status==="paid"?"paid":x.status).replaceAll("_"," ")}</span></Link>)}</div>:<div className="dashboard-empty"><span>01</span><h3>No Brand orders yet</h3><p>Preview the builder, then publish when garments, designs, and payments are ready.</p></div>}</section>

  <style>{`
    .builder-model-card{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center;padding:18px;margin-bottom:10px;border-left:4px solid #1f2947}.builder-model-card>div:first-child>span{font-size:7px;font-weight:900;letter-spacing:.11em;color:#777}.builder-model-card h2{margin:4px 0;font-size:24px}.builder-model-card h2 i{color:#7e8496;font-style:normal}.builder-model-card p{margin:0;color:#777}.builder-model-math{display:flex;align-items:center;gap:8px}.builder-model-math>div{padding:9px 11px;border-radius:8px;background:#f3f3ef}.builder-model-math small,.builder-model-math strong{display:block}.builder-model-math small{font-size:6px;color:#888}.builder-model-math strong{font-size:9px}.brand-v3-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.brand-v3-metrics article{padding:14px;border:1px solid #e2e2dd;border-radius:11px;background:#fff}.brand-v3-metrics span,.brand-v3-metrics small{display:block}.brand-v3-metrics span{font-size:7px;color:#888;text-transform:uppercase}.brand-v3-metrics strong{display:block;margin:6px 0 2px;font-size:22px}.brand-v3-metrics small{font-size:7px;color:#888}.brand-v3-grid{display:grid;grid-template-columns:1fr 350px;gap:10px;margin-bottom:10px}.readiness-v3,.quick-v3,.recent-v3{padding:17px}.readiness-bar{height:5px;margin:8px 0;background:#eee;border-radius:99px;overflow:hidden}.readiness-bar i{display:block;height:100%;background:#1f2947}.readiness-list-v3{display:grid}.readiness-list-v3 a{display:grid;grid-template-columns:24px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #eee;color:inherit;text-decoration:none}.readiness-list-v3 a>span{display:grid;place-items:center;width:23px;height:23px;border-radius:99px;background:#eee;font-size:7px}.readiness-list-v3 a.done>span{background:#e8f4ec;color:#2c7a4e}.readiness-list-v3 strong,.readiness-list-v3 small{display:block}.readiness-list-v3 strong{font-size:8px}.readiness-list-v3 small{font-size:6px;color:#888}.readiness-list-v3 b{font-size:7px;color:#777}.quick-v3{display:grid;align-content:start;gap:6px}.quick-v3 h2{margin:2px 0 8px}.quick-v3>a{display:grid;grid-template-columns:27px 1fr;gap:7px;align-items:center;padding:9px;border-radius:8px;background:#f3f3ef;color:inherit;text-decoration:none}.quick-v3>a>span{display:grid;place-items:center;width:25px;height:25px;border-radius:99px;background:#1f2947;color:#fff;font-size:7px}.quick-v3 strong,.quick-v3 small{display:block}.quick-v3 strong{font-size:8px}.quick-v3 small{font-size:6px;color:#888}.recent-v3{margin-bottom:25px}@media(max-width:900px){.builder-model-card,.brand-v3-grid{grid-template-columns:1fr}.brand-v3-metrics{grid-template-columns:1fr 1fr}.builder-model-math{flex-wrap:wrap}}@media(max-width:560px){.brand-v3-metrics{grid-template-columns:1fr}}
  `}</style></>;
}
