import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_PRICING_PROFILE } from "@/lib/pricing-settings";
import { normalizeShopSettings } from "@/lib/shop-settings";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50) || "print-shop";
}

async function uniqueSlug(admin: ReturnType<typeof createSupabaseAdmin>, base: string) {
  let value = base;
  for (let index = 0; index < 20; index += 1) {
    const { count } = await admin
      .from("shops")
      .select("id", { count: "exact", head: true })
      .eq("slug", value);

    if (!count) return value;
    value = `${base}-${index + 2}`;
  }

  return `${base}-${Date.now().toString().slice(-5)}`;
}

function buildShopSettings(body: Record<string, unknown>, userEmail: string | undefined, businessName: string) {
  const requestedPrimary = String(body.primaryColor || "");
  const requestedAccent = String(body.accentColor || "");
  const primaryColor = /^#[0-9a-fA-F]{6}$/.test(requestedPrimary) ? requestedPrimary : "#161616";
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(requestedAccent) ? requestedAccent : "#d8ff5f";

  return normalizeShopSettings({
    brand: {
      primaryColor,
      textColor: "#ffffff",
      accentColor,
      surfaceColor: "#f4f4ef"
    },
    business: {
      contactEmail: String(body.contactEmail || userEmail || ""),
      phone: String(body.phone || ""),
      address: String(body.address || "")
    },
    customerExperience: {
      heroBadge: "CUSTOM APPAREL, MADE EASY",
      headline: String(body.headline || `Create something great with ${businessName}`),
      introduction: String(
        body.introduction ||
          "Choose a product, build your print, upload artwork, and pay securely online."
      ),
      trustMessage: "Secure checkout · Production artwork review · Live order updates",
      uploadInstructions:
        "Upload high-resolution PNG, JPG, WEBP, or SVG artwork. Files up to 100 MB are accepted.",
      turnaroundTime: "Turnaround begins after payment and artwork approval.",
      artworkDisclaimer:
        "Mockups are placement guides. The production team confirms final print dimensions and color output.",
      confirmationMessage: "Your order is ready for secure checkout."
    },
    upload: { maxBytes: 100 * 1024 * 1024 }
  });
}

async function ensureShopFoundation(
  admin: ReturnType<typeof createSupabaseAdmin>,
  organizationId: string,
  shopId: string,
  planCode = "growth"
) {
  const [pricingResult, subscriptionResult] = await Promise.all([
    admin.from("shop_pricing_profiles").upsert(
      {
        organization_id: organizationId,
        shop_id: shopId,
        configuration: DEFAULT_PRICING_PROFILE
      },
      { onConflict: "shop_id", ignoreDuplicates: true }
    ),
    admin.from("subscription_accounts").upsert(
      {
        organization_id: organizationId,
        provider: "manual",
        plan_code: ["starter", "growth", "scale"].includes(planCode) ? planCode : "growth",
        status: "trialing",
        current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      },
      { onConflict: "organization_id", ignoreDuplicates: true }
    )
  ]);

  if (pricingResult.error) {
    throw new Error(`Shop exists, but pricing setup failed: ${pricingResult.error.message}`);
  }

  if (subscriptionResult.error) {
    throw new Error(`Shop exists, but account setup failed: ${subscriptionResult.error.message}`);
  }
}

async function createShopForOrganization({
  admin,
  organizationId,
  businessName,
  requestedSlug,
  settings,
  planCode = "growth"
}: {
  admin: ReturnType<typeof createSupabaseAdmin>;
  organizationId: string;
  businessName: string;
  requestedSlug: string;
  settings: ReturnType<typeof normalizeShopSettings>;
  planCode?: string;
}) {
  const shopSlug = await uniqueSlug(admin, slugify(requestedSlug || businessName));
  const { data: shop, error: shopError } = await admin
    .from("shops")
    .insert({
      organization_id: organizationId,
      slug: shopSlug,
      name: businessName,
      settings,
      active: false,
      onboarding_state: { step: "connections" }
    })
    .select("id,slug,name")
    .single();

  if (shopError || !shop) {
    throw new Error(shopError?.message || "The shop record could not be created.");
  }

  await ensureShopFoundation(admin, organizationId, shop.id, planCode);
  return shop;
}

export async function POST(request: Request) {
  const auth = await createSupabaseServer();
  const {
    data: { user }
  } = await auth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before creating a shop." }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const businessName = String(body.businessName || "").trim();

  if (!businessName) {
    return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const settings = buildShopSettings(body, user.email, businessName);
  const ownerName = String(body.ownerName || "").trim();

  try {
    if (ownerName) {
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), full_name: ownerName, business_name: businessName }
      });
    }
    const { data: existingMembership, error: membershipLookupError } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipLookupError) throw membershipLookupError;

    // Recover accounts where an organization membership was created but the shop
    // insert failed during an earlier onboarding attempt.
    if (existingMembership) {
      const { data: existingShop, error: shopLookupError } = await admin
        .from("shops")
        .select("id,slug,name")
        .eq("organization_id", existingMembership.organization_id)
        .limit(1)
        .maybeSingle();

      if (shopLookupError) throw shopLookupError;

      if (existingShop) {
        await ensureShopFoundation(admin, existingMembership.organization_id, existingShop.id, String(body.planCode || user.user_metadata?.selected_plan || "growth"));
        return NextResponse.json({ ok: true, recovered: false, shop: existingShop });
      }

      const shop = await createShopForOrganization({
        admin,
        organizationId: existingMembership.organization_id,
        businessName,
        requestedSlug: String(body.slug || businessName),
        settings,
        planCode: String(body.planCode || user.user_metadata?.selected_plan || "growth")
      });

      return NextResponse.json({ ok: true, recovered: true, shop });
    }

    const base = slugify(String(body.slug || businessName));
    const shopSlug = await uniqueSlug(admin, base);
    const organizationSlug = `${shopSlug}-${user.id.slice(0, 6)}`;

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .insert({
        name: businessName,
        slug: organizationSlug,
        subscription_status: "trialing"
      })
      .select("id,name,slug")
      .single();

    if (organizationError || !organization) {
      throw new Error(organizationError?.message || "The organization could not be created.");
    }

    const { error: membershipError } = await admin.from("organization_members").insert({
      organization_id: organization.id,
      user_id: user.id,
      role: "owner"
    });

    if (membershipError) throw membershipError;

    const shop = await createShopForOrganization({
      admin,
      organizationId: organization.id,
      businessName,
      requestedSlug: shopSlug,
      settings,
      planCode: String(body.planCode || user.user_metadata?.selected_plan || "growth")
    });

    return NextResponse.json({ ok: true, recovered: false, organization, shop });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to create the shop.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
