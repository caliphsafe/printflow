import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";

export async function GET() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const { data, error } = await supabase.from("shop_pricing_profiles").select("configuration,updated_at").eq("shop_id", shop.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ pricing: normalizePricingProfile(data?.configuration || DEFAULT_PRICING_PROFILE), updatedAt: data?.updated_at });
}

export async function PATCH(request: Request) {
  const { supabase, membership, shop, user } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const configuration = normalizePricingProfile(await request.json());
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("shop_pricing_profiles")
    .upsert(
      {
        organization_id: membership.organization_id,
        shop_id: shop.id,
        configuration,
        updated_at: now
      },
      { onConflict: "shop_id" }
    )
    .select("configuration,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("audit_logs").insert({
    organization_id: membership.organization_id,
    user_id: user.id,
    action: "shop.pricing.updated",
    entity_type: "shop_pricing_profile",
    entity_id: shop.id,
    metadata: { fees: ["setup", "design_optimization"], services: configuration.decorationServices.length, addOns: configuration.addOns.length }
  });
  return NextResponse.json({ pricing: normalizePricingProfile(data.configuration), updatedAt: data.updated_at });
}
