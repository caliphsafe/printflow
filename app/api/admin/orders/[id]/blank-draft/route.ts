import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";

type Props = { params: Promise<{ id: string }> };

type SupplierItem = {
  provider?: string;
  sku?: string;
  quantity?: number;
  unitCost?: number;
  [key: string]: unknown;
};

function providerKey(item: SupplierItem) {
  return String(item.provider || "manual").trim().toLowerCase();
}

export async function POST(_request: Request, { params }: Props) {
  const { id } = await params;
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const [{ data: design }, { data: submittedOrders }] = await Promise.all([
    supabase.from("designs").select("id,display_id,supplier_items").eq("id", id).eq("shop_id", shop.id).single(),
    supabase.from("supplier_orders").select("provider").eq("design_id", id)
  ]);

  if (!design) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const orderedProviders = new Set((submittedOrders || []).map((order: any) => String(order.provider)));
  const items = (Array.isArray(design.supplier_items) ? design.supplier_items : [])
    .filter((item: SupplierItem) => item?.sku && Number(item.quantity || 0) > 0);

  if (!items.length) return NextResponse.json({ error: "No supplier SKUs are attached to this order." }, { status: 409 });

  const grouped = new Map<string, SupplierItem[]>();
  for (const item of items) {
    const provider = providerKey(item);
    if (orderedProviders.has(provider)) continue;
    grouped.set(provider, [...(grouped.get(provider) || []), item]);
  }

  if (!grouped.size) return NextResponse.json({ error: "These supplier items have already been ordered." }, { status: 409 });

  const carts = [];
  for (const [provider, providerItems] of grouped.entries()) {
    const estimatedTotal = providerItems.reduce(
      (sum, item) => sum + Number(item.unitCost || 0) * Number(item.quantity || 0),
      0
    );
    const { data, error } = await supabase
      .from("supplier_order_drafts")
      .upsert(
        {
          organization_id: membership.organization_id,
          shop_id: shop.id,
          design_id: design.id,
          provider,
          status: "cart",
          items: providerItems,
          estimated_total: estimatedTotal,
          notes: `Supplier cart for ${design.display_id}`,
          updated_at: new Date().toISOString()
        },
        { onConflict: "design_id,provider" }
      )
      .select("id,provider,status,items,estimated_total")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    carts.push(data);
  }

  return NextResponse.json({ carts });
}

export async function DELETE(request: Request, { params }: Props) {
  const { id } = await params;
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const provider = String(body?.provider || "").trim().toLowerCase();
  let query = supabase
    .from("supplier_order_drafts")
    .delete()
    .eq("design_id", id)
    .eq("shop_id", shop.id)
    .in("status", ["cart", "ready"]);
  if (provider) query = query.eq("provider", provider);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
