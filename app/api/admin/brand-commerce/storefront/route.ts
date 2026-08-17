import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeBrandCommerceSettings } from "@/lib/brand-commerce";

export async function POST(request: Request) {
  const { supabase, membership, shop, user } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const currentSettings = shop.settings && typeof shop.settings === "object"
    ? shop.settings as Record<string, any>
    : {};
  const commerce = normalizeBrandCommerceSettings(currentSettings);

  const storefront = {
    ...commerce.storefront,
    logoUrl: String(body.logoUrl || "").trim() || undefined,
    primaryColor: String(body.primaryColor || commerce.storefront.primaryColor),
    textColor: String(body.textColor || commerce.storefront.textColor),
    accentColor: String(body.accentColor || commerce.storefront.accentColor),
    surfaceColor: String(body.surfaceColor || commerce.storefront.surfaceColor),
    heroBadge: String(body.heroBadge || "").trim() || "BRAND / MERCH",
    headline: String(body.headline || "").trim() || "Shop the brand.",
    introduction: String(body.introduction || "").trim() || "Choose a garment, color, and approved design.",
    trustMessage: String(body.trustMessage || "").trim() || "Secure checkout · Production approved · Order updates"
  };

  const settings = {
    ...currentSettings,
    brandCommerce: {
      ...(currentSettings.brandCommerce || {}),
      pricing: commerce.pricing,
      garments: commerce.garments,
      colorContrast: commerce.colorContrast,
      storefront
    }
  };

  const { error } = await supabase.from("shops").update({ settings, updated_at: new Date().toISOString() }).eq("id", shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_logs").insert({
    organization_id: membership.organization_id,
    user_id: user.id,
    action: "brand.storefront.updated",
    entity_type: "shop",
    entity_id: shop.id,
    metadata: { headline: storefront.headline }
  });

  return NextResponse.json({ storefront });
}
