import { createSupabaseAdmin } from "@/lib/supabase-admin";

export function makeOrderDisplayId(prefix = "AE") {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(2, 5);
  return `${prefix}-${stamp}${rand}`;
}

function money(value: unknown) { return Number(Math.max(0, Number(value || 0)).toFixed(2)); }

export async function mirrorDesignToCommerceOrder(designId: string) {
  const db = createSupabaseAdmin();
  const { data: d, error } = await db.from("designs").select("*").eq("id", designId).single();
  if (error || !d) throw new Error(error?.message || "Design not found.");
  const { data: existing } = await db.from("orders").select("id,display_id").eq("shop_id", d.shop_id).eq("display_id", d.display_id).maybeSingle();
  if (existing) return existing;

  const total = money(d.package_price || d.design_configuration?.totalPrice);
  const now = new Date().toISOString();
  const { data: order, error: orderError } = await db.from("orders").insert({
    organization_id: d.organization_id, shop_id: d.shop_id, display_id: d.display_id,
    channel: "custom", status: d.status === "paid" ? "paid" : d.status === "awaiting_payment" ? "awaiting_payment" : "draft",
    payment_status: d.payment_status === "paid" ? "paid" : ["pending","preparing"].includes(String(d.payment_status)) ? "pending" : "not_started",
    currency: "usd", subtotal: total, total,
    customer_name_snapshot: d.customer_name, customer_email_snapshot: d.customer_email, customer_phone_snapshot: d.customer_phone,
    notes: d.customer_notes || null, metadata: { source: "printflow-design", designId: d.id, orderSource: d.order_source || "custom" },
    submitted_at: d.submitted_at || null, paid_at: d.paid_at || null, created_at: d.created_at || now, updated_at: now
  }).select("id,display_id").single();
  if (orderError || !order) throw new Error(orderError?.message || "Unable to create commerce order.");

  const config: any = d.design_configuration || {};
  const supplierItems: any[] = Array.isArray(d.supplier_items) ? d.supplier_items : [];
  const firstSupplier = supplierItems[0] || {};
  const garmentSubtotal = money(config.garmentSubtotal);
  const printSubtotal = money(config.printSubtotal);
  const setupFee = money(config.setupFee);
  const { data: item, error: itemError } = await db.from("order_items").insert({
    organization_id: d.organization_id, shop_id: d.shop_id, order_id: order.id,
    catalog_product_id: d.catalog_product_id || null, design_id: d.id,
    product_name_snapshot: d.product_name || "Custom apparel",
    supplier_provider: firstSupplier.provider || null,
    supplier_style_snapshot: { supplierName: firstSupplier.supplierName, brandName: firstSupplier.brandName, styleName: firstSupplier.styleName },
    color_name: d.shirt_color_name || null, decoration_method: config.decorationMethod || null, decoration_location: d.print_location || null,
    quantity: Math.max(1, Number(d.package_quantity || 1)), garment_subtotal: garmentSubtotal,
    decoration_subtotal: printSubtotal, setup_fee: setupFee, line_total: total,
    configuration: { ...config, designSides: d.design_sides || {}, supplierItems }
  }).select("id").single();
  if (itemError || !item) { await db.from("orders").delete().eq("id", order.id); throw new Error(itemError?.message || "Unable to create order item."); }

  const sizes: any[] = Array.isArray(d.size_breakdown) ? d.size_breakdown : [];
  if (sizes.length) {
    const rows = sizes.filter(s => Number(s.quantity) > 0).map(s => {
      const supplier = supplierItems.find(x => String(x.sizeName).toLowerCase() === String(s.size).toLowerCase());
      return { order_item_id: item.id, size_name: String(s.size), quantity: Number(s.quantity), supplier_sku_snapshot: supplier?.sku || null, unit_cost_snapshot: supplier?.unitCost ?? null };
    });
    if (rows.length) await db.from("order_item_quantities").insert(rows);
  }
  await db.from("order_status_history").insert({ organization_id: d.organization_id, shop_id: d.shop_id, order_id: order.id, from_status: null, to_status: d.status === "awaiting_payment" ? "awaiting_payment" : "draft", note: "Created from PrintFlow custom design.", metadata: { designId: d.id } });
  return order;
}

export async function syncCommerceOrderPaidFromDesign(designId: string, provider: "square" | "stripe", reference: string, amount?: number) {
  const db = createSupabaseAdmin();
  const { data: item } = await db.from("order_items").select("order_id,organization_id,shop_id").eq("design_id", designId).maybeSingle();
  if (!item) return;
  const now = new Date().toISOString();
  const { data: order } = await db.from("orders").select("id,status,total,currency").eq("id", item.order_id).single();
  if (!order) return;
  const { data: existingPayment } = await db.from("payments").select("id").eq("order_id", order.id).eq("provider", provider).maybeSingle();
  const paymentPayload = { provider_order_id: provider === "square" ? reference : null, provider_payment_id: provider === "stripe" ? reference : null, amount: money(amount ?? order.total), currency: order.currency || "usd", status: "paid", paid_at: now, updated_at: now, metadata: { legacyDesignId: designId } };
  if (existingPayment) await db.from("payments").update(paymentPayload).eq("id", existingPayment.id);
  else await db.from("payments").insert({ organization_id: item.organization_id, shop_id: item.shop_id, order_id: order.id, provider, ...paymentPayload, created_at: now });
  await db.from("orders").update({ status: "paid", payment_status: "paid", paid_at: now, updated_at: now }).eq("id", order.id);
  if (order.status !== "paid") await db.from("order_status_history").insert({ organization_id: item.organization_id, shop_id: item.shop_id, order_id: order.id, from_status: order.status, to_status: "paid", note: `${provider} payment confirmed.`, metadata: { reference } });
}
