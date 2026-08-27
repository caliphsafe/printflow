import { publicCors } from "@/lib/public-cors";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSquareCheckoutForOrder } from "@/lib/commerce-payments";
import { makeOrderDisplayId } from "@/lib/commerce-orders";

function newBedfordToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function resolveRush(requestedDueDate: unknown) {
  const due = String(requestedDueDate || "").trim();
  if (!due) return { requestedDueDate: null as string | null, rushFee: 0, rushWindow: "not_selected" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error("The requested due date is invalid.");
  const today = newBedfordToday();
  const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  if (days < 0) throw new Error("Please choose a future due date.");
  if (days < 10) return { requestedDueDate: due, rushFee: 100, rushWindow: "under_10_days" };
  if (days <= 15) return { requestedDueDate: due, rushFee: 50, rushWindow: "10_to_15_days" };
  return { requestedDueDate: due, rushFee: 0, rushWindow: "standard" };
}

export async function OPTIONS(request: Request) {
  const cors = publicCors(request);
  return new Response(null, { status: 204, headers: cors.headers });
}

export async function POST(request: Request) {
  const cors = publicCors(request);
  if (!cors.accepted) return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers: cors.headers });

  try {
    const body = await request.json();
    const db = createSupabaseAdmin();
    const { data: shop } = await db.from("shops").select("id,organization_id,name,active").eq("slug", String(body.shopSlug || "")).eq("active", true).maybeSingle();
    if (!shop) return NextResponse.json({ error: "Shop not found." }, { status: 404, headers: cors.headers });

    const { data: store } = await db.from("storefronts").select("id,name,active").eq("shop_id", shop.id).eq("slug", String(body.storefrontSlug || "")).eq("active", true).maybeSingle();
    if (!store) return NextResponse.json({ error: "Storefront not found." }, { status: 404, headers: cors.headers });

    const customer = body.customer || {};
    if (!String(customer.name || "").trim() || !String(customer.email || "").trim()) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400, headers: cors.headers });
    }

    const requested = Array.isArray(body.items) ? body.items : [];
    if (!requested.length) return NextResponse.json({ error: "Choose at least one uniform item." }, { status: 400, headers: cors.headers });

    const { data: links } = await db.from("storefront_products").select("catalog_product_id,name_override,price,configuration").eq("storefront_id", store.id).eq("active", true);
    const ids = (links || []).map((item: any) => item.catalog_product_id);
    const { data: products } = ids.length
      ? await db.from("catalog_products").select("id,slug,name,description,configuration").in("id", ids)
      : { data: [] as any[] };

    const productBySlug = new Map((products || []).map((product: any) => [product.slug, product]));
    const linkByProduct = new Map((links || []).map((link: any) => [link.catalog_product_id, link]));
    let merchandiseTotal = 0;
    const normalized: any[] = [];

    for (const requestItem of requested) {
      const product: any = productBySlug.get(String(requestItem.productSlug));
      if (!product) throw new Error(`Uniform item ${requestItem.productSlug} is unavailable.`);
      const link: any = linkByProduct.get(product.id);
      const allowed: string[] = link.configuration?.sizes || product.configuration?.sizes || [];
      const quantities = (Array.isArray(requestItem.quantities) ? requestItem.quantities : [])
        .map((quantity: any) => ({ size: String(quantity.size), quantity: Math.max(0, Math.floor(Number(quantity.quantity || 0))) }))
        .filter((quantity: any) => quantity.quantity > 0 && allowed.includes(quantity.size));
      const quantity = quantities.reduce((sum: number, row: any) => sum + row.quantity, 0);
      if (!quantity) continue;
      const price = Number(link.price || 0);
      merchandiseTotal += price * quantity;
      normalized.push({ product, link, price, quantities, quantity });
    }

    if (!normalized.length || merchandiseTotal <= 0) return NextResponse.json({ error: "Choose at least one valid size and quantity." }, { status: 400, headers: cors.headers });

    const rush = resolveRush(body.requestedDueDate);
    const total = Number((merchandiseTotal + rush.rushFee).toFixed(2));
    const displayId = makeOrderDisplayId("AE");
    const now = new Date().toISOString();
    const { data: order, error: orderError } = await db.from("orders").insert({
      organization_id: shop.organization_id,
      shop_id: shop.id,
      display_id: displayId,
      storefront_id: store.id,
      channel: "storefront",
      status: "draft",
      payment_status: "not_started",
      currency: "usd",
      subtotal: Number(merchandiseTotal.toFixed(2)),
      rush_fee: rush.rushFee,
      total,
      requested_due_date: rush.requestedDueDate,
      customer_name_snapshot: String(customer.name).trim(),
      customer_email_snapshot: String(customer.email).trim().toLowerCase(),
      customer_phone_snapshot: String(customer.phone || "").trim() || null,
      metadata: {
        storefrontSlug: String(body.storefrontSlug),
        storefrontName: store.name,
        rushWindow: rush.rushWindow,
        ...(body.metadata || {})
      },
      created_at: now,
      updated_at: now
    }).select("*").single();
    if (orderError || !order) throw new Error(orderError?.message || "Unable to create order.");

    try {
      for (const normalizedItem of normalized) {
        const { data: item, error } = await db.from("order_items").insert({
          organization_id: shop.organization_id,
          shop_id: shop.id,
          order_id: order.id,
          catalog_product_id: normalizedItem.product.id,
          product_name_snapshot: normalizedItem.link.name_override || normalizedItem.product.name,
          color_name: normalizedItem.product.configuration?.colors?.[0]?.name || null,
          decoration_method: normalizedItem.product.configuration?.customization?.decorationMethods?.[0] || "Preset",
          decoration_location: "Left Chest",
          quantity: normalizedItem.quantity,
          garment_subtotal: normalizedItem.price * normalizedItem.quantity,
          line_total: normalizedItem.price * normalizedItem.quantity,
          configuration: { storefrontProduct: true, unitPrice: normalizedItem.price, locked: true }
        }).select("id").single();
        if (error || !item) throw new Error(error?.message || "Unable to create line item.");
        await db.from("order_item_quantities").insert(normalizedItem.quantities.map((quantity: any) => ({
          order_item_id: item.id,
          size_name: quantity.size,
          quantity: quantity.quantity,
          unit_cost_snapshot: null
        })));
      }

      await db.from("order_status_history").insert({
        organization_id: shop.organization_id,
        shop_id: shop.id,
        order_id: order.id,
        from_status: null,
        to_status: "draft",
        note: `${store.name} order created.`,
        metadata: { rushFee: rush.rushFee, rushWindow: rush.rushWindow }
      });

      const checkout = await createSquareCheckoutForOrder(order as any, request.url, `${store.name} uniforms`);
      return NextResponse.json({ orderId: order.id, displayId, checkoutUrl: checkout.checkoutUrl, rushFee: rush.rushFee, total }, { headers: cors.headers });
    } catch (error) {
      await db.from("orders").delete().eq("id", order.id);
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start uniform order." }, { status: 400, headers: cors.headers });
  }
}
