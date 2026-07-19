import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { createPlatformBillingPortal } from "@/lib/platform-billing";

export async function POST(request: Request) {
  const { membership } = await getAdminContext();
  if (!membership) return NextResponse.json({ error: "Account not found." }, { status: 403 });
  try {
    const url = await createPlatformBillingPortal(membership.organization_id, request.url);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open billing management." }, { status: 400 });
  }
}
