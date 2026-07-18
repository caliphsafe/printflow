import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { decryptSecret } from "@/lib/crypto";
import { markDesignPaid, verifyStripeSignature } from "@/lib/payments";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid payload." }, { status: 400 }); }
  const session = event?.data?.object;
  const designId = session?.metadata?.design_id || session?.client_reference_id;
  if (!designId) return NextResponse.json({ received: true });
  const supabase = createSupabaseAdmin();
  const { data: design } = await supabase.from("designs").select("id,shop_id").eq("id", designId).maybeSingle();
  if (!design) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const { data: connection } = await supabase.from("integration_connections").select("encrypted_credentials").eq("shop_id", design.shop_id).eq("provider", "stripe").eq("status", "connected").maybeSingle();
  if (!connection) return NextResponse.json({ error: "Stripe connection not found." }, { status: 404 });
  let values: Record<string, string>;
  try { values = JSON.parse(decryptSecret(connection.encrypted_credentials)); } catch { return NextResponse.json({ error: "Stored webhook credentials are invalid." }, { status: 500 }); }
  if (!values.webhookSecret || !verifyStripeSignature(rawBody, signature, values.webhookSecret)) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type) && session.payment_status === "paid") {
    await markDesignPaid(design.id, "stripe", session.id, Number(session.amount_total || 0) / 100);
  }
  if (event.type === "checkout.session.async_payment_failed") {
    await supabase.from("designs").update({ payment_status: "failed", sync_error: "Stripe reported an unsuccessful payment.", updated_at: new Date().toISOString() }).eq("id", design.id);
  }
  return NextResponse.json({ received: true });
}
