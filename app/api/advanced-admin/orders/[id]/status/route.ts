import { NextResponse } from "next/server";
import { getAdvancedAdminApiContext } from "@/lib/advanced-admin";

const allowed = new Set([
  "paid","artwork_review","awaiting_approval","approved","ready_for_production",
  "in_production","quality_control","ready","shipped","completed","cancelled"
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAdvancedAdminApiContext();
  if (!context) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const status = String(body.status || "");
  if (!allowed.has(status)) return NextResponse.json({ error: "Invalid order status." }, { status: 400 });

  const { db, shop, user } = context;
  const { data: order } = await db.from("orders").select("id,status,organization_id,shop_id").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status, updated_at: now };
  if (status === "completed") update.completed_at = now;

  const { error } = await db.from("orders").update(update).eq("id", order.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (order.status !== status) {
    await db.from("order_status_history").insert({
      organization_id: order.organization_id,
      shop_id: order.shop_id,
      order_id: order.id,
      from_status: order.status,
      to_status: status,
      changed_by: user.id,
      note: String(body.note || "").trim() || null,
      metadata: { source: "advanced-admin" }
    });
  }

  const { data: linked } = await db.from("order_items").select("design_id").eq("order_id", order.id).not("design_id", "is", null).limit(20);
  const designIds = (linked || []).map((x: any) => x.design_id).filter(Boolean);
  if (designIds.length && status === "completed") {
    await db.from("designs").update({ status: "delivered", delivered_at: now, updated_at: now }).in("id", designIds);
  }
  if (designIds.length && status === "cancelled") {
    await db.from("designs").update({ status: "failed", updated_at: now }).in("id", designIds);
  }

  return NextResponse.json({ ok: true, status });
}
