import { NextResponse } from "next/server";
import { getAdvancedAdminApiContext } from "@/lib/advanced-admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdvancedAdminApiContext();
  if (!context) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const { db, shop, user, membership } = context;

  const { data: product } = await db.from("catalog_products").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const configuration = {
    ...(product.configuration || {}),
    customization: {
      ...((product.configuration || {}).customization || {}),
      minimumQuantity: Math.max(1, Number(body.minimumQuantity || 1)),
      decorationMethods: Array.isArray(body.decorationMethods) ? body.decorationMethods.filter(Boolean) : ((product.configuration || {}).customization?.decorationMethods || [])
    }
  };

  const update = {
    name: String(body.name || product.name).trim() || product.name,
    active: body.active !== false,
    configuration,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await db.from("catalog_products").update(update).eq("id", product.id).eq("shop_id", shop.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await db.from("audit_logs").insert({
    organization_id: membership.organization_id,
    user_id: user.id,
    action: "advanced.product.updated",
    entity_type: "catalog_product",
    entity_id: product.id,
    metadata: { active: update.active, name: update.name }
  });

  return NextResponse.json({ ok: true, product: data });
}
