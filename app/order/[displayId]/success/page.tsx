import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { confirmSquareOrder, confirmStripeSession } from "@/lib/payments";
import { normalizeShopSettings } from "@/lib/shop-settings";

export const dynamic = "force-dynamic";
export default async function PaymentSuccessPage({ params, searchParams }: { params: Promise<{ displayId: string }>; searchParams: Promise<{ provider?: string; session_id?: string }> }) {
  const { displayId } = await params;
  const query = await searchParams;
  const supabase = createSupabaseAdmin();
  let { data } = await supabase.from("designs").select("id,display_id,shop_id,product_name,package_quantity,package_price,status,payment_provider,payment_reference,customer_email,shops(name,slug,settings)").eq("display_id", displayId).single();
  if (!data) notFound();
  if (data.status !== "paid") {
    if (query.provider === "stripe" && query.session_id) await confirmStripeSession(data as any, query.session_id);
    if (query.provider === "square" || data.payment_provider === "square") await confirmSquareOrder(data as any);
    const refreshed = await supabase.from("designs").select("id,display_id,shop_id,product_name,package_quantity,package_price,status,payment_provider,payment_reference,customer_email,shops(name,slug,settings)").eq("display_id", displayId).single();
    data = refreshed.data || data;
  }
  const shop = Array.isArray(data.shops) ? data.shops[0] : data.shops;
  const settings = normalizeShopSettings(shop?.settings);
  const paid = data.status === "paid";
  return <main className="payment-status-shell success" style={{ "--brand": settings.brand.primaryColor, "--brand-text": settings.brand.textColor } as React.CSSProperties}><section className="payment-status-card"><div className={paid ? "payment-success-mark" : "payment-pending-mark"}>{paid ? "✓" : "…"}</div><p className="eyebrow">ORDER {data.display_id}</p><h1>{paid ? "Payment received." : "Payment is being confirmed."}</h1><p>{paid ? settings.customerExperience?.confirmationMessage || "Your order and production artwork have been sent to the print shop." : "Your payment provider is still confirming the transaction. The shop has your order and will see the update automatically."}</p><div className="payment-order-summary"><div><span>Product</span><b>{data.product_name}</b></div><div><span>Quantity</span><b>{data.package_quantity}</b></div><div><span>Total</span><b>${Number(data.package_price).toFixed(2)}</b></div></div>{!paid && <a className="designer-primary" href={`/order/${data.display_id}/success?provider=${data.payment_provider || ""}`}>Check payment again</a>}<a className="payment-secondary-link" href={`/s/${shop?.slug}`}>Return to {shop?.name || "shop"}</a><small>A confirmation is associated with {data.customer_email}.</small></section></main>;
}
