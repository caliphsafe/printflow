import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeShopSettings } from "@/lib/shop-settings";

export async function PATCH(request: Request) {
  const { supabase, user, organization, shop } = await getAdminContext();
  if (!organization || !shop) return NextResponse.json({ error: "Complete account setup first." }, { status: 400 });
  const body = await request.json();
  const fullName = String(body.fullName || "").trim();
  const businessName = String(body.businessName || "").trim();
  const contactEmail = String(body.contactEmail || "").trim();
  const phone = String(body.phone || "").trim();
  if (!fullName) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  if (!businessName) return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  if (!contactEmail || !contactEmail.includes("@")) return NextResponse.json({ error: "Enter a valid customer contact email." }, { status: 400 });

  const now = new Date().toISOString();
  const settings = normalizeShopSettings({
    ...shop.settings,
    business: { ...(shop.settings?.business || {}), contactEmail, phone }
  });
  const [authResult, orgResult, shopResult] = await Promise.all([
    supabase.auth.admin.updateUserById(user.id, { user_metadata: { ...(user.user_metadata || {}), full_name: fullName, business_name: businessName } }),
    supabase.from("organizations").update({ name: businessName, updated_at: now }).eq("id", organization.id),
    supabase.from("shops").update({ name: businessName, settings, updated_at: now }).eq("id", shop.id)
  ]);
  const error = authResult.error || orgResult.error || shopResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, profile: { fullName, businessName, contactEmail, phone } });
}
