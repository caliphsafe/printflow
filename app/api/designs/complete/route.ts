import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createCheckoutForDesign } from "@/lib/payments";
import { mirrorDesignToCommerceOrder } from "@/lib/commerce-orders";
import { verifyOrderArtwork } from "@/lib/verify-order-artwork";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { designId } = await request.json() as { designId: string };
    if (!designId) return NextResponse.json({ error: "Missing design session." }, { status: 400 });
    const supabase = createSupabaseAdmin();
    const { data: design, error } = await supabase.from("designs")
      .select("id,display_id,shop_id,product_name,package_quantity,package_price,customer_name,customer_email,status,design_sides,design_configuration,shops(slug,name,settings)")
      .eq("id", designId).single();
    if (error || !design) return NextResponse.json({ error: "Design session not found." }, { status: 404 });
    if (design.status !== "draft" && design.status !== "awaiting_payment") {
      return NextResponse.json({ error: "This order has already moved beyond checkout." }, { status: 409 });
    }
    try {
      await verifyOrderArtwork(design, async path => {
        const { data, error } = await supabase.storage.from("artwork").download(path);
        if (error || !data) throw new Error("The original artwork has not finished uploading. Please submit your design again.");
        return Buffer.from(await data.arrayBuffer());
      });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify artwork measurements." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from("designs")
      .update({ status: "awaiting_payment", submitted_at: now, payment_status: "preparing", updated_at: now }).eq("id", design.id);
    if (updateError) return NextResponse.json({ error: "Unable to finalize the design." }, { status: 500 });
    try { await mirrorDesignToCommerceOrder(design.id); }
    catch (mirrorError) { console.error("Commerce mirror failed", mirrorError); }
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
