import Link from "next/link";
import { getAdminContext } from "@/lib/admin-data";

export default async function DashboardPage() {
  const { supabase, organization, shop } = await getAdminContext();
  if (!organization || !shop) return <EmptySetup />;

  const [{ count: allOrders }, { count: awaiting }, { count: delivered }] = await Promise.all([
    supabase.from("designs").select("*", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("designs").select("*", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "awaiting_payment"),
    supabase.from("designs").select("*", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "delivered")
  ]);

  const { data: recent } = await supabase.from("designs").select("id, display_id, customer_name, package_label, status, created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(6);

  return <>
    <header className="admin-header"><div><p className="eyebrow">{organization.name}</p><h1>Order overview</h1></div><a className="secondary-button" href={`/s/${shop.slug}`} target="_blank">Open designer</a></header>
    <section className="stat-grid">
      <article><span>All designs</span><strong>{allOrders ?? 0}</strong></article>
      <article><span>Awaiting payment</span><strong>{awaiting ?? 0}</strong></article>
      <article><span>Delivered</span><strong>{delivered ?? 0}</strong></article>
    </section>
    <section className="admin-card"><div className="card-heading"><h2>Recent activity</h2><Link href="/dashboard/orders">View all</Link></div>
      <div className="order-list">{recent?.length ? recent.map(item=><Link key={item.id} href={`/dashboard/orders/${item.id}`} className="order-row"><div><strong>{item.display_id}</strong><span>{item.customer_name}</span></div><div><span>{item.package_label}</span><em>{item.status.replaceAll('_',' ')}</em></div></Link>) : <p className="empty-copy">No designs have been submitted yet.</p>}</div>
    </section>
  </>;
}

function EmptySetup(){return <section className="admin-card"><h1>Your account needs a shop.</h1><p>Run the onboarding SQL in the setup guide to connect your user to the pilot organization.</p></section>}
