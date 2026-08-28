import Link from "next/link";
import { notFound } from "next/navigation";
import AdvancedAdminOrderStatus from "@/components/AdvancedAdminOrderStatus";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

function cash(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0); }
function pretty(value: string) { return String(value || "").replaceAll("_", " "); }

export const dynamic = "force-dynamic";

export default async function AdvancedOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, shop } = await getAdvancedAdminContext();

  const { data: order } = await db.from("orders").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: payments }, { data: history }] = await Promise.all([
    db.from("order_items").select("*").eq("order_id", order.id).order("created_at"),
    db.from("payments").select("*").eq("order_id", order.id).order("created_at"),
    db.from("order_status_history").select("*").eq("order_id", order.id).order("created_at", { ascending: false })
  ]);

  const itemIds = (items || []).map((x: any) => x.id);
  const { data: quantities } = itemIds.length ? await db.from("order_item_quantities").select("*").in("order_item_id", itemIds) : { data: [] as any[] };

  const designIds = (items || []).map((x: any) => x.design_id).filter(Boolean);
  let artwork: { original?: string; preview?: string; filename?: string } = {};
  if (designIds.length) {
    const { data: design } = await db.from("designs").select("original_artwork_path,preview_path,original_filename").eq("id", designIds[0]).maybeSingle();
    if (design?.original_artwork_path) {
      const signed = await db.storage.from("artwork").createSignedUrl(design.original_artwork_path, 3600);
      artwork.original = signed.data?.signedUrl;
    }
    if (design?.preview_path) {
      const signed = await db.storage.from("previews").createSignedUrl(design.preview_path, 3600);
      artwork.preview = signed.data?.signedUrl;
    }
    artwork.filename = design?.original_filename || undefined;
  }

  return <>
    <header className="ae-page-head">
      <div className="copy"><p className="ae-kicker">ORDER {order.display_id}</p><h1>{order.customer_name_snapshot || "Customer order"}</h1><p>{order.channel === "storefront" ? "Espirito Santo School Uniforms" : "Custom Apparel"} · {pretty(order.payment_status)} · {cash(Number(order.total || 0))}</p></div>
      <div className="ae-page-actions"><Link className="ae-button" href="/advanced-admin/orders">← Orders</Link></div>
    </header>

    <section className="ae-order-meta">
      <div><span>Email</span><b>{order.customer_email_snapshot || "—"}</b></div>
      <div><span>Phone</span><b>{order.customer_phone_snapshot || "—"}</b></div>
      <div><span>Due date</span><b>{order.requested_due_date || "Not selected"}</b></div>
      <div><span>Rush fee</span><b>{cash(Number(order.rush_fee || 0))}</b></div>
    </section>

    <section className="ae-grid-2">
      <div style={{display:"grid",gap:16}}>
        <article className="ae-card">
          <div className="ae-card-head"><div><p className="ae-kicker">ORDER ITEMS</p><h2>What to produce</h2></div></div>
          {(items || []).map((item: any) => {
            const sizes = (quantities || []).filter((q: any) => q.order_item_id === item.id);
            return <div className="ae-line-item" key={item.id}>
              <div><strong>{item.product_name_snapshot}</strong><span>{item.color_name || "Preset color"}</span></div>
              <span>{item.decoration_method || "Preset"} · {item.decoration_location || "Preset location"}</span>
              <span>{sizes.map((q: any) => `${q.size_name} × ${q.quantity}`).join(" · ") || `${item.quantity} total`}</span>
              <b>{cash(Number(item.line_total || 0))}</b>
            </div>;
          })}
        </article>

        {designIds.length ? <article className="ae-card">
          <div className="ae-card-head"><div><p className="ae-kicker">ARTWORK</p><h2>Production files</h2></div></div>
          <p style={{fontSize:9,color:"var(--ae-muted)"}}>{artwork.filename || "Customer artwork is attached to this custom order."}</p>
          <div className="ae-artwork-links">
            {artwork.original && <a className="ae-button primary" href={artwork.original} target="_blank" rel="noreferrer">Original artwork ↗</a>}
            {artwork.preview && <a className="ae-button" href={artwork.preview} target="_blank" rel="noreferrer">Customer mockup ↗</a>}
          </div>
        </article> : null}

        <article className="ae-card">
          <div className="ae-card-head"><div><p className="ae-kicker">PAYMENT</p><h2>Payment record</h2></div></div>
          {(payments || []).length ? (payments || []).map((payment: any) => <div className="ae-line-item" key={payment.id}>
            <div><strong>{String(payment.provider).toUpperCase()}</strong><span>{payment.provider_order_id || payment.provider_payment_id || "Payment"}</span></div>
            <span>{pretty(payment.status)}</span><span>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "Not paid yet"}</span><b>{cash(Number(payment.amount || 0))}</b>
          </div>) : <p style={{fontSize:9,color:"var(--ae-muted)"}}>No payment record yet.</p>}
        </article>
      </div>

      <aside style={{display:"grid",gap:16,alignContent:"start"}}>
        <article className="ae-card">
          <div className="ae-card-head"><div><p className="ae-kicker">PRODUCTION</p><h2>Move this job</h2></div></div>
          <AdvancedAdminOrderStatus orderId={order.id} current={order.status} />
        </article>

        <article className="ae-card">
          <div className="ae-card-head"><div><p className="ae-kicker">HISTORY</p><h2>Order timeline</h2></div></div>
          <div className="ae-history">
            {(history || []).map((h: any) => <article key={h.id}><span/><div><b>{pretty(h.to_status)}</b><small>{new Date(h.created_at).toLocaleString()}{h.note ? ` · ${h.note}` : ""}</small></div></article>)}
          </div>
        </article>
      </aside>
    </section>
  </>;
}
