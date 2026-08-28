import { getAdvancedAdminContext } from "@/lib/advanced-admin";

function cash(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0); }

export const dynamic = "force-dynamic";

export default async function AdvancedCustomers() {
  const { db, shop } = await getAdvancedAdminContext();
  const { data: orders } = await db.from("orders").select("customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,total,created_at,channel,payment_status").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(1000);

  const map = new Map<string, any>();
  for (const order of orders || []) {
    const email = String((order as any).customer_email_snapshot || "").toLowerCase();
    if (!email) continue;
    const current = map.get(email) || { email, name: (order as any).customer_name_snapshot || email.split("@")[0], phone: (order as any).customer_phone_snapshot || "", orders: 0, total: 0, school: 0, last: (order as any).created_at };
    current.orders += 1;
    if ((order as any).payment_status === "paid") current.total += Number((order as any).total || 0);
    if ((order as any).channel === "storefront") current.school += 1;
    if (!current.phone && (order as any).customer_phone_snapshot) current.phone = (order as any).customer_phone_snapshot;
    map.set(email, current);
  }
  const customers = [...map.values()].sort((a,b)=>b.total-a.total);

  return <>
    <header className="ae-page-head">
      <div className="copy"><p className="ae-kicker">CUSTOMERS</p><h1>Who keeps coming back?</h1><p>Customer history is built from actual Advanced orders, including parents ordering Espirito Santo uniforms.</p></div>
    </header>
    {customers.length ? <section className="ae-customer-grid">
      {customers.map((c) => <article className="ae-customer" key={c.email}>
        <header><span>{c.name.slice(0,1).toUpperCase()}</span><div><h3>{c.name}</h3><small>{c.email}{c.phone ? ` · ${c.phone}` : ""}</small></div></header>
        <div className="ae-customer-stats">
          <div><b>{c.orders}</b><span>orders</span></div>
          <div><b>{cash(c.total)}</b><span>paid lifetime</span></div>
          <div><b>{c.school}</b><span>school orders</span></div>
          <div><b>{new Date(c.last).toLocaleDateString()}</b><span>last order</span></div>
        </div>
      </article>)}
    </section> : <section className="ae-card ae-empty"><span>00</span><h3>No customers yet</h3><p>Customer profiles build automatically from new orders.</p></section>}
  </>;
}
