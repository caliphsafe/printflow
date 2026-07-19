import { NextResponse } from "next/server";
import { getPlatformAdminContext } from "@/lib/platform-admin";

const statuses = ["trialing", "active", "past_due", "canceled"];
const plans = ["starter", "growth", "scale"];

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

  const { data: existingSubscription } = await admin
    .from("subscription_accounts")
    .select("organization_id,current_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();

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

  await admin.from("platform_admin_actions").insert({
    organization_id: organizationId,
    admin_email: user.email || "platform-admin",
    action: "account_updated",
    details: { planCode, subscriptionStatus, active, extensionDays, ownerNameChanged: Boolean(ownerName), noteAdded: Boolean(note) }
  });

  return NextResponse.json({ ok: true, currentPeriodEnd });
}
