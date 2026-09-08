import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { ssRequest } from "@/lib/ss-activewear";
import { getSanMarCachedStyle } from "@/lib/sanmar-catalog";
import { submitSanMarOrder } from "@/lib/sanmar-orders";

type Props = { params: Promise<{ id: string }> };

function orderList(response: any) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.Orders)) return response.Orders;
  return response?.orderNumber ? [response] : [];
}

function normalizedProvider(value: unknown) {
  const provider = String(value || "ss-activewear").trim().toLowerCase();
  return provider === "sanmar" ? "sanmar" : "ss-activewear";
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const allowBeforePayment = body?.allowBeforePayment === true;
  const provider = normalizedProvider(body?.provider);
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const [{ data: design }, { data: connection }, { data: existing }] = await Promise.all([
    supabase.from("designs").select("id,display_id,status,payment_status,customer_email,supplier_items,catalog_product_id").eq("id", id).eq("shop_id", shop.id).single(),
    supabase.from("supplier_connections").select("encrypted_account_number,encrypted_api_key,settings,status").eq("shop_id", shop.id).eq("provider", provider).maybeSingle(),
    supabase.from("supplier_orders").select("id,external_order_numbers").eq("design_id", id).eq("provider", provider).maybeSingle()
  ]);

  if (!design) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (existing) return NextResponse.json({ error: `Blanks have already been ordered from ${provider === "sanmar" ? "SanMar" : "S&S Activewear"} for this job.` }, { status: 409 });
  const paid = design.payment_status === "paid" || design.status === "paid";
  if (!paid && !allowBeforePayment) return NextResponse.json({ error: "Confirm payment or choose to order before payment." }, { status: 409 });
  if (!connection || connection.status !== "connected") return NextResponse.json({ error: `Connect ${provider === "sanmar" ? "SanMar" : "S&S Activewear"} in Suppliers first.` }, { status: 409 });

  const items = Array.isArray(design.supplier_items)
    ? design.supplier_items.filter((item: any) => Number(item.quantity) > 0 && item.sku && String(item.provider || "ss-activewear") === provider)
    : [];
  if (!items.length) return NextResponse.json({ error: `This job does not contain imported ${provider === "sanmar" ? "SanMar" : "S&S"} SKUs.` }, { status: 409 });

  const settings: any = connection.settings || {};
  const address = settings.shippingAddress || {};
  if (!address.customer || !address.address || !address.city || !address.state || !address.zip) {
    return NextResponse.json({ error: `Complete the ${provider === "sanmar" ? "SanMar" : "S&S"} delivery address in Suppliers before ordering.` }, { status: 400 });
  }

  if (provider === "ss-activewear") {
    const payload: Record<string, any> = {
      shippingAddress: { customer: address.customer, attn: address.attn || "", address: address.address, city: address.city, state: address.state, zip: address.zip, residential: address.residential === true },
      shippingMethod: String(settings.shippingMethod || "1"), shipBlind: false, poNumber: `PF-${design.display_id}`,
      emailConfirmation: String(settings.emailConfirmation || design.customer_email || ""), testOrder: settings.testMode !== false,
      autoselectWarehouse: settings.autoselectWarehouse !== false,
      lines: items.map((item: any) => ({ identifier: String(item.sku), qty: Number(item.quantity) }))
    };
    if (settings.paymentProfile?.email && settings.paymentProfile?.profileID) payload.paymentProfile = settings.paymentProfile;
    try {
      const response = await ssRequest<any>(connection, "/orders/", { method: "POST", body: JSON.stringify(payload) });
      const orders = orderList(response);
      const orderNumbers = orders.map((order: any) => String(order.orderNumber || "")).filter(Boolean);
      const lineErrors = response?.lineErrors || response?.LineErrors || [];
      if (!orders.length || !orderNumbers.length) {
        const supplierMessage = Array.isArray(lineErrors) && lineErrors.length ? lineErrors.map((item: any) => item.message || item.error || JSON.stringify(item)).join("; ") : "S&S did not return an order confirmation.";
        throw new Error(supplierMessage);
      }
      const { error } = await supabase.from("supplier_orders").insert({ organization_id: membership.organization_id, shop_id: shop.id, design_id: design.id, provider: "ss-activewear", status: "confirmed", test_order: payload.testOrder, external_order_numbers: orderNumbers, request_payload: { ...payload, orderedBeforePayment: !paid }, response_payload: response });
      if (error) throw error;
      await supabase.from("supplier_order_drafts").update({ status: "submitted", updated_at: new Date().toISOString() }).eq("design_id", design.id).eq("provider", "ss-activewear");
      return NextResponse.json({ ok: true, orderNumbers, testOrder: payload.testOrder, orderedBeforePayment: !paid });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit the S&S order." }, { status: 502 });
    }
  }

  try {
    if (settings.poEnabled !== true) return NextResponse.json({ error: "SanMar catalog/product access is connected, but production PO submission is not enabled. Complete SanMar PO onboarding/testing, then enable SanMar ordering in Suppliers." }, { status: 409 });
    if (!design.catalog_product_id) throw new Error("This SanMar job is missing its imported catalog product.");
    const { data: product } = await supabase.from("catalog_products").select("configuration").eq("id", design.catalog_product_id).eq("shop_id", shop.id).maybeSingle();
    const styleId = String(product?.configuration?.supplier?.styleId || "").trim().toUpperCase();
    if (!styleId || product?.configuration?.supplier?.provider !== "sanmar") throw new Error("This job is not linked to an imported SanMar product.");

    const cached = await getSanMarCachedStyle(supabase, String(shop.id), styleId);
    if (!cached) throw new Error("Sync the SanMar catalog before placing this order so PrintFlow has SanMar inventory keys and size indexes.");
    const cachedVariants = Array.isArray(cached.variants) ? cached.variants : [];
    const lines = items.map((item: any) => {
      const colorName = String(item.colorName || "");
      const sizeName = String(item.sizeName || "");
      const match = cachedVariants.find((variant: any) => String(variant.colorName).toLowerCase() === colorName.toLowerCase() && String(variant.sizeName).toLowerCase() === sizeName.toLowerCase());
      if (!match) throw new Error(`SanMar catalog data no longer contains ${styleId} ${colorName} ${sizeName}. Sync the catalog and review the job before ordering.`);
      return { style: styleId, color: String(match.mainframeColor || colorName), size: sizeName, quantity: Number(item.quantity || 0), inventoryKey: String(match.inventoryKey || ""), sizeIndex: String(match.sizeIndex || "") };
    });

    const poNumber = `PF-${design.display_id}`.slice(0, 28);
    const result = await submitSanMarOrder(connection as any, {
      poNumber,
      address: { customer: String(address.customer), attn: String(address.attn || ""), address: String(address.address), address2: String(address.address2 || ""), city: String(address.city), state: String(address.state).toUpperCase(), zip: String(address.zip), residential: address.residential === true },
      shipMethod: String(settings.shippingMethod || "UPS"),
      email: String(settings.emailConfirmation || design.customer_email || ""),
      lines
    });
    const orderNumbers = [poNumber];
    const { error } = await supabase.from("supplier_orders").insert({ organization_id: membership.organization_id, shop_id: shop.id, design_id: design.id, provider: "sanmar", status: "confirmed", test_order: false, external_order_numbers: orderNumbers, request_payload: { poNumber, shippingAddress: address, shippingMethod: settings.shippingMethod || "UPS", lines, orderedBeforePayment: !paid }, response_payload: { message: result.message } });
    if (error) throw error;
    await supabase.from("supplier_order_drafts").update({ status: "submitted", updated_at: new Date().toISOString() }).eq("design_id", design.id).eq("provider", "sanmar");
    return NextResponse.json({ ok: true, orderNumbers, testOrder: false, orderedBeforePayment: !paid, message: result.message });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit the SanMar order." }, { status: 502 });
  }
}
