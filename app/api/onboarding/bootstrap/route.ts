import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_PRICING_PROFILE } from "@/lib/pricing-settings";
import { normalizeShopSettings } from "@/lib/shop-settings";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50) || "print-shop";
}

async function uniqueSlug(admin: ReturnType<typeof createSupabaseAdmin>, base: string) {
  let value = base;
  for (let index = 0; index < 20; index += 1) {
    const { count } = await admin.from("shops").select("id", { count: "exact", head: true }).eq("slug", value);
    if (!count) return value;
    value = `${base}-${index + 2}`;
  }
  return `${base}-${Date.now().toString().slice(-5)}`;
}

export async function POST(request: Request) {
  const auth = await createSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before creating a shop." }, { status: 401 });
  const body = await request.json();
  const businessName = String(body.businessName || "").trim();
  if (!businessName) return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  const admin = createSupabaseAdmin();
  const { data: existing } = await admin.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (existing) {
    const { data: shop } = await admin.from("shops").select("id,slug").eq("organization_id", existing.organization_id).limit(1).single();
    return NextResponse.json({ ok: true, shop });
  }
  const base = slugify(body.slug || businessName);
  const shopSlug = await uniqueSlug(admin, base);
  const orgSlug = `${shopSlug}-${user.id.slice(0, 6)}`;
  const primaryColor = /^#[0-9a-fA-F]{6}$/.test(body.primaryColor) ? body.primaryColor : "#161616";
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(body.accentColor) ? body.accentColor : "#d8ff5f";
  const settings = normalizeShopSettings({
    brand: { primaryColor, textColor: "#ffffff", accentColor, surfaceColor: "#f4f4ef" },
    business: { contactEmail: body.contactEmail || user.email, phone: body.phone || "", address: body.address || "" },
    customerExperience: {
      heroBadge: "CUSTOM APPAREL, MADE EASY",
      headline: body.headline || `Create something great with ${businessName}`,
      introduction: body.introduction || "Choose a product, build your print, upload artwork, and pay securely online.",
      trustMessage: "Secure checkout · Production artwork review · Live order updates",
      uploadInstructions: "Upload high-resolution PNG, JPG, WEBP, or SVG artwork. Files up to 100 MB are accepted.",
      turnaroundTime: "Turnaround begins after payment and artwork approval.",
      artworkDisclaimer: "Mockups are placement guides. The production team confirms final print dimensions and color output.",
      confirmationMessage: "Your order is ready for secure checkout."
    },
    upload: { maxBytes: 100 * 1024 * 1024 }
  });
  const { data: organization, error: orgError } = await admin.from("organizations").insert({ name: businessName, slug: orgSlug, subscription_status: "trialing" }).select("id,name,slug").single();
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 400 });
  const { error: membershipError } = await admin.from("organization_members").insert({ organization_id: organization.id, user_id: user.id, role: "owner" });
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });
  const { data: shop, error: shopError } = await admin.from("shops").insert({ organization_id: organization.id, slug: shopSlug, name: businessName, settings, active: false, onboarding_state: { step: "connections" } }).select("id,slug,name").single();
  if (shopError) return NextResponse.json({ error: shopError.message }, { status: 400 });
  await Promise.all([
    admin.from("shop_pricing_profiles").insert({ organization_id: organization.id, shop_id: shop.id, configuration: DEFAULT_PRICING_PROFILE }),
    admin.from("subscription_accounts").insert({ organization_id: organization.id, provider: "manual", plan_code: "launch", status: "trialing" })
  ]);
  return NextResponse.json({ ok: true, organization, shop });
}
