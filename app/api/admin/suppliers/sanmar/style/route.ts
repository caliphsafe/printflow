import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { sanmarStyleWithCatalog } from "@/lib/sanmar-catalog";

export async function GET(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const styleId = new URL(request.url).searchParams.get("style") || "";
  const { data: connection } = await supabase.from("supplier_connections").select("encrypted_account_number,encrypted_api_key,settings,status").eq("shop_id", shop.id).eq("provider", "sanmar").maybeSingle();
  if (!connection || connection.status !== "connected") return NextResponse.json({ error: "Connect SanMar first." }, { status: 409 });
  try {
    const merged = await sanmarStyleWithCatalog(supabase, shop.id, connection as any, styleId);
    return NextResponse.json({ style: merged });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load SanMar style." }, { status: 502 });
  }
}
