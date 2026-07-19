import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";

export async function PATCH(request: Request) {
  const { supabase, organization, shop } = await getAdminContext();
  if (!organization || !shop) return NextResponse.json({ error: "Create the shop first." }, { status: 400 });
  const body = await request.json();
  const { data: existing } = await supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle();
  const profile = normalizePricingProfile(existing?.configuration || DEFAULT_PRICING_PROFILE);
  profile.garmentMarkupPercent = Math.max(0, Math.min(500, Number(body.garmentMarkupPercent ?? profile.garmentMarkupPercent)));
  profile.orderSetupFee.amount = Math.max(0, Number(body.orderSetupFee ?? profile.orderSetupFee.amount));
  profile.designOptimizationFee.amount = Math.max(0, Number(body.designOptimizationFee ?? profile.designOptimizationFee.amount));
  profile.screenPrinting.active = body.screenPrinting !== false;
  profile.dtf.active = body.dtf !== false;
  profile.embroidery.active = body.embroidery !== false;
  const { error } = await supabase.from("shop_pricing_profiles").upsert({ organization_id: organization.id, shop_id: shop.id, configuration: profile, updated_at: new Date().toISOString() }, { onConflict: "shop_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, profile });
}
