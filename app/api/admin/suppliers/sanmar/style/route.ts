import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { sanmarCompleteStyle } from "@/lib/sanmar-complete-style";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, shop } = await getAdminContext();

  if (!shop) {
    return NextResponse.json(
      { error: "No shop configured." },
      { status: 403 }
    );
  }

  const styleId =
    new URL(request.url).searchParams.get("style") || "";

  const { data: connection } = await supabase
    .from("supplier_connections")
    .select(
      "encrypted_account_number,encrypted_api_key,settings,status"
    )
    .eq("shop_id", shop.id)
    .eq("provider", "sanmar")
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return NextResponse.json(
      { error: "Connect SanMar first." },
      { status: 409 }
    );
  }

  try {
    const style = await sanmarCompleteStyle(
      supabase,
      shop.id,
      connection as any,
      styleId
    );

    const colorCount = new Set(
      (style.variants || [])
        .map((variant: any) => String(variant.colorName || "").trim())
        .filter(Boolean)
    ).size;

    return NextResponse.json(
      {
        style,
        colorCount,
        variantCount: style.variants?.length || 0
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load SanMar style."
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
