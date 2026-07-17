import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { encryptSecret } from "@/lib/crypto";

type Payload = { provider: string; category: string; accountLabel?: string; credentials: Record<string,string>; configuration?: Record<string,unknown> };
async function testConnection(provider: string, c: Record<string,string>) {
  try {
    if (provider === "stripe") { const r = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${c.secretKey}` }, cache: "no-store" }); const d = await r.json(); return r.ok ? { ok: true, label: d.business_profile?.name || d.email || d.id } : { ok: false, error: d.error?.message || "Stripe rejected these credentials." }; }
    if (provider === "square") { const base = c.environment === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com"; const r = await fetch(`${base}/v2/locations`, { headers: { Authorization: `Bearer ${c.accessToken}`, "Square-Version": "2026-05-20", "Content-Type": "application/json" }, cache: "no-store" }); const d = await r.json(); return r.ok ? { ok: true, label: d.locations?.[0]?.name || "Square account" } : { ok: false, error: d.errors?.[0]?.detail || "Square rejected these credentials." }; }
    if (provider === "shopify") { const domain = c.shopDomain?.replace(/^https?:\/\//, "").replace(/\/$/, ""); const r = await fetch(`https://${domain}/admin/api/2026-07/shop.json`, { headers: { "X-Shopify-Access-Token": c.accessToken, "Content-Type": "application/json" }, cache: "no-store" }); const d = await r.json(); return r.ok ? { ok: true, label: d.shop?.name || domain } : { ok: false, error: d.errors || "Shopify rejected these credentials." }; }
    if (provider === "squarespace") { const r = await fetch("https://api.squarespace.com/1.0/profiles?limit=1", { headers: { Authorization: `Bearer ${c.apiKey}`, "User-Agent": "PrintFlow custom-print-platform" }, cache: "no-store" }); return r.ok ? { ok: true, label: "Squarespace site" } : { ok: false, error: `Squarespace returned ${r.status}. Check API permissions.` }; }
    if (provider === "google-drive") { JSON.parse(c.serviceAccountJson || "{}"); return { ok: true, label: c.folderId ? "Google Drive folder configured" : "Google service account configured" }; }
    if (provider === "sanmar") return { ok: true, label: "Credentials saved — live connector pending provider approval" };
    return { ok: true, label: "Credentials securely configured" };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Connection test failed." }; }
}

export async function GET() {
  const { supabase, shop } = await getAdminContext(); if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const { data, error } = await supabase.from("integration_connections").select("provider,category,status,account_label,configuration,last_tested_at,last_error").eq("shop_id", shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ connections: data || [] });
}

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext(); if (!shop || !membership) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json() as Payload; if (!body.provider || !body.category || !body.credentials || !Object.values(body.credentials).some(Boolean)) return NextResponse.json({ error: "Enter the required credentials." }, { status: 400 });
  const test = await testConnection(body.provider, body.credentials); const now = new Date().toISOString();
  const { error } = await supabase.from("integration_connections").upsert({ organization_id: membership.organization_id, shop_id: shop.id, provider: body.provider, category: body.category, status: test.ok ? "connected" : "error", account_label: test.label || body.accountLabel || null, encrypted_credentials: encryptSecret(JSON.stringify(body.credentials)), configuration: body.configuration || {}, last_tested_at: now, last_error: test.ok ? null : test.error, updated_at: now }, { onConflict: "shop_id,provider" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ ok: test.ok, status: test.ok ? "connected" : "error", accountLabel: test.label, error: test.error });
}

export async function DELETE(request: Request) {
  const { supabase, shop } = await getAdminContext(); if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 }); const provider = new URL(request.url).searchParams.get("provider");
  if (!provider) return NextResponse.json({ error: "Provider is required." }, { status: 400 }); const { error } = await supabase.from("integration_connections").delete().eq("shop_id", shop.id).eq("provider", provider); if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ ok: true });
}
