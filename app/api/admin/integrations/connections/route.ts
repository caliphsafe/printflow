import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const SQUARE_VERSION = "2026-05-20";
type Payload = { provider: string; category: string; credentials: Record<string,string> };

function publicOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
}

async function connectStripe(request: Request, input: Record<string, string>, previous?: any) {
  const secretKey = input.secretKey?.trim();
  if (!secretKey?.startsWith("sk_")) throw new Error("Enter a valid Stripe secret or restricted key.");
  const accountResponse = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" });
  const account = await accountResponse.json();
  if (!accountResponse.ok) throw new Error(account.error?.message || "Stripe rejected these credentials.");
  if (account.charges_enabled === false) throw new Error("Stripe is connected, but card charges are not enabled for this account.");

  let previousValues: Record<string, string> = {};
  try { if (previous?.encrypted_credentials) previousValues = JSON.parse(decryptSecret(previous.encrypted_credentials)); } catch {}
  let webhookSecret: string | undefined = previousValues.webhookSecret;
  let webhookEndpointId: string | undefined = previous?.configuration?.webhookEndpointId;
  const notificationUrl = `${publicOrigin(request)}/api/webhooks/stripe`;
  const mode = secretKey.startsWith("sk_live_") ? "live" : "test";
  if (previous?.configuration?.accountId !== account.id || previous?.configuration?.mode !== mode || previous?.configuration?.notificationUrl !== notificationUrl) {
    webhookSecret = undefined;
    webhookEndpointId = undefined;
  }
  if (!webhookSecret) {
    const body = new URLSearchParams();
    body.set("url", notificationUrl);
    body.append("enabled_events[]", "checkout.session.completed");
    body.append("enabled_events[]", "checkout.session.async_payment_succeeded");
    body.append("enabled_events[]", "checkout.session.async_payment_failed");
    body.set("description", "PrintFlow order payment updates");
    const webhookResponse = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store"
    });
    const webhook = await webhookResponse.json();
    if (!webhookResponse.ok || !webhook.secret) throw new Error(webhook.error?.message || "Stripe connected, but PrintFlow could not create the payment webhook.");
    webhookSecret = webhook.secret;
    webhookEndpointId = webhook.id;
  }
  return {
    label: account.business_profile?.name || account.settings?.dashboard?.display_name || account.email || account.id,
    credentials: { secretKey, webhookSecret },
    configuration: {
      accountId: account.id,
      chargesEnabled: account.charges_enabled !== false,
      currency: account.default_currency || "usd",
      webhookEndpointId,
      notificationUrl,
      mode
    }
  };
}

async function connectSquare(request: Request, input: Record<string, string>, previous?: any) {
  const accessToken = input.accessToken?.trim();
  const environment = input.environment === "sandbox" ? "sandbox" : "production";
  if (!accessToken) throw new Error("Enter a Square access token.");
  const base = environment === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  const locationResponse = await fetch(`${base}/v2/locations`, { headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" }, cache: "no-store" });
  const locationData = await locationResponse.json();
  if (!locationResponse.ok) throw new Error(locationData.errors?.[0]?.detail || "Square rejected these credentials.");
  const locations = (locationData.locations || []).filter((location: any) => location.status !== "INACTIVE");
  const location = locations.find((item: any) => item.id === input.locationId) || locations[0];
  if (!location) throw new Error("Square has no active location available for checkout.");

  let previousValues: Record<string, string> = {};
  try { if (previous?.encrypted_credentials) previousValues = JSON.parse(decryptSecret(previous.encrypted_credentials)); } catch {}
  let signatureKey: string | undefined = previousValues.signatureKey;
  let webhookSubscriptionId: string | undefined = previous?.configuration?.webhookSubscriptionId;
  const notificationUrl = `${publicOrigin(request)}/api/webhooks/square`;
  if (previous?.configuration?.environment !== environment || previous?.configuration?.notificationUrl !== notificationUrl) {
    signatureKey = undefined;
    webhookSubscriptionId = undefined;
  }
  if (!signatureKey) {
    const webhookResponse = await fetch(`${base}/v2/webhooks/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        subscription: {
          name: `PrintFlow ${location.name || "payments"}`,
          event_types: ["payment.created", "payment.updated"],
          notification_url: notificationUrl,
          api_version: SQUARE_VERSION
        }
      }),
      cache: "no-store"
    });
    const webhook = await webhookResponse.json();
    if (!webhookResponse.ok || !webhook.subscription?.signature_key) throw new Error(webhook.errors?.[0]?.detail || "Square connected, but PrintFlow could not create the payment webhook. Use a personal access token for the Square application.");
    signatureKey = webhook.subscription.signature_key;
    webhookSubscriptionId = webhook.subscription.id;
  }
  return {
    label: location.name || "Square location",
    credentials: { accessToken, environment, locationId: location.id, signatureKey },
    configuration: {
      environment,
      locationId: location.id,
      currency: location.currency || "USD",
      webhookSubscriptionId,
      notificationUrl,
      mode: environment === "production" ? "live" : "sandbox"
    }
  };
}

export async function GET() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const [{ data: connections, error }, { data: ss }] = await Promise.all([
    supabase.from("integration_connections").select("provider,category,status,account_label,configuration,last_tested_at,last_error").eq("shop_id", shop.id),
    supabase.from("supplier_connections").select("provider,status,account_hint,settings,last_tested_at,last_error,updated_at").eq("shop_id", shop.id)
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const supplierConnections = (ss || []).map((item: any) => ({ provider: item.provider, category: "supplier", status: item.status, account_label: item.account_hint, configuration: item.settings, last_tested_at: item.last_tested_at || item.updated_at, last_error: item.last_error || null }));
  return NextResponse.json({ connections: [...(connections || []), ...supplierConnections] });
}

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!shop || !membership) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json() as Payload;
  if (!["stripe", "square"].includes(body.provider)) return NextResponse.json({ error: "This integration is not available for live connection yet." }, { status: 400 });
  const { data: previous } = await supabase.from("integration_connections").select("encrypted_credentials,configuration").eq("shop_id", shop.id).eq("provider", body.provider).maybeSingle();
  try {
    const connected = body.provider === "stripe" ? await connectStripe(request, body.credentials, previous) : await connectSquare(request, body.credentials, previous);
    const now = new Date().toISOString();
    const { error } = await supabase.from("integration_connections").upsert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      provider: body.provider,
      category: "payment",
      status: "connected",
      account_label: connected.label,
      encrypted_credentials: encryptSecret(JSON.stringify(connected.credentials)),
      configuration: connected.configuration,
      last_tested_at: now,
      last_error: null,
      updated_at: now
    }, { onConflict: "shop_id,provider" });
    if (error) throw new Error(error.message);
    const settings = { ...(shop.settings || {}), payment: { ...((shop.settings as any)?.payment || {}), provider: body.provider } };
    await supabase.from("shops").update({ settings, updated_at: now }).eq("id", shop.id);
    return NextResponse.json({ ok: true, status: "connected", accountLabel: connected.label, configuration: connected.configuration });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Connection failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const provider = new URL(request.url).searchParams.get("provider");
  if (!provider) return NextResponse.json({ error: "Provider is required." }, { status: 400 });
  const { error } = await supabase.from("integration_connections").delete().eq("shop_id", shop.id).eq("provider", provider);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
