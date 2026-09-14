import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { syncSanMarCatalogChunk } from "@/lib/sanmar-catalog-chunked";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Body = {
  cursor?: number;
  syncStartedAt?: string;
  remotePath?: string;
};

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();

  if (!membership || !shop) {
    return NextResponse.json(
      { ok: false, error: "No shop configured." },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  const { data: connection, error: connectionError } = await supabase
    .from("supplier_connections")
    .select("encrypted_account_number,encrypted_api_key,settings,status")
    .eq("shop_id", shop.id)
    .eq("provider", "sanmar")
    .maybeSingle();

  if (connectionError) {
    return NextResponse.json(
      { ok: false, error: connectionError.message },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  if (!connection || connection.status !== "connected") {
    return NextResponse.json(
      { ok: false, error: "Connect SanMar first." },
      {
        status: 409,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  try {
    const result = await syncSanMarCatalogChunk({
      supabase,
      organizationId: membership.organization_id,
      shopId: shop.id,
      connection: connection as any,
      cursor: Number(body.cursor || 0),
      syncStartedAt: body.syncStartedAt
    });

    return NextResponse.json(
      {
        ok: true,
        shopId: shop.id,
        ...result
      },
      {
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    console.error("SanMar catalog chunk sync failed", error);

    return NextResponse.json(
      {
        ok: false,
        shopId: shop.id,
        error:
          error instanceof Error
            ? error.message
            : "Unable to sync the SanMar catalog."
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
