import { NextResponse } from "next/server";
import { getPlatformAdminContext } from "@/lib/platform-admin";

export async function PATCH(request: Request) {
  const { admin } = await getPlatformAdminContext();
  const body = await request.json();
  const organizationId = String(body.organizationId || "");
  const shopId = String(body.shopId || "");
  if (!organizationId || !shopId) return NextResponse.json({ error: "Account identifiers are required." }, { status: 400 });

  const planCode = ["starter", "growth", "scale"].includes(body.planCode) ? body.planCode : "starter";
  const subscriptionStatus = ["trialing", "active", "past_due", "canceled"].includes(body.subscriptionStatus) ? body.subscriptionStatus : "trialing";
  const active = body.active === true;
  const now = new Date().toISOString();
  const { data: existingSubscription } = await admin
    .from("subscription_accounts")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const subscriptionOperation = existingSubscription
    ? admin.from("subscription_accounts").update({ plan_code: planCode, status: subscriptionStatus, updated_at: now }).eq("organization_id", organizationId)
    : admin.from("subscription_accounts").insert({ organization_id: organizationId, provider: "manual", plan_code: planCode, status: subscriptionStatus, updated_at: now });

  const [shopResult, orgResult, subResult] = await Promise.all([
    admin.from("shops").update({ active, updated_at: now }).eq("id", shopId).eq("organization_id", organizationId),
    admin.from("organizations").update({ subscription_status: subscriptionStatus, updated_at: now }).eq("id", organizationId),
    subscriptionOperation
  ]);

  const error = shopResult.error || orgResult.error || subResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
