import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const variantId = new URL(request.url).searchParams.get("variant");
  if (!variantId) return new NextResponse("Missing variant.", { status: 400 });

  const admin = createSupabaseAdmin();
  const { data: variant } = await admin
    .from("brand_design_variants")
    .select("id,artwork_path,active,brand_design_id")
    .eq("id", variantId)
    .eq("active", true)
    .maybeSingle();

  if (!variant) return new NextResponse("Artwork unavailable.", { status: 404 });

  const { data: design } = await admin
    .from("brand_designs")
    .select("id,active,shop_id")
    .eq("id", variant.brand_design_id)
    .eq("active", true)
    .maybeSingle();

  if (!design) return new NextResponse("Artwork unavailable.", { status: 404 });

  const { data: shop } = await admin.from("shops").select("id,active").eq("id", design.shop_id).eq("active", true).maybeSingle();
  if (!shop) return new NextResponse("Artwork unavailable.", { status: 404 });

  const signed = await admin.storage.from("brand-artwork").createSignedUrl(variant.artwork_path, 900);
  if (signed.error || !signed.data?.signedUrl) return new NextResponse("Artwork unavailable.", { status: 404 });

  return NextResponse.redirect(signed.data.signedUrl, 302);
}
