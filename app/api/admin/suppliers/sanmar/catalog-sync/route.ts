import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { syncSanMarCatalogFast } from "@/lib/sanmar-catalog-fast";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const { data: connection } = await supabase
    .from("supplier_connections")
    .select("encrypted_account_number,encrypted_api_key,settings,status")
    .eq("shop_id", shop.id)
    .eq("provider", "sanmar")
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "Connect SanMar first." }, { status: 409 });
  }

  try {
    const result = await syncSanMarCatalogFast({
      supabase,
      organizationId: membership.organization_id,
      shopId: shop.id,
      connection: connection as any
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("SanMar catalog sync failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync the SanMar catalog." },
      { status: 502 }
    );
  }
}
