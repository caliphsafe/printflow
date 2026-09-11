import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { listSanMarCatalogStyles, sanmarSftpConfigured } from "@/lib/sanmar-catalog";
import { syncSanMarCatalogFast } from "@/lib/sanmar-catalog-fast";
import { field, safeImageUrl, ssRequest } from "@/lib/ss-activewear";

type SupplierKey = "ss" | "sanmar";
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; styles: any[] }>();

function supplierFrom(value: string): SupplierKey | null {
  if (value === "ss" || value === "ss-activewear") return "ss";
  if (value === "sanmar") return "sanmar";
  return null;
}

function normalizeSS(row: Record<string, unknown>) {
  return {
    styleId: String(field(row, "styleID", "styleId") || ""),
    brandName: String(field(row, "brandName") || "").trim(),
    styleName: String(field(row, "styleName", "name") || "").trim(),
    title: String(field(row, "title") || "").trim(),
    description: String(field(row, "description") || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    partNumber: String(field(row, "partNumber") || "").trim(),
    category: String(field(row, "baseCategory", "baseCateogry") || "Apparel").trim(),
    imageUrl: safeImageUrl(field(row, "styleImage"), "large"),
    supplier: "ss"
  };
}

async function ssIndex(shopId: string, connection: any, refresh: boolean) {
  const key = `${shopId}:ss`;
  const hit = cache.get(key);
  if (!refresh && hit && hit.expiresAt > Date.now()) return hit.styles;

  const rows = await ssRequest<Record<string, unknown>[]>(
    connection,
    "/styles/?mediatype=json"
  );

  const styles = (Array.isArray(rows) ? rows : [])
    .map(normalizeSS)
    .filter((style) => style.styleId && style.brandName && style.styleName)
    .sort((a, b) =>
      `${a.brandName} ${a.styleName}`.localeCompare(
        `${b.brandName} ${b.styleName}`
      )
    );

  cache.set(key, { styles, expiresAt: Date.now() + CACHE_MS });
  return styles;
}

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();

  if (!shop || !membership) {
    return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  }

  const url = new URL(request.url);
  const supplier = supplierFrom(url.searchParams.get("supplier") || "");

  if (!supplier) {
    return NextResponse.json(
      { error: "Choose S&S Activewear or SanMar." },
      { status: 400 }
    );
  }

  const { data: connection } = await supabase
    .from("supplier_connections")
    .select(
      "encrypted_account_number,encrypted_api_key,settings,status,account_hint"
    )
    .eq("shop_id", shop.id)
    .eq("provider", supplier === "ss" ? "ss-activewear" : "sanmar")
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return NextResponse.json(
      {
        error: `Connect ${
          supplier === "ss" ? "S&S Activewear" : "SanMar"
        } before opening the live catalog.`
      },
      { status: 409 }
    );
  }

  const q = (url.searchParams.get("q") || "").trim();
  const brand = (url.searchParams.get("brand") || "").trim();
  const category = (url.searchParams.get("category") || "").trim();
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
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    if (supplier === "sanmar") {
      const selectedCategory = new Set([
        "T-Shirts",
        "Polos/Knits",
        "Caps"
      ]).has(category)
        ? category
        : "T-Shirts";

      let { count } = await supabase
        .from("sanmar_catalog_styles")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id);

      let syncResult: any = null;

      // IMPORTANT:
      // The catalog page used to call the original slow full-file sync here.
      // That path can exceed Vercel's 300 second limit. Use the new streaming
      // fast sync instead so the browser and the Suppliers screen share the
      // same catalog population path.
      if ((refresh || !count) && sanmarSftpConfigured(connection as any)) {
        syncResult = await syncSanMarCatalogFast({
          supabase,
          organizationId: membership.organization_id,
          shopId: shop.id,
          connection: connection as any
        });

        const recounted = await supabase
          .from("sanmar_catalog_styles")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.id);

        count = recounted.count;
      }

      const result = await listSanMarCatalogStyles({
        supabase,
        shopId: shop.id,
        category: selectedCategory,
        q,
        brand,
        offset,
        limit
      });

      const hasSftp = sanmarSftpConfigured(connection as any);

      return NextResponse.json({
        ...result,
        offset,
        limit,
        hasMore: offset + limit < result.total,
        accountHint: connection.account_hint || null,
        supplier,
        browseMode: "ftp-catalog",
        catalogRowCount: Number(count || 0),
        ...(syncResult
          ? {
              sync: {
                styleCount: Number(syncResult.styleCount || 0),
                sourceFile: syncResult.sourceFile || null,
                sourceBytes: Number(syncResult.sourceBytes || 0),
                timings: syncResult.timings || null
              }
            }
          : {}),
        ...(!result.total && !hasSftp
          ? {
              warning:
                "SanMar Web Services is connected, but the separate SFTP catalog password has not been saved. Add it under Suppliers to browse the full SanMar catalog."
            }
          : {}),
        ...(!result.total && hasSftp && Number(count || 0) === 0
          ? {
              warning:
                "SanMar SFTP is connected, but no catalog styles are cached yet. Run Save + sync SanMar catalog under Suppliers."
            }
          : {}),
        ...(!result.total && Number(count || 0) > 0
          ? {
              warning:
                `SanMar has ${Number(count || 0).toLocaleString()} cached styles, but none matched the ${selectedCategory} filter. Try another category or search by style number.`
            }
          : {})
      });
    }

    const index = await ssIndex(String(shop.id), connection, refresh);
    const brands = Array.from(
      new Set(index.map((style) => style.brandName).filter(Boolean))
    ).sort((a: string, b: string) => a.localeCompare(b));

    const categories = Array.from(
      new Set(index.map((style) => style.category).filter(Boolean))
    ).sort((a: string, b: string) => a.localeCompare(b));

    const qLower = q.toLowerCase();
    const brandLower = brand.toLowerCase();

    const filtered = index.filter((style) => {
      const haystack =
        `${style.brandName} ${style.styleName || ""} ${style.styleId} ${
          style.title
        } ${style.description} ${style.partNumber || ""} ${
          style.category || ""
        }`.toLowerCase();

      return (
        (!qLower || haystack.includes(qLower)) &&
        (!brandLower ||
          String(style.brandName).toLowerCase() === brandLower) &&
        (!category || String(style.category) === category)
      );
    });

    return NextResponse.json({
      styles: filtered.slice(offset, offset + limit),
      total: filtered.length,
      offset,
      limit,
      hasMore: offset + limit < filtered.length,
      brands,
      categories,
      accountHint: connection.account_hint || null,
      supplier
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : `Unable to load the ${
                supplier === "ss" ? "S&S Activewear" : "SanMar"
              } catalog.`
      },
      { status: 502 }
    );
  }
}
