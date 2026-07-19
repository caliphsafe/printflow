import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeShopSettings } from "@/lib/shop-settings";

export async function PATCH(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "Create the shop first." }, { status: 400 });
  const body = await request.json();
  const settings = normalizeShopSettings({
    ...shop.settings,
    brand: { ...shop.settings?.brand, primaryColor: body.primaryColor || shop.settings?.brand?.primaryColor, accentColor: body.accentColor || shop.settings?.brand?.accentColor },
    customerExperience: { ...shop.settings?.customerExperience, headline: body.headline || shop.settings?.customerExperience?.headline, introduction: body.introduction || shop.settings?.customerExperience?.introduction }
  });
  const { error } = await supabase.from("shops").update({ settings, active: body.active === true, updated_at: new Date().toISOString() }).eq("id", shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
