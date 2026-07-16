import Link from "next/link";
import { getAdminContext } from "@/lib/admin-data";

function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }

export default async function OrdersPage(){
 const {supabase,shop}=await getAdminContext();
 if(!shop) return <p>No shop configured.</p>;
 const {data:orders}=await supabase.from('designs').select('id, display_id, customer_name, customer_email, package_label, package_price, shirt_color_name, status, created_at').eq('shop_id',shop.id).order('created_at',{ascending:false});
 const items=orders||[];
 return <>
  <header className="admin-header"><div><p className="eyebrow">ORDER MANAGEMENT</p><h1>Design submissions</h1><p>Track every saved design from customer upload through delivery.</p></div><a className="secondary-button" href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">Create test order ↗</a></header>
  <section className="order-summary-strip"><div><strong>{items.length}</strong><span>Total</span></div><div><strong>{items.filter(o=>o.status==='awaiting_payment').length}</strong><span>Awaiting payment</span></div><div><strong>{items.filter(o=>o.status==='paid').length}</strong><span>Paid</span></div><div><strong>{items.filter(o=>o.status==='delivered').length}</strong><span>Delivered</span></div></section>
  <section className="admin-card orders-page-card">
   <div className="card-heading"><div><p className="section-kicker">ALL ORDERS</p><h2>Customer designs</h2></div><span className="table-count">{items.length} records</span></div>
   {items.length ? <div className="dashboard-table order-full-table"><div className="dashboard-table-head"><span>Order</span><span>Customer</span><span>Product</span><span>Value</span><span>Status</span><span>Date</span></div>{items.map(o=><Link key={o.id} href={`/dashboard/orders/${o.id}`} className="dashboard-table-row"><span><strong>{o.display_id}</strong><small>{o.shirt_color_name}</small></span><span><strong>{o.customer_name}</strong><small>{o.customer_email}</small></span><span>{o.package_label}</span><span>${Number(o.package_price||0).toFixed(2)}</span><span><em className={`status-badge status-${o.status}`}>{o.status.replaceAll('_',' ')}</em></span><span>{formatDate(o.created_at)}</span></Link>)}</div> : <div className="dashboard-empty"><span>01</span><h3>No orders yet</h3><p>Your first submitted customer design will appear here with artwork, quantities and payment status.</p></div>}
  </section>
 </>;
}
