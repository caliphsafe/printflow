import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { brandStorefrontMode, modeFromAccess, platformShopAccess, shopAccountMode, type BrandStorefrontMode } from "@/lib/shop-mode";

const storefrontModes = new Set<BrandStorefrontMode>(["full", "embed", "both"]);

export async function GET() {
  const { shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  return NextResponse.json({
    accountMode: shopAccountMode(shop.settings),
    brandStorefrontMode: brandStorefrontMode(shop.settings),
    platformAccess: platformShopAccess(shop.settings)
  });
}

export async function PATCH(request: Request) {
  const { supabase, membership, shop, user } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const brandMode = String(body.brandStorefrontMode || "") as BrandStorefrontMode;
  if (!storefrontModes.has(brandMode)) return NextResponse.json({ error: "Choose a valid Brand storefront format." }, { status: 400 });

  const access = platformShopAccess(shop.settings);
  if (!access.brandMerch) return NextResponse.json({ error: "Brand access is not enabled for this account." }, { status: 403 });

  const current = shop.settings && typeof shop.settings === "object" ? shop.settings as Record<string, unknown> : {};
  const accountMode = modeFromAccess(access);

  const settings = {
    ...current,
    accountMode,
    brandStorefrontMode: brandMode
  };

  const { data, error } = await supabase
    .from("shops")
    .update({ settings, updated_at: new Date().toISOString() })
    .eq("id", shop.id)
    .select("id,name,slug,active,settings")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_logs").insert({
    organization_id: membership.organization_id,
    user_id: user.id,
    action: "shop.brand_publishing.updated",
    entity_type: "shop",
    entity_id: shop.id,
    metadata: { brandStorefrontMode: brandMode }
  });

  return NextResponse.json({ shop: data });
}
