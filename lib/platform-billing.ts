import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyStripeSignature } from "@/lib/payments";

const STRIPE_API = "https://api.stripe.com/v1";
const SETTINGS_KEY = "platform_stripe_billing_webhook";
const PORTAL_SETTINGS_KEY = "platform_stripe_billing_portal";

function billingSecretKey() {
  const key = process.env.PRINTFLOW_BILLING_STRIPE_SECRET_KEY;
  if (!key) throw new Error("PrintFlow subscription billing is not configured yet.");
  return key;
}

function appOrigin(requestUrl?: string) {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/$/, "");
  if (configured) return configured;
  if (requestUrl) return new URL(requestUrl).origin;
  throw new Error("The production app URL is not configured.");
}

async function stripePost(path: string, body: URLSearchParams) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${billingSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Stripe could not complete the billing request.");
  return data;
}

async function stripeDelete(path: string) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${billingSecretKey()}` },
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Stripe could not update the previous subscription.");
  return data;
}

export async function ensurePlatformBillingWebhook(origin = appOrigin()) {
  const admin = createSupabaseAdmin();
  const notificationUrl = `${origin}/api/webhooks/platform-stripe`;
  const { data: stored } = await admin.from("platform_settings").select("encrypted_value").eq("key", SETTINGS_KEY).maybeSingle();
  if (stored?.encrypted_value) {
    try {
      const current = JSON.parse(decryptSecret(stored.encrypted_value));
      if (current.notificationUrl === notificationUrl && current.webhookSecret) return current as { webhookSecret: string; endpointId: string; notificationUrl: string };
    } catch {
      // A fresh endpoint is created below when an earlier value cannot be read.
    }
  }

  const body = new URLSearchParams();
  body.set("url", notificationUrl);
  [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed"
  ].forEach((event) => body.append("enabled_events[]", event));
  body.set("description", "PrintFlow account subscription updates");
  const endpoint = await stripePost("/webhook_endpoints", body);
  const value = { webhookSecret: endpoint.secret, endpointId: endpoint.id, notificationUrl };
  const { error } = await admin.from("platform_settings").upsert({ key: SETTINGS_KEY, encrypted_value: encryptSecret(JSON.stringify(value)), updated_at: new Date().toISOString() });
  if (error) throw new Error(`The billing webhook was created but could not be saved: ${error.message}`);
  return value;
}

export async function createPlatformSubscriptionCheckout({
  organizationId,
  email,
  planCode,
  requestUrl
}: {
  organizationId: string;
  email: string;
  planCode: string;
  requestUrl?: string;
}) {
  const admin = createSupabaseAdmin();
  const origin = appOrigin(requestUrl);
  await ensurePlatformBillingWebhook(origin);
  const [{ data: plan }, { data: account }] = await Promise.all([
    admin.from("subscription_plans").select("code,name,monthly_price,description,active").eq("code", planCode).eq("active", true).maybeSingle(),
    admin.from("subscription_accounts").select("provider_customer_id,provider_subscription_id").eq("organization_id", organizationId).maybeSingle()
  ]);
  if (!plan) throw new Error("That subscription plan is not available.");

  let customerId = account?.provider_customer_id || "";
  if (!customerId) {
    const customerBody = new URLSearchParams();
    customerBody.set("email", email);
    customerBody.set("metadata[organization_id]", organizationId);
    const customer = await stripePost("/customers", customerBody);
    customerId = customer.id;
    await admin.from("subscription_accounts").upsert({
      organization_id: organizationId,
      provider: "stripe",
      provider_customer_id: customerId,
      plan_code: plan.code,
      status: "trialing",
      updated_at: new Date().toISOString()
    }, { onConflict: "organization_id" });
  }

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("customer", customerId);
  body.set("client_reference_id", organizationId);
  body.set("success_url", `${origin}/dashboard/account?billing=success&session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${origin}/dashboard/account?billing=cancelled`);
  body.set("allow_promotion_codes", "true");
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(plan.monthly_price) * 100)));
  body.set("line_items[0][price_data][recurring][interval]", "month");
  body.set("line_items[0][price_data][product_data][name]", `PrintFlow ${plan.name}`);
  body.set("line_items[0][price_data][product_data][description]", plan.description || `${plan.name} monthly plan`);
  body.set("metadata[organization_id]", organizationId);
  body.set("metadata[plan_code]", plan.code);
  body.set("metadata[previous_subscription_id]", account?.provider_subscription_id || "");
  body.set("subscription_data[metadata][organization_id]", organizationId);
  body.set("subscription_data[metadata][plan_code]", plan.code);
  const session = await stripePost("/checkout/sessions", body);
  if (!session.url) throw new Error("Stripe did not return a subscription checkout page.");
  return session.url as string;
}


async function ensurePlatformBillingPortalConfiguration() {
  const admin = createSupabaseAdmin();
  const { data: stored } = await admin.from("platform_settings").select("encrypted_value").eq("key", PORTAL_SETTINGS_KEY).maybeSingle();
  if (stored?.encrypted_value) {
    try {
      const current = JSON.parse(decryptSecret(stored.encrypted_value));
      if (current.configurationId) return String(current.configurationId);
    } catch {
      // A fresh portal configuration is created below.
    }
  }
  const body = new URLSearchParams();
  body.set("business_profile[headline]", "Manage your PrintFlow subscription");
  body.set("features[payment_method_update][enabled]", "true");
  body.set("features[invoice_history][enabled]", "true");
  body.set("features[subscription_cancel][enabled]", "true");
  body.set("features[subscription_cancel][mode]", "at_period_end");
  const configuration = await stripePost("/billing_portal/configurations", body);
  const value = { configurationId: configuration.id };
  const { error } = await admin.from("platform_settings").upsert({ key: PORTAL_SETTINGS_KEY, encrypted_value: encryptSecret(JSON.stringify(value)), updated_at: new Date().toISOString() });
  if (error) throw new Error(`The billing portal was prepared but could not be saved: ${error.message}`);
  return String(configuration.id);
}

export async function createPlatformBillingPortal(organizationId: string, requestUrl?: string) {
  const admin = createSupabaseAdmin();
  const { data: account } = await admin.from("subscription_accounts").select("provider_customer_id").eq("organization_id", organizationId).maybeSingle();
  if (!account?.provider_customer_id) throw new Error("Start a paid plan before opening billing management.");
  const configurationId = await ensurePlatformBillingPortalConfiguration();
  const body = new URLSearchParams();
  body.set("customer", account.provider_customer_id);
  body.set("configuration", configurationId);
  body.set("return_url", `${appOrigin(requestUrl)}/dashboard/account`);
  const session = await stripePost("/billing_portal/sessions", body);
  if (!session.url) throw new Error("Stripe did not return a billing-management page.");
  return session.url as string;
}

function normalizedStatus(value: string) {
  if (value === "active" || value === "trialing" || value === "past_due") return value;
  if (value === "canceled" || value === "unpaid" || value === "incomplete_expired") return "canceled";
  return value === "incomplete" ? "past_due" : "active";
}

async function updateSubscriptionFromObject(subscription: any, fallbackOrganizationId?: string, fallbackPlanCode?: string) {
  const admin = createSupabaseAdmin();
  const organizationId = subscription?.metadata?.organization_id || fallbackOrganizationId;
  if (!organizationId) return;
  const planCode = subscription?.metadata?.plan_code || fallbackPlanCode || "growth";
  const status = normalizedStatus(String(subscription?.status || "active"));
  const periodEnd = subscription?.current_period_end ? new Date(Number(subscription.current_period_end) * 1000).toISOString() : null;
  const incomingSubscriptionId = String(subscription?.id || "");
  const { data: previous } = await admin.from("subscription_accounts").select("provider_subscription_id").eq("organization_id", organizationId).maybeSingle();
  const previousSubscriptionId = String(previous?.provider_subscription_id || "");

  // Stripe can deliver cancellation updates for the old plan after a successful
  // switch. Never let a stale, non-active subscription replace the current one.
  if (previousSubscriptionId && incomingSubscriptionId && previousSubscriptionId !== incomingSubscriptionId && !["active", "trialing"].includes(status)) return;

  await admin.from("subscription_accounts").upsert({
    organization_id: organizationId,
    provider: "stripe",
    provider_customer_id: String(subscription?.customer || ""),
    provider_subscription_id: incomingSubscriptionId,
    plan_code: planCode,
    status,
    current_period_end: periodEnd,
    updated_at: new Date().toISOString()
  }, { onConflict: "organization_id" });
  await admin.from("organizations").update({ subscription_status: status, updated_at: new Date().toISOString() }).eq("id", organizationId);

  if (previousSubscriptionId && incomingSubscriptionId && previousSubscriptionId !== incomingSubscriptionId && ["active", "trialing"].includes(status)) {
    try { await stripeDelete(`/subscriptions/${encodeURIComponent(previousSubscriptionId)}`); } catch { /* New plan remains active even if an old subscription needs manual review. */ }
  }
}

export async function handlePlatformStripeWebhook(rawBody: string, signature: string) {
  const admin = createSupabaseAdmin();
  const { data: stored } = await admin.from("platform_settings").select("encrypted_value").eq("key", SETTINGS_KEY).maybeSingle();
  if (!stored?.encrypted_value) throw new Error("The PrintFlow billing webhook is not configured.");
  const settings = JSON.parse(decryptSecret(stored.encrypted_value));
  if (!verifyStripeSignature(rawBody, signature, settings.webhookSecret)) throw new Error("Invalid Stripe signature.");
  const event = JSON.parse(rawBody);
  const object = event?.data?.object;

  if (event.type === "checkout.session.completed" && object?.mode === "subscription") {
    const organizationId = object.metadata?.organization_id || object.client_reference_id;
    const planCode = object.metadata?.plan_code;
    if (object.subscription) {
      const response = await fetch(`${STRIPE_API}/subscriptions/${encodeURIComponent(object.subscription)}`, { headers: { Authorization: `Bearer ${billingSecretKey()}` }, cache: "no-store" });
      const subscription = await response.json();
      if (response.ok) await updateSubscriptionFromObject(subscription, organizationId, planCode);
    }
  }

  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    await updateSubscriptionFromObject(object);
  }

  if (["invoice.paid", "invoice.payment_failed"].includes(event.type) && object?.subscription) {
    const response = await fetch(`${STRIPE_API}/subscriptions/${encodeURIComponent(object.subscription)}`, { headers: { Authorization: `Bearer ${billingSecretKey()}` }, cache: "no-store" });
    const subscription = await response.json();
    if (response.ok) await updateSubscriptionFromObject(subscription);
  }
}

export function platformBillingConfigured() {
  return Boolean(process.env.PRINTFLOW_BILLING_STRIPE_SECRET_KEY);
}
