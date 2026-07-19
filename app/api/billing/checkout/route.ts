import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { createPlatformSubscriptionCheckout } from "@/lib/platform-billing";

export async function POST(request: Request) {
  const { user, membership } = await getAdminContext();
  if (!membership) return NextResponse.json({ error: "Complete account setup before choosing a plan." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const planCode = ["starter", "growth", "scale"].includes(body.planCode) ? body.planCode : "growth";
  try {
    const url = await createPlatformSubscriptionCheckout({ organizationId: membership.organization_id, email: user.email || "", planCode, requestUrl: request.url });
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start subscription checkout." }, { status: 400 });
  }
}
