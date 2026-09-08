import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { listSanMarCatalogStyles, sanmarSftpConfigured, syncSanMarCatalog } from "@/lib/sanmar-catalog";

export const runtime = "nodejs";
export const maxDuration = 300;
const ALLOWED = new Set(["T-Shirts", "Polos/Knits", "Caps"]);

export async function GET(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const { data: connection } = await supabase.from("supplier_connections").select("encrypted_account_number,encrypted_api_key,settings,status,account_hint").eq("shop_id", shop.id).eq("provider", "sanmar").maybeSingle();
  if (!connection || connection.status !== "connected") return NextResponse.json({ error: "Connect SanMar before opening the live catalog." }, { status: 409 });

  const url = new URL(request.url);
  const category = ALLOWED.has(url.searchParams.get("category") || "") ? String(url.searchParams.get("category")) : "T-Shirts";
  const q = (url.searchParams.get("q") || "").trim();
  const brand = (url.searchParams.get("brand") || "").trim();
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(72, Math.max(12, Number.parseInt(url.searchParams.get("limit") || "36", 10) || 36));
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    const { count } = await supabase.from("sanmar_catalog_styles").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
    if ((refresh || !count) && sanmarSftpConfigured(connection as any)) {
      await syncSanMarCatalog({ supabase, organizationId: membership.organization_id, shopId: shop.id, connection: connection as any });
    }
    const result = await listSanMarCatalogStyles({ supabase, shopId: shop.id, category, q, brand, offset, limit });
    if (!result.total && !sanmarSftpConfigured(connection as any)) {
      return NextResponse.json({ ...result, offset, limit, hasMore: false, accountHint: connection.account_hint || null, warning: "SanMar Web Services is connected, but the separate SFTP catalog password has not been saved yet. Add the FTP password in Suppliers to browse the full catalog." });
    }
    return NextResponse.json({ ...result, offset, limit, hasMore: offset + limit < result.total, accountHint: connection.account_hint || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the SanMar catalog." }, { status: 502 });
  }
}
