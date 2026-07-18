import crypto from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { PaymentProvider } from "@/lib/types";

const SQUARE_VERSION = "2026-05-20";
const cents = (amount: number) => Math.max(0, Math.round(Number(amount || 0) * 100));

export type PaymentDesign = {
  id: string;
  display_id: string;
  shop_id: string;
  product_name: string;
  package_quantity: number;
  package_price: number;
  customer_name: string;
  customer_email: string;
  status: string;
  payment_reference?: string | null;
  payment_provider?: string | null;
  payment_status?: string | null;
  shops?: { slug?: string; name?: string; settings?: any } | { slug?: string; name?: string; settings?: any }[] | null;
};

type ConnectionRow = {
  id: string;
  provider: string;
  status: string;
  account_label?: string | null;
  encrypted_credentials: string;
  configuration?: Record<string, any> | null;
};

function originFrom(requestUrl?: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (requestUrl) return new URL(requestUrl).origin;
  throw new Error("NEXT_PUBLIC_SITE_URL is required for live checkout.");
}

function credentials(row: ConnectionRow) {
  return JSON.parse(decryptSecret(row.encrypted_credentials)) as Record<string, string>;
}

function shopFromDesign(design: PaymentDesign) {
  return Array.isArray(design.shops) ? design.shops[0] : design.shops;
}

export async function getLivePaymentConnection(shopId: string, preferred?: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("integration_connections")
    .select("id,provider,status,account_label,encrypted_credentials,configuration")
    .eq("shop_id", shopId)
    .eq("category", "payment")
    .eq("status", "connected");
  if (error) throw new Error(error.message);
  const rows = (data || []) as ConnectionRow[];
  const requested = preferred ? rows.find((row) => row.provider === preferred) : undefined;
  return requested || rows.find((row) => row.provider === "stripe") || rows.find((row) => row.provider === "square") || null;
}

export async function createCheckoutForDesign(design: PaymentDesign, requestUrl?: string) {
  const shop = shopFromDesign(design);
  const preferred = shop?.settings?.payment?.provider;
  const connection = await getLivePaymentConnection(design.shop_id, preferred);
  if (!connection) throw new Error("This shop has not connected a live payment provider yet.");
  const origin = originFrom(requestUrl);
  if (connection.provider === "stripe") return createStripeCheckout(design, connection, origin);
  if (connection.provider === "square") return createSquareCheckout(design, connection, origin);
  throw new Error("The selected payment provider is not available for live checkout.");
}


async function ensureStripeWebhook(connection: ConnectionRow, values: Record<string, string>, origin: string) {
  const notificationUrl = `${origin}/api/webhooks/stripe`;
  if (values.webhookSecret && connection.configuration?.notificationUrl === notificationUrl) return values;
  const body = new URLSearchParams();
  body.set("url", notificationUrl);
  body.append("enabled_events[]", "checkout.session.completed");
  body.append("enabled_events[]", "checkout.session.async_payment_succeeded");
  body.append("enabled_events[]", "checkout.session.async_payment_failed");
  body.set("description", "PrintFlow order payment updates");
  const response = await fetch("https://api.stripe.com/v1/webhook_endpoints", { method: "POST", headers: { Authorization: `Bearer ${values.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  const webhook = await response.json();
  if (!response.ok || !webhook.secret) throw new Error(webhook.error?.message || "Stripe is connected, but PrintFlow could not create its payment webhook.");
  const next = { ...values, webhookSecret: webhook.secret };
  await createSupabaseAdmin().from("integration_connections").update({ encrypted_credentials: encryptSecret(JSON.stringify(next)), configuration: { ...(connection.configuration || {}), webhookEndpointId: webhook.id, notificationUrl }, updated_at: new Date().toISOString() }).eq("id", connection.id);
  return next;
}

async function createStripeCheckout(design: PaymentDesign, connection: ConnectionRow, origin: string) {
  let values = credentials(connection);
  values = await ensureStripeWebhook(connection, values, origin);
  if (!values.secretKey) throw new Error("Stripe credentials are incomplete.");
  const shop = shopFromDesign(design);
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${origin}/order/${design.display_id}/success?provider=stripe&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${origin}/order/${design.display_id}/payment?cancelled=1`);
  body.set("client_reference_id", design.id);
  body.set("customer_email", design.customer_email);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", String(connection.configuration?.currency || "usd"));
  body.set("line_items[0][price_data][unit_amount]", String(cents(design.package_price)));
  body.set("line_items[0][price_data][product_data][name]", `${shop?.name || "Print shop"} · ${design.product_name}`);
  body.set("line_items[0][price_data][product_data][description]", `${design.package_quantity} custom garments · Order ${design.display_id}`);
  body.set("metadata[design_id]", design.id);
  body.set("metadata[display_id]", design.display_id);
  body.set("metadata[shop_id]", design.shop_id);
  body.set("payment_intent_data[metadata][design_id]", design.id);
  body.set("payment_intent_data[metadata][display_id]", design.display_id);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${values.secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store"
  });
  const result = await response.json();
  if (!response.ok || !result.url) throw new Error(result.error?.message || "Stripe could not create the checkout session.");

  await createSupabaseAdmin().from("designs").update({
    payment_provider: "stripe",
    payment_reference: result.id,
    payment_url: result.url,
    payment_status: "pending",
    checkout_url: result.url,
    updated_at: new Date().toISOString()
  }).eq("id", design.id);
  return { provider: "stripe" as const, checkoutUrl: result.url as string, reference: result.id as string };
}

async function createSquareCheckout(design: PaymentDesign, connection: ConnectionRow, origin: string) {
  const values = credentials(connection);
  const environment = values.environment === "sandbox" ? "sandbox" : "production";
  const base = environment === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  const locationId = connection.configuration?.locationId || values.locationId;
  if (!values.accessToken || !locationId) throw new Error("Square credentials are missing an active location.");
  const response = await fetch(`${base}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: { Authorization: `Bearer ${values.accessToken}`, "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      description: `PrintFlow order ${design.display_id}`,
      quick_pay: {
        name: `${design.product_name} · ${design.package_quantity} garments`,
        price_money: { amount: cents(design.package_price), currency: String(connection.configuration?.currency || "USD").toUpperCase() },
        location_id: locationId
      },
      checkout_options: {
        redirect_url: `${origin}/order/${design.display_id}/success?provider=square`,
        ask_for_shipping_address: false,
        allow_tipping: false
      },
      pre_populated_data: { buyer_email: design.customer_email }
    }),
    cache: "no-store"
  });
  const result = await response.json();
  const link = result.payment_link;
  if (!response.ok || !link?.url) throw new Error(result.errors?.[0]?.detail || "Square could not create the payment link.");
  const reference = link.order_id || link.id;
  await createSupabaseAdmin().from("designs").update({
    payment_provider: "square",
    payment_reference: reference,
    payment_url: link.url,
    payment_status: "pending",
    checkout_url: link.url,
    updated_at: new Date().toISOString()
  }).eq("id", design.id);
  return { provider: "square" as const, checkoutUrl: link.url as string, reference: reference as string };
}

export async function confirmStripeSession(design: PaymentDesign, sessionId: string) {
  const connection = await getLivePaymentConnection(design.shop_id, "stripe");
  if (!connection) return false;
  const values = credentials(connection);
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${values.secretKey}` },
    cache: "no-store"
  });
  const session = await response.json();
  if (!response.ok) return false;
  if (session.payment_status === "paid" && (session.client_reference_id === design.id || session.metadata?.design_id === design.id)) {
    await markDesignPaid(design.id, "stripe", session.id, Number(session.amount_total || 0) / 100);
    return true;
  }
  return false;
}

export async function confirmSquareOrder(design: PaymentDesign) {
  const connection = await getLivePaymentConnection(design.shop_id, "square");
  if (!connection || !design.payment_reference) return false;
  const values = credentials(connection);
  const environment = values.environment === "sandbox" ? "sandbox" : "production";
  const base = environment === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  const response = await fetch(`${base}/v2/orders/${encodeURIComponent(design.payment_reference)}`, {
    headers: { Authorization: `Bearer ${values.accessToken}`, "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" },
    cache: "no-store"
  });
  const result = await response.json();
  const order = result.order;
  if (response.ok && order && ["COMPLETED", "OPEN"].includes(order.state) && Array.isArray(order.tenders) && order.tenders.some((tender: any) => tender.card_details?.status === "CAPTURED" || tender.type)) {
    const amount = Number(order.total_money?.amount || 0) / 100;
    await markDesignPaid(design.id, "square", design.payment_reference, amount);
    return true;
  }
  return false;
}

export async function markDesignPaid(designId: string, provider: PaymentProvider, reference: string, amount?: number) {
  const now = new Date().toISOString();
  await createSupabaseAdmin().from("designs").update({
    status: "paid",
    payment_provider: provider,
    payment_reference: reference,
    payment_status: "paid",
    paid_amount: amount ?? null,
    paid_at: now,
    updated_at: now
  }).eq("id", designId);
}

export function verifyStripeSignature(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=") as [string, string]));
  const timestamp = Number(parts.t || 0);
  const signature = parts.v1;
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

export function verifySquareSignature(rawBody: string, signature: string, notificationUrl: string, signatureKey: string) {
  const expected = crypto.createHmac("sha256", signatureKey).update(notificationUrl + rawBody).digest("base64");
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}
