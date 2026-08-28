import { NextResponse } from "next/server";
import { getAdvancedAdminApiContext } from "@/lib/advanced-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdvancedAdminApiContext();
  if (!context) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const { db, shop } = context;

  const { data: storefront } = await db.from("storefronts").select("id").eq("shop_id", shop.id).eq("slug", "espirito-santo").maybeSingle();
  if (!storefront) return NextResponse.json({ error: "Espirito Santo storefront not configured." }, { status: 404 });

  const update = {
    active: body.active !== false,
    price: Math.max(0, Number(body.price || 0)),
    name_override: String(body.name || "").trim() || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await db.from("storefront_products").update(update).eq("id", id).eq("storefront_id", storefront.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}
