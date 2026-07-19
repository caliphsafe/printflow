import { NextResponse } from "next/server";
import { getPlatformAdminContext } from "@/lib/platform-admin";
import { DEFAULT_PRICING_PROFILE } from "@/lib/pricing-settings";
import { normalizeShopSettings } from "@/lib/shop-settings";

const statuses = ["trialing", "active", "past_due", "canceled"];
const plans = ["starter", "growth", "scale"];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "print-shop";
}

async function uniqueSlug(admin: any, base: string, table: "shops" | "organizations") {
  let value = base;
  for (let index = 0; index < 30; index += 1) {
    const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq("slug", value);
    if (!count) return value;
    value = `${base}-${index + 2}`;
  }
  return `${base}-${Date.now().toString().slice(-6)}`;
}

function appOrigin(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const { admin, user } = await getPlatformAdminContext();
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const ownerName = String(body.ownerName || "").trim();
  const businessName = String(body.businessName || "").trim();
  const planCode = plans.includes(body.planCode) ? body.planCode : "starter";
  const trialDays = Math.max(0, Math.min(365, Number(body.trialDays || 14)));
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid owner email." }, { status: 400 });
  if (!businessName) return NextResponse.json({ error: "Business name is required." }, { status: 400 });

  const existingUsers = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existingUsers.data.users.some((item) => item.email?.toLowerCase() === email)) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const base = slugify(businessName);
  const shopSlug = await uniqueSlug(admin, base, "shops");
  const organizationSlug = await uniqueSlug(admin, `${base}-account`, "organizations");
  const redirectTo = `${appOrigin(request)}/auth/callback?next=${encodeURIComponent("/account/setup-password")}&plan=${planCode}`;
  const invite = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: ownerName, business_name: businessName, selected_plan: planCode, platform_invited: true }
  });
  if (invite.error || !invite.data.user) return NextResponse.json({ error: invite.error?.message || "The invitation could not be sent." }, { status: 400 });

  const invitedUser = invite.data.user;
  try {
    const { data: organization, error: organizationError } = await admin.from("organizations").insert({ name: businessName, slug: organizationSlug, subscription_status: "trialing" }).select("id,name,slug").single();
    if (organizationError || !organization) throw organizationError || new Error("Organization could not be created.");

    const settings = normalizeShopSettings({
      brand: { primaryColor: "#171717", textColor: "#ffffff", accentColor: "#d8ff5f", surfaceColor: "#f4f4ef" },
      business: { contactEmail: email, phone: "", address: "" },
      customerExperience: {
        heroBadge: "CUSTOM APPAREL, MADE EASY",
        headline: `Create something great with ${businessName}`,
        introduction: "Choose a product, upload artwork, review your mockup, and pay securely online.",
        trustMessage: "Secure checkout · Production artwork review · Live order updates",
        uploadInstructions: "Upload high-resolution PNG, JPG, WEBP, or SVG artwork. Files up to 100 MB are accepted.",
        turnaroundTime: "Turnaround begins after payment and artwork approval.",
        artworkDisclaimer: "Mockups are placement guides. The production team confirms final print dimensions and color output.",
        confirmationMessage: "Your order is ready for secure checkout."
      },
      upload: { maxBytes: 100 * 1024 * 1024 }
    });

    const { data: shop, error: shopError } = await admin.from("shops").insert({
      organization_id: organization.id,
      slug: shopSlug,
      name: businessName,
      settings,
      active: false,
      onboarding_state: { step: "business", invitedByPlatform: true }
    }).select("id,slug,name").single();
    if (shopError || !shop) throw shopError || new Error("Shop could not be created.");

    const end = new Date(Date.now() + trialDays * 86400000).toISOString();
    const results = await Promise.all([
      admin.from("organization_members").insert({ organization_id: organization.id, user_id: invitedUser.id, role: "owner" }),
      admin.from("shop_pricing_profiles").insert({ organization_id: organization.id, shop_id: shop.id, configuration: DEFAULT_PRICING_PROFILE }),
      admin.from("subscription_accounts").insert({ organization_id: organization.id, provider: "manual", plan_code: planCode, status: "trialing", current_period_end: end })
    ]);
    const setupError = results.find((result: any) => result.error)?.error;
    if (setupError) throw setupError;

    await admin.from("platform_admin_actions").insert({ organization_id: organization.id, admin_email: user.email || "platform-admin", action: "account_invited", details: { email, ownerName, businessName, planCode, trialDays } });
    return NextResponse.json({ ok: true, organizationId: organization.id, shopId: shop.id, shopSlug: shop.slug, invitedEmail: email });
  } catch (caught) {
    await admin.auth.admin.deleteUser(invitedUser.id).catch(() => undefined);
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "The account could not be created." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { admin, user } = await getPlatformAdminContext();
  const body = await request.json();
  const organizationId = String(body.organizationId || "");
  const shopId = String(body.shopId || "");
  if (!organizationId || !shopId) return NextResponse.json({ error: "Account identifiers are required." }, { status: 400 });

  const planCode = plans.includes(body.planCode) ? body.planCode : "starter";
  const subscriptionStatus = statuses.includes(body.subscriptionStatus) ? body.subscriptionStatus : "trialing";
  const active = body.active === true;
  const ownerUserId = String(body.ownerUserId || "");
  const ownerName = String(body.ownerName || "").trim();
  const note = String(body.note || "").trim();
  const extensionDays = Math.max(0, Math.min(365, Number(body.trialExtensionDays || 0)));
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: existingSubscription } = await admin.from("subscription_accounts").select("organization_id,current_period_end").eq("organization_id", organizationId).maybeSingle();
  let currentPeriodEnd = existingSubscription?.current_period_end || null;
  if (extensionDays > 0) {
    const base = currentPeriodEnd && new Date(currentPeriodEnd) > now ? new Date(currentPeriodEnd) : now;
    base.setDate(base.getDate() + extensionDays);
    currentPeriodEnd = base.toISOString();
  }

  const subscriptionData = { plan_code: planCode, status: subscriptionStatus, current_period_end: currentPeriodEnd, updated_at: nowIso };
  const subscriptionOperation = existingSubscription
    ? admin.from("subscription_accounts").update(subscriptionData).eq("organization_id", organizationId)
    : admin.from("subscription_accounts").insert({ organization_id: organizationId, provider: "manual", ...subscriptionData });

  const operations: PromiseLike<any>[] = [
    admin.from("shops").update({ active, updated_at: nowIso }).eq("id", shopId).eq("organization_id", organizationId),
    admin.from("organizations").update({ subscription_status: subscriptionStatus, updated_at: nowIso }).eq("id", organizationId),
    subscriptionOperation
  ];

  if (ownerUserId && ownerName) {
    const existingUser = await admin.auth.admin.getUserById(ownerUserId);
    operations.push(admin.auth.admin.updateUserById(ownerUserId, { user_metadata: { ...(existingUser.data.user?.user_metadata || {}), full_name: ownerName } }));
  }
  if (note) operations.push(admin.from("platform_account_notes").insert({ organization_id: organizationId, created_by_email: user.email || "platform-admin", note }));

  const results = await Promise.all(operations);
  const error = results.find((result: any) => result?.error)?.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("platform_admin_actions").insert({ organization_id: organizationId, admin_email: user.email || "platform-admin", action: "account_updated", details: { planCode, subscriptionStatus, active, extensionDays, ownerNameChanged: Boolean(ownerName), noteAdded: Boolean(note) } });
  return NextResponse.json({ ok: true, currentPeriodEnd });
}

export async function DELETE(request: Request) {
  const { admin, user } = await getPlatformAdminContext();
  const body = await request.json();
  const organizationId = String(body.organizationId || "");
  const confirmation = String(body.confirmation || "").trim();
  if (!organizationId) return NextResponse.json({ error: "Account identifier is required." }, { status: 400 });

  const [{ data: organization }, { data: shop }, { data: memberships }] = await Promise.all([
    admin.from("organizations").select("id,name,slug").eq("id", organizationId).maybeSingle(),
    admin.from("shops").select("id,name,slug").eq("organization_id", organizationId).limit(1).maybeSingle(),
    admin.from("organization_members").select("user_id").eq("organization_id", organizationId)
  ]);
  if (!organization) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const expected = shop?.slug || organization.slug;
  if (confirmation !== expected) return NextResponse.json({ error: `Type ${expected} exactly to permanently delete this account.` }, { status: 400 });

  const memberIds = (memberships || []).map((item: any) => item.user_id);
  const protectedAdminEmail = String(user.email || "").toLowerCase();
  const userDeletionCandidates: string[] = [];
  for (const userId of memberIds) {
    const [{ count }, authUser] = await Promise.all([
      admin.from("organization_members").select("organization_id", { count: "exact", head: true }).eq("user_id", userId),
      admin.auth.admin.getUserById(userId)
    ]);
    if ((count || 0) <= 1 && authUser.data.user?.email?.toLowerCase() !== protectedAdminEmail) userDeletionCandidates.push(userId);
  }

  await admin.from("platform_admin_actions").insert({ organization_id: organizationId, admin_email: user.email || "platform-admin", action: "account_deleted", details: { organizationName: organization.name, shopName: shop?.name, shopSlug: shop?.slug, memberCount: memberIds.length } });
  const { error: deleteError } = await admin.from("organizations").delete().eq("id", organizationId);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  for (const userId of userDeletionCandidates) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
