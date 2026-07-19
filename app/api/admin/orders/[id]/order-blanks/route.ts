import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { ssRequest } from "@/lib/ss-activewear";

type Props = { params: Promise<{ id: string }> };

function orderList(response: any) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.Orders)) return response.Orders;
  return response?.orderNumber ? [response] : [];
}

export async function POST(request: Request, { params }: Props) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const allowBeforePayment = body?.allowBeforePayment === true;
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const [{ data: design }, { data: connection }, { data: existing }] = await Promise.all([
    supabase.from("designs").select("id,display_id,status,payment_status,customer_email,supplier_items").eq("id", id).eq("shop_id", shop.id).single(),
    supabase.from("supplier_connections").select("encrypted_account_number,encrypted_api_key,settings,status").eq("shop_id", shop.id).eq("provider", "ss-activewear").single(),
    supabase.from("supplier_orders").select("id,external_order_numbers").eq("design_id", id).eq("provider", "ss-activewear").maybeSingle()
  ]);

  if (!design) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (existing) return NextResponse.json({ error: "Blanks have already been ordered for this job." }, { status: 409 });
  const paid = design.payment_status === "paid" || design.status === "paid";
  if (!paid && !allowBeforePayment) return NextResponse.json({ error: "Confirm payment or choose to order before payment." }, { status: 409 });
  if (!connection || connection.status !== "connected") return NextResponse.json({ error: "Connect S&S Activewear in Integrations first." }, { status: 409 });

  const items = Array.isArray(design.supplier_items) ? design.supplier_items.filter((item: any) => Number(item.quantity) > 0 && item.sku) : [];
  if (!items.length) return NextResponse.json({ error: "This job does not contain imported S&S SKUs." }, { status: 409 });

  const settings: any = connection.settings || {};
  const address = settings.shippingAddress || {};
  if (!address.customer || !address.address || !address.city || !address.state || !address.zip) {
    return NextResponse.json({ error: "Complete the S&S delivery address in Suppliers before ordering." }, { status: 400 });
  }

  const payload: Record<string, any> = {
    shippingAddress: {
      customer: address.customer,
      attn: address.attn || "",
      address: address.address,
      city: address.city,
      state: address.state,
      zip: address.zip,
      residential: address.residential === true
    },
    shippingMethod: String(settings.shippingMethod || "1"),
    shipBlind: false,
    poNumber: `PF-${design.display_id}`,
    emailConfirmation: String(settings.emailConfirmation || design.customer_email || ""),
    testOrder: settings.testMode !== false,
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

    const { error } = await supabase.from("supplier_orders").insert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      design_id: design.id,
      provider: "ss-activewear",
      status: "confirmed",
      test_order: payload.testOrder,
      external_order_numbers: orderNumbers,
      request_payload: { ...payload, orderedBeforePayment: !paid },
      response_payload: response
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, orderNumbers, testOrder: payload.testOrder, orderedBeforePayment: !paid });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit the S&S order." }, { status: 502 });
  }
}
