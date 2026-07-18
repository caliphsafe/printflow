import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { decryptSecret } from "@/lib/crypto";
import { markDesignPaid, verifySquareSignature } from "@/lib/payments";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid payload." }, { status: 400 }); }
  const payment = event?.data?.object?.payment;
  const orderId = payment?.order_id;
  if (!orderId) return NextResponse.json({ received: true });
  const supabase = createSupabaseAdmin();
  const { data: design } = await supabase.from("designs").select("id,shop_id").eq("payment_provider", "square").eq("payment_reference", orderId).maybeSingle();
  if (!design) return NextResponse.json({ received: true });
  const { data: connection } = await supabase.from("integration_connections").select("encrypted_credentials,configuration").eq("shop_id", design.shop_id).eq("provider", "square").eq("status", "connected").maybeSingle();
  if (!connection) return NextResponse.json({ error: "Square connection not found." }, { status: 404 });
  let values: Record<string, string>;
  try { values = JSON.parse(decryptSecret(connection.encrypted_credentials)); } catch { return NextResponse.json({ error: "Stored webhook credentials are invalid." }, { status: 500 }); }
  const notificationUrl = connection.configuration?.notificationUrl || `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")}/api/webhooks/square`;
  if (!values.signatureKey || !verifySquareSignature(rawBody, signature, notificationUrl, values.signatureKey)) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  if (payment.status === "COMPLETED") await markDesignPaid(design.id, "square", orderId, Number(payment.amount_money?.amount || 0) / 100);
  if (["FAILED", "CANCELED"].includes(payment.status)) await supabase.from("designs").update({ payment_status: "failed", sync_error: `Square payment ${payment.status.toLowerCase()}.`, updated_at: new Date().toISOString() }).eq("id", design.id);
  return NextResponse.json({ received: true });
}
