import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { brandStorefrontMode, shopAccountMode, type BrandStorefrontMode, type ShopAccountMode } from "@/lib/shop-mode";

const accountModes = new Set<ShopAccountMode>(["custom", "brand", "hybrid"]);
const storefrontModes = new Set<BrandStorefrontMode>(["full", "embed", "both"]);

export async function GET() {
  const { shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  return NextResponse.json({
    accountMode: shopAccountMode(shop.settings),
    brandStorefrontMode: brandStorefrontMode(shop.settings)
  });
}

export async function PATCH(request: Request) {
  const { supabase, membership, shop, user } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const accountMode = String(body.accountMode || "");
  const brandMode = String(body.brandStorefrontMode || "");

  if (!accountModes.has(accountMode as ShopAccountMode)) {
    return NextResponse.json({ error: "Choose a valid store mode." }, { status: 400 });
  }

  if (!storefrontModes.has(brandMode as BrandStorefrontMode)) {
    return NextResponse.json({ error: "Choose a valid Brand storefront format." }, { status: 400 });
  }

  const current = shop.settings && typeof shop.settings === "object"
    ? shop.settings as Record<string, unknown>
    : {};

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
    action: "shop.mode.updated",
    entity_type: "shop",
    entity_id: shop.id,
    metadata: {
      accountMode,
      brandStorefrontMode: brandMode
    }
  });

  return NextResponse.json({ shop: data });
}
