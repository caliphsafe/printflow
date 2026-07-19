import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";

export async function GET() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "Create the shop first." }, { status: 400 });
  const [{ data: payments }, { data: suppliers }, { data: pricing }, { count: products }] = await Promise.all([
    supabase.from("integration_connections").select("provider,status").eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected"),
    supabase.from("supplier_connections").select("provider,status").eq("shop_id", shop.id).eq("status", "connected"),
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("catalog_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true)
  ]);
  return NextResponse.json({
    paymentConnected: Boolean(payments?.length), paymentProviders: (payments || []).map((item: any) => item.provider),
    supplierConnected: Boolean(suppliers?.length), supplierProviders: (suppliers || []).map((item: any) => item.provider),
    pricingConfigured: Boolean(pricing), productCount: products || 0, storefrontActive: shop.active,
    onboardingState: shop.onboarding_state || {}, shopSlug: shop.slug
  });
}

export async function PATCH(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "Create the shop first." }, { status: 400 });
  const body = await request.json();
  const state = { ...(shop.onboarding_state || {}), step: body.step || shop.onboarding_state?.step || "setup", skipped: { ...(shop.onboarding_state?.skipped || {}), ...(body.skipped || {}) }, updatedAt: new Date().toISOString() };
  const { error } = await supabase.from("shops").update({ onboarding_state: state, updated_at: new Date().toISOString() }).eq("id", shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, state });
}
