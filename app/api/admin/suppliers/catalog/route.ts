import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { sanmarBrowseCategory } from "@/lib/sanmar";
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

  const rows = await ssRequest<Record<string, unknown>[]>(connection, "/styles/?mediatype=json");

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

export async function GET(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const url = new URL(request.url);
  const supplier = supplierFrom(url.searchParams.get("supplier") || "");

  if (!supplier) {
    return NextResponse.json({ error: "Choose S&S Activewear or SanMar." }, { status: 400 });
  }

  const { data: connection } = await supabase
    .from("supplier_connections")
    .select("encrypted_account_number,encrypted_api_key,settings,status,account_hint")
    .eq("shop_id", shop.id)
    .eq("provider", supplier === "ss" ? "ss-activewear" : "sanmar")
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return NextResponse.json(
      { error: `Connect ${supplier === "ss" ? "S&S Activewear" : "SanMar"} before opening the live catalog.` },
      { status: 409 }
    );
  }

  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const brand = (url.searchParams.get("brand") || "").trim().toLowerCase();
  const category = (url.searchParams.get("category") || "").trim();
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(72, Math.max(12, Number.parseInt(url.searchParams.get("limit") || "36", 10) || 36));
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    let index: any[];

    if (supplier === "ss") {
      index = await ssIndex(String(shop.id), connection, refresh);
    } else {
      const allowed = new Set(["T-Shirts", "Polos/Knits", "Caps"]);
      const selectedCategory = allowed.has(category) ? category : "T-Shirts";
      const key = `${shop.id}:sanmar:${selectedCategory}`;
      const hit = cache.get(key);

      if (!refresh && hit && hit.expiresAt > Date.now()) {
        index = hit.styles;
      } else {
        index = await sanmarBrowseCategory(connection, selectedCategory);
        index = index.map((style: any) => ({
          ...style,
          supplier: "sanmar"
        }));
        cache.set(key, {
          styles: index,
          expiresAt: Date.now() + CACHE_MS
        });
      }
    }

    const brands = Array.from(new Set(index.map((style) => style.brandName).filter(Boolean)))
      .sort((a: string, b: string) => a.localeCompare(b));

    const categories = Array.from(new Set(index.map((style) => style.category).filter(Boolean)))
      .sort((a: string, b: string) => a.localeCompare(b));

    const filtered = index.filter((style) => {
      const haystack = `${style.brandName} ${style.styleName || ""} ${style.styleId} ${style.title} ${style.description} ${style.partNumber || ""} ${style.category || ""}`.toLowerCase();

      return (
        (!q || haystack.includes(q)) &&
        (!brand || String(style.brandName).toLowerCase() === brand) &&
        (!category || supplier === "ss" || String(style.category) === category)
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
            : `Unable to load the ${supplier === "ss" ? "S&S Activewear" : "SanMar"} catalog.`
      },
      { status: 502 }
    );
  }
}
