import Link from "next/link";
import { redirect } from "next/navigation";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";
import { getAdminContext } from "@/lib/admin-data";
import { platformShopAccess } from "@/lib/shop-mode";

function date(v:string){return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(v))}
export const dynamic="force-dynamic";

export default async function BrandOrdersPage(){
  const {supabase,shop}=await getAdminContext();
  if(!shop)return null;
  if(!platformShopAccess(shop.settings).brandMerch)redirect("/dashboard/mode");
  const {data}=await supabase.from("designs").select("id,display_id,customer_name,customer_email,product_name,package_quantity,package_price,paid_amount,status,payment_status,created_at,design_configuration,brand_design_snapshot").eq("shop_id",shop.id).eq("order_source","brand").order("created_at",{ascending:false});
  const rows=data||[];
  const paid=rows.filter((x:any)=>x.payment_status==="paid"||["paid","in_production","delivered"].includes(x.status));
  const revenue=paid.reduce((s:number,x:any)=>s+Number(x.paid_amount??x.package_price??0),0);
  return <><BrandWorkflowRail active="sales"/><header className="admin-header"><div><p className="eyebrow">BRAND BUILDER · STEP 04</p><h1>Sales & customer builds</h1><p>Every order preserves the garment, selected front/back designs, pricing, production artwork, and customer mockups.</p></div><Link className="secondary-button" href="/preview/brand" target="_blank">Preview Builder ↗</Link></header>
  <section className="order-summary-strip"><div><strong>{rows.length}</strong><span>Brand orders</span></div><div><strong>{paid.length}</strong><span>Paid</span></div><div><strong>${revenue.toFixed(2)}</strong><span>Revenue</span></div><div><strong>{rows.reduce((s:number,x:any)=>s+Number(x.package_quantity||0),0)}</strong><span>Items built</span></div></section>
  <section className="admin-card orders-page-card"><div className="card-heading"><div><p className="section-kicker">CUSTOMER BUILDS</p><h2>Garment + design orders</h2></div><span className="table-count">{rows.length} records</span></div>{rows.length?<div className="dashboard-table order-full-table"><div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Garment</span><span>Designs</span><span>Units</span><span>Value</span><span>Date</span></div>{rows.map((x:any)=>{const selections=Array.isArray(x.design_configuration?.designSelections)?x.design_configuration.designSelections:[];return <Link key={x.id} href={`/dashboard/orders/${x.id}`} className="dashboard-table-row"><span><strong>{x.display_id}</strong><small>{x.payment_status||x.status}</small></span><span><strong>{x.customer_name}</strong><small>{x.customer_email}</small></span><span>{x.product_name}</span><span>{selections.length?selections.map((d:any)=>d.name).join(" + "):"Brand design"}</span><span>{x.package_quantity}</span><span>${Number(x.paid_amount??x.package_price??0).toFixed(2)}</span><span>{date(x.created_at)}</span></Link>})}</div>:<div className="dashboard-empty"><span>01</span><h3>No Brand customer builds yet</h3><p>Orders will appear here with front/back mockups and production files.</p></div>}</section></>;
}
