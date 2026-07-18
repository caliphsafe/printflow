import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createCheckoutForDesign } from "@/lib/payments";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createSupabaseAdmin();
    let query = supabase.from("designs").select("id,display_id,shop_id,product_name,package_quantity,package_price,customer_name,customer_email,status,shops(slug,name,settings)");
    query = body.designId ? query.eq("id", body.designId) : query.eq("display_id", body.displayId);
    const { data: design } = await query.single();
    if (!design) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (design.status === "paid") return NextResponse.json({ error: "This order has already been paid." }, { status: 409 });
    const checkout = await createCheckoutForDesign(design as any, request.url);
    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl, provider: checkout.provider });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Unable to create checkout." }, { status: 400 });
  }
}
