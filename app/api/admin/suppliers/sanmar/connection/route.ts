import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { encryptSecret } from "@/lib/crypto";
import { sanmarGetProduct } from "@/lib/sanmar";

type Payload = {
  username?: string;
  password?: string;
  customerNumber?: string;
  environment?: "production" | "test";
  sftpPassword?: string;
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  catalogFilePath?: string;
  shippingAddress?: Record<string, unknown>;
  shippingMethod?: string;
  emailConfirmation?: string;
  poEnabled?: boolean;
};

function safeSettings(body: Payload, previous: Record<string, any> = {}) {
  const next: Record<string, any> = {
    ...previous,
    customerNumber: String(body.customerNumber ?? previous.customerNumber ?? ""),
    environment: body.environment === "test" ? "test" : (body.environment ? "production" : previous.environment || "production"),
    mediaEndpoint: previous.mediaEndpoint || "https://ws.sanmar.com:8080/promostandards/MediaContentServiceBinding",
    sftpHost: String(body.sftpHost ?? previous.sftpHost ?? "ftp.sanmar.com"),
    sftpPort: Number(body.sftpPort ?? previous.sftpPort ?? 2200),
    sftpUsername: String(body.sftpUsername ?? previous.sftpUsername ?? body.customerNumber ?? previous.customerNumber ?? ""),
    catalogFilePath: String(body.catalogFilePath ?? previous.catalogFilePath ?? "SanMarPDD/SanMar_EPDD.csv"),
    shippingAddress: body.shippingAddress ?? previous.shippingAddress ?? {},
    shippingMethod: String(body.shippingMethod ?? previous.shippingMethod ?? "UPS"),
    emailConfirmation: String(body.emailConfirmation ?? previous.emailConfirmation ?? ""),
    poEnabled: body.poEnabled === true || (body.poEnabled === undefined && previous.poEnabled === true)
  };
  if (body.sftpPassword) next.sftpPasswordEncrypted = encryptSecret(body.sftpPassword);
  return next;
}

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!shop || !membership) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json() as Payload;
  if (!body.username?.trim() || !body.password) return NextResponse.json({ error: "SanMar username and password are required." }, { status: 400 });

  const settings = safeSettings(body);
  const row: any = {
    encrypted_account_number: encryptSecret(body.username.trim()),
    encrypted_api_key: encryptSecret(body.password),
    settings
  };

  try {
    await sanmarGetProduct(row, "PC61");
    const now = new Date().toISOString();
    const { error } = await supabase.from("supplier_connections").upsert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      provider: "sanmar",
      status: "connected",
      account_hint: body.username.trim().replace(/^(.{2}).*(.{2})$/, "$1••••$2"),
      encrypted_account_number: row.encrypted_account_number,
      encrypted_api_key: row.encrypted_api_key,
      settings,
      last_tested_at: now,
      last_error: null,
      updated_at: now
    }, { onConflict: "shop_id,provider" });
    if (error) throw error;
    return NextResponse.json({ ok: true, status: "connected" });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "SanMar connection failed." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json() as Payload;
  const { data: existing } = await supabase.from("supplier_connections").select("settings,status").eq("shop_id", shop.id).eq("provider", "sanmar").maybeSingle();
  if (!existing || existing.status !== "connected") return NextResponse.json({ error: "Connect SanMar Web Services first." }, { status: 409 });
  const settings = safeSettings(body, existing.settings || {});
  const { error } = await supabase.from("supplier_connections").update({ settings, updated_at: new Date().toISOString() }).eq("shop_id", shop.id).eq("provider", "sanmar");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, sftpConfigured: Boolean(settings.sftpPasswordEncrypted), poEnabled: settings.poEnabled === true });
}

export async function DELETE() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const { error } = await supabase.from("supplier_connections").delete().eq("shop_id", shop.id).eq("provider", "sanmar");
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
}
