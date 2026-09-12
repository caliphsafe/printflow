import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import {
  listSanMarCatalogStyles,
  sanmarSftpConfigured
} from "@/lib/sanmar-catalog";

export const runtime = "nodejs";
const ALLOWED = new Set(["T-Shirts", "Polos/Knits", "Caps"]);

export async function GET(request: Request) {
  const { supabase, shop } = await getAdminContext();

  if (!shop) {
    return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  }

  const { data: connection } = await supabase
    .from("supplier_connections")
    .select(
      "encrypted_account_number,encrypted_api_key,settings,status,account_hint"
    )
    .eq("shop_id", shop.id)
    .eq("provider", "sanmar")
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return NextResponse.json(
      { error: "Connect SanMar before opening the live catalog." },
      { status: 409 }
    );
  }

  const url = new URL(request.url);
  const requestedCategory = url.searchParams.get("category") || "";
  const category = ALLOWED.has(requestedCategory)
    ? requestedCategory
    : "T-Shirts";
  const q = (url.searchParams.get("q") || "").trim();
  const brand = (url.searchParams.get("brand") || "").trim();
  const offset = Math.max(
    0,
    Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0
  );
  const limit = Math.min(
    72,
    Math.max(
      12,
      Number.parseInt(url.searchParams.get("limit") || "36", 10) || 36
    )
  );

  try {
    const { count, error: countError } = await supabase
      .from("sanmar_catalog_styles")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id);

    if (countError) throw countError;

    // Important architectural boundary:
    // this GET endpoint ONLY reads the cache. It must never launch an SFTP
    // synchronization because the catalog UI calls it automatically on page
    // load, search, category changes and refreshes. Previously that implicit
    // sync could run for 300 seconds, Vercel would terminate it, and the
    // browser then tried to JSON.parse Vercel's plain-text "An error occurred"
    // response.
    const result = await listSanMarCatalogStyles({
      supabase,
      shopId: shop.id,
      category,
      q,
      brand,
      offset,
      limit
    });

    const sftpConfigured = sanmarSftpConfigured(connection as any);
    const cachedStyleCount = Number(count || 0);

    return NextResponse.json({
      ...result,
      offset,
      limit,
      hasMore: offset + limit < result.total,
      accountHint: connection.account_hint || null,
      cachedStyleCount,
      sftpConfigured,
      needsSync: sftpConfigured && cachedStyleCount === 0,
      ...(!sftpConfigured
        ? {
            warning:
              "SanMar Web Services is connected, but the separate SFTP catalog password has not been saved yet. Add it under Suppliers before syncing the catalog."
          }
        : {}),
      ...(sftpConfigured && cachedStyleCount === 0
        ? {
            warning:
              "SanMar is connected, but the local catalog cache is empty. Go to Suppliers → SanMar and run Save + sync SanMar catalog once."
          }
        : {}),
      ...(cachedStyleCount > 0 && result.total === 0
        ? {
            warning:
              `SanMar has ${cachedStyleCount.toLocaleString()} cached styles, but none matched the current ${category} filters.`
          }
        : {})
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the SanMar catalog."
      },
      { status: 502 }
    );
  }
}
