import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { encryptSecret } from "@/lib/crypto";

function auth(accountNumber: string, apiKey: string) { return `Basic ${Buffer.from(`${accountNumber}:${apiKey}`).toString("base64")}`; }

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json();
  const accountNumber = String(body.accountNumber || "").trim();
  const apiKey = String(body.apiKey || "").trim();
  if (!accountNumber || !apiKey) return NextResponse.json({ error: "Account number and API key are required." }, { status: 400 });
  try {
    const test = await fetch("https://api.ssactivewear.com/v2/categories/?mediatype=json", { cache: "no-store", headers: { Authorization: auth(accountNumber, apiKey), Accept: "application/json" } });
    if (!test.ok) return NextResponse.json({ error: "S&S rejected these credentials. Confirm the account number and API key." }, { status: 400 });
    const settings = {
      testMode: body.testMode !== false,
      shippingMethod: String(body.shippingMethod || "1"),
      autoselectWarehouse: body.autoselectWarehouse !== false,
      shippingAddress: body.shippingAddress || {},
      emailConfirmation: String(body.emailConfirmation || ""),
      paymentProfile: body.paymentProfile || null
    };
    const { error } = await supabase.from("supplier_connections").upsert({
      organization_id: membership.organization_id, shop_id: shop.id, provider: "ss-activewear", status: "connected",
      encrypted_account_number: encryptSecret(accountNumber), encrypted_api_key: encryptSecret(apiKey), account_hint: accountNumber.slice(-4).padStart(accountNumber.length, "•"), settings,
      last_tested_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString()
    }, { onConflict: "shop_id,provider" });
    if (error) throw error;
    return NextResponse.json({ ok: true, accountHint: accountNumber.slice(-4) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to connect S&S." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json();
  const { data: current } = await supabase.from("supplier_connections").select("settings").eq("shop_id", shop.id).eq("provider", "ss-activewear").single();
  const settings = { ...(current?.settings || {}), ...body };
  const { error } = await supabase.from("supplier_connections").update({ settings, updated_at: new Date().toISOString() }).eq("shop_id", shop.id).eq("provider", "ss-activewear");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, settings });
}

export async function DELETE() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const { error } = await supabase.from("supplier_connections").delete().eq("shop_id", shop.id).eq("provider", "ss-activewear");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
