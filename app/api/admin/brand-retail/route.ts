import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeBrandRetailProfile } from "@/lib/brand-retail";

export async function POST(request: Request) {
  const { supabase, membership, shop, user } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const profile = normalizeBrandRetailProfile(await request.json());

  const { data, error } = await supabase
    .from("brand_retail_profiles")
    .upsert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      configuration: profile
    }, { onConflict: "shop_id" })
    .select("id,configuration")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_logs").insert({
    organization_id: membership.organization_id,
    user_id: user.id,
    action: "brand.retail_profile.updated",
    entity_type: "brand_retail_profile",
    entity_id: data.id,
    metadata: {
      defaultTargetMarginPercent: profile.defaultTargetMarginPercent,
      paymentReservePercent: profile.paymentReservePercent
    }
  });

  return NextResponse.json({ profile });
}
