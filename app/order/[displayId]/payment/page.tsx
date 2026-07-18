import { notFound } from "next/navigation";
import PaymentRetryButton from "@/components/PaymentRetryButton";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeShopSettings } from "@/lib/shop-settings";

export const dynamic = "force-dynamic";
export default async function PaymentPage({ params, searchParams }: { params: Promise<{ displayId: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const { displayId } = await params;
  const query = await searchParams;
  const { data } = await createSupabaseAdmin().from("designs").select("display_id,product_name,package_quantity,package_price,status,shops(name,slug,settings)").eq("display_id", displayId).single();
  if (!data) notFound();
  const shop = Array.isArray(data.shops) ? data.shops[0] : data.shops;
  const settings = normalizeShopSettings(shop?.settings);
  return <main className="payment-status-shell" style={{ "--brand": settings.brand.primaryColor, "--brand-text": settings.brand.textColor } as React.CSSProperties}><section className="payment-status-card"><div className="payment-brand">{settings.brand.logoUrl ? <img src={settings.brand.logoUrl} alt={shop?.name || "Print shop"}/> : <span>{shop?.name?.slice(0, 1) || "P"}</span>}</div><p className="eyebrow">ORDER {data.display_id}</p><h1>{query.cancelled ? "Your order is saved." : "Ready for payment."}</h1><p>{query.cancelled ? "Payment was canceled, but your artwork and order details are safe. Continue whenever you are ready." : "Complete secure payment to send this order into production review."}</p><div className="payment-order-summary"><div><span>Product</span><b>{data.product_name}</b></div><div><span>Quantity</span><b>{data.package_quantity}</b></div><div><span>Total</span><b>${Number(data.package_price).toFixed(2)}</b></div></div>{data.status === "paid" ? <a className="designer-primary" href={`/order/${data.display_id}/success`}>View paid order</a> : <PaymentRetryButton displayId={data.display_id}/>}<small>Payments are processed by the print shop’s connected Stripe or Square account.</small></section></main>;
}
