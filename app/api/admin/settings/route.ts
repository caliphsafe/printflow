import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { mergeEditableShopSettings, normalizeShopSettings } from "@/lib/shop-settings";

export async function GET() {
  const { shop, organization } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  return NextResponse.json({
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      active: shop.active,
      settings: normalizeShopSettings(shop.settings)
    },
    organization
  });
}

export async function PATCH(request: Request) {
  const { supabase, membership, shop, user } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const name = String(body.name || shop.name).trim();
  if (!name) return NextResponse.json({ error: "Shop name is required." }, { status: 400 });

  const settings = mergeEditableShopSettings(shop.settings, body);
  const { data, error } = await supabase
    .from("shops")
    .update({
      name,
      active: body.active !== false,
      settings,
      updated_at: new Date().toISOString()
    })
    .eq("id", shop.id)
    .select("id, name, slug, active, settings")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_logs").insert({
    organization_id: membership.organization_id,
    user_id: user.id,
    action: "shop.settings.updated",
    entity_type: "shop",
    entity_id: shop.id,
    metadata: { fields: ["name", "active", "brand", "business", "customerExperience", "upload"] }
  });

  return NextResponse.json({ shop: data });
}
