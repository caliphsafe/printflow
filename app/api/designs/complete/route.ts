import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createCheckoutForDesign } from "@/lib/payments";

type CompletePayload = { designId: string };

export async function POST(request: Request) {
  try {
    const { designId } = (await request.json()) as CompletePayload;
    if (!designId) return NextResponse.json({ error: "Missing design session." }, { status: 400 });
    const supabase = createSupabaseAdmin();
    const { data: design, error } = await supabase
      .from("designs")
      .select("id,display_id,shop_id,product_name,package_quantity,package_price,customer_name,customer_email,status,shops(slug,name,settings)")
      .eq("id", designId)
      .single();
    if (error || !design) return NextResponse.json({ error: "Design session not found." }, { status: 404 });
    if (design.status !== "draft" && design.status !== "awaiting_payment") return NextResponse.json({ error: "This order has already moved beyond checkout." }, { status: 409 });

    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from("designs").update({ status: "awaiting_payment", submitted_at: now, payment_status: "preparing", updated_at: now }).eq("id", design.id);
    if (updateError) return NextResponse.json({ error: "Unable to finalize the design." }, { status: 500 });

    try {
      const checkout = await createCheckoutForDesign(design as any, request.url);
      return NextResponse.json({ displayId: design.display_id, checkoutUrl: checkout.checkoutUrl, paymentProvider: checkout.provider });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to create secure checkout.";
      await supabase.from("designs").update({ payment_status: "configuration_error", sync_error: message, updated_at: new Date().toISOString() }).eq("id", design.id);
      return NextResponse.json({ error: message }, { status: 409 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error." }, { status: 500 });
  }
}
