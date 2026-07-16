import Link from "next/link";
import { getAdminContext } from "@/lib/admin-data";

export default async function OrdersPage(){
 const {supabase,shop}=await getAdminContext();
 if(!shop) return <p>No shop configured.</p>;
 const {data:orders}=await supabase.from('designs').select('id, display_id, customer_name, customer_email, package_label, shirt_color_name, status, created_at').eq('shop_id',shop.id).order('created_at',{ascending:false});
 return <><header className="admin-header"><div><p className="eyebrow">ORDERS</p><h1>Design submissions</h1></div></header><section className="admin-card"><div className="order-list">{orders?.map(o=><Link key={o.id} href={`/dashboard/orders/${o.id}`} className="order-row"><div><strong>{o.display_id}</strong><span>{o.customer_name} · {o.customer_email}</span></div><div><span>{o.package_label} · {o.shirt_color_name}</span><em>{o.status.replaceAll('_',' ')}</em></div></Link>)}</div></section></>;
}
