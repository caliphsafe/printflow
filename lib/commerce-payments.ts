import crypto from "node:crypto";
import { decryptSecret } from "@/lib/crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getLivePaymentConnection } from "@/lib/payments";

const SQUARE_VERSION = "2026-05-20";
const cents = (v:number) => Math.max(0, Math.round(Number(v || 0) * 100));

export type CommerceOrder = { id:string; display_id:string; organization_id:string; shop_id:string; total:number; currency:string; customer_email_snapshot?:string|null; customer_name_snapshot?:string|null; metadata?:any; };

function originFrom(requestUrl:string) { return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(requestUrl).origin; }

export async function createSquareCheckoutForOrder(order: CommerceOrder, requestUrl: string, label = "Advanced Embroidery order") {
  const connection:any = await getLivePaymentConnection(order.shop_id, "square");
  if (!connection || connection.provider !== "square") throw new Error("Advanced Square checkout is not connected yet.");
  const values = JSON.parse(decryptSecret(connection.encrypted_credentials)) as Record<string,string>;
  const environment = values.environment === "sandbox" ? "sandbox" : "production";
  const base = environment === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  const locationId = connection.configuration?.locationId || values.locationId;
  if (!values.accessToken || !locationId) throw new Error("Square credentials are missing an active location.");
  const origin = originFrom(requestUrl);
  const response = await fetch(`${base}/v2/online-checkout/payment-links`, { method:"POST", headers:{ Authorization:`Bearer ${values.accessToken}`, "Square-Version":SQUARE_VERSION, "Content-Type":"application/json" }, body:JSON.stringify({
    idempotency_key: crypto.randomUUID(), description:`PrintFlow order ${order.display_id}`,
    quick_pay:{ name:label, price_money:{ amount:cents(order.total), currency:String(connection.configuration?.currency || order.currency || "USD").toUpperCase() }, location_id:locationId },
    checkout_options:{ redirect_url:`${origin}/storefront-order/${order.display_id}/success?provider=square`, ask_for_shipping_address:false, allow_tipping:false },
    pre_populated_data:{ buyer_email: order.customer_email_snapshot || undefined }
  }), cache:"no-store" });
  const result = await response.json(); const link=result.payment_link;
  if (!response.ok || !link?.url) throw new Error(result.errors?.[0]?.detail || "Square could not create the payment link.");
  const reference = String(link.order_id || link.id);
  const db=createSupabaseAdmin(); const now=new Date().toISOString();
  await db.from("payments").insert({ organization_id:order.organization_id,shop_id:order.shop_id,order_id:order.id,provider:"square",provider_order_id:reference,amount:order.total,currency:String(order.currency||"usd").toLowerCase(),status:"pending",metadata:{ paymentLinkId:link.id },created_at:now,updated_at:now });
  await db.from("orders").update({status:"awaiting_payment",payment_status:"pending",submitted_at:now,updated_at:now}).eq("id",order.id);
  await db.from("order_status_history").insert({organization_id:order.organization_id,shop_id:order.shop_id,order_id:order.id,from_status:"draft",to_status:"awaiting_payment",note:"Square checkout created.",metadata:{reference}});
  return { checkoutUrl:String(link.url), reference };
}

export async function confirmSquareCommerceOrder(order: CommerceOrder) {
  const db=createSupabaseAdmin();
  const {data:payment}=await db.from("payments").select("id,provider_order_id,status").eq("order_id",order.id).eq("provider","square").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(!payment?.provider_order_id)return false;
  const connection:any=await getLivePaymentConnection(order.shop_id,"square"); if(!connection)return false;
  const values=JSON.parse(decryptSecret(connection.encrypted_credentials)) as Record<string,string>;
  const base=values.environment==="sandbox"?"https://connect.squareupsandbox.com":"https://connect.squareup.com";
  const response=await fetch(`${base}/v2/orders/${encodeURIComponent(payment.provider_order_id)}`,{headers:{Authorization:`Bearer ${values.accessToken}`,"Square-Version":SQUARE_VERSION,"Content-Type":"application/json"},cache:"no-store"});
  const result=await response.json(); const square=result.order;
  if(!response.ok||!square)return false;
  const captured=Array.isArray(square.tenders)&&square.tenders.some((t:any)=>t.card_details?.status==="CAPTURED"||t.type);
  if(!captured)return false;
  const now=new Date().toISOString();
  await db.from("payments").update({status:"paid",amount:Number(square.total_money?.amount||0)/100,paid_at:now,updated_at:now}).eq("id",payment.id);
  await db.from("orders").update({status:"paid",payment_status:"paid",paid_at:now,updated_at:now}).eq("id",order.id);
  await db.from("order_status_history").insert({organization_id:order.organization_id,shop_id:order.shop_id,order_id:order.id,from_status:"awaiting_payment",to_status:"paid",note:"Square payment confirmed from success page.",metadata:{reference:payment.provider_order_id}});
  return true;
}
