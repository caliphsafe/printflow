import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeBrandBusinessProfile } from "@/lib/brand-retail";

export async function POST(request: Request) {
  const { supabase, membership, shop, user } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const profile = normalizeBrandBusinessProfile(body, shop.name);
  if (!profile.name.trim()) return NextResponse.json({ error: "Brand name is required." }, { status: 400 });

  const { data, error } = await supabase
    .from("brand_business_profiles")
    .upsert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      name: profile.name,
      settings: profile.settings
    }, { onConflict: "shop_id" })
    .select("id,name,settings")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_logs").insert({
    organization_id: membership.organization_id,
    user_id: user.id,
    action: "brand.business.updated",
    entity_type: "brand_business_profile",
    entity_id: data.id,
    metadata: { name: data.name }
  });

  return NextResponse.json({ profile: data });
}
