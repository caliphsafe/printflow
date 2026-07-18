import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { field, safeImageUrl, ssRequest } from "@/lib/ss-activewear";

type NormalizedStyle = {
  styleId: string;
  brandName: string;
  styleName: string;
  title: string;
  description: string;
  partNumber: string;
  category: string;
  imageUrl: string;
};

type CacheEntry = { expiresAt: number; styles: NormalizedStyle[] };
const styleCache = new Map<string, CacheEntry>();
const CACHE_MS = 15 * 60 * 1000;

function normalizeStyle(row: Record<string, unknown>): NormalizedStyle {
  return {
    styleId: String(field(row, "styleID", "styleId") || ""),
    brandName: String(field(row, "brandName") || "").trim(),
    styleName: String(field(row, "styleName", "name") || "").trim(),
    title: String(field(row, "title") || "").trim(),
    description: String(field(row, "description") || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    partNumber: String(field(row, "partNumber") || "").trim(),
    category: String(field(row, "baseCategory", "baseCateogry") || "Apparel").trim(),
    imageUrl: safeImageUrl(field(row, "styleImage"), "large")
  };
}

async function loadStyleIndex(
  shopId: string,
  connection: { encrypted_account_number: string; encrypted_api_key: string; settings?: Record<string, unknown> | null },
  refresh: boolean
) {
  const cached = styleCache.get(shopId);
  if (!refresh && cached && cached.expiresAt > Date.now()) return cached.styles;

  const rows = await ssRequest<Record<string, unknown>[]>(connection, "/styles/?mediatype=json");
  const styles = (Array.isArray(rows) ? rows : [])
    .map(normalizeStyle)
    .filter((style) => style.styleId && style.brandName && style.styleName)
    .sort((a, b) => `${a.brandName} ${a.styleName}`.localeCompare(`${b.brandName} ${b.styleName}`));

  styleCache.set(shopId, { expiresAt: Date.now() + CACHE_MS, styles });
  return styles;
}

export async function GET(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const { data: connection } = await supabase
    .from("supplier_connections")
    .select("encrypted_account_number,encrypted_api_key,settings,status")
    .eq("shop_id", shop.id)
    .eq("provider", "ss-activewear")
    .maybeSingle();
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "Connect S&S Activewear before opening the live catalog." }, { status: 409 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const brand = (url.searchParams.get("brand") || "").trim().toLowerCase();
  const category = (url.searchParams.get("category") || "").trim().toLowerCase();
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);
  const limit = Math.min(72, Math.max(12, Number.parseInt(url.searchParams.get("limit") || "36", 10) || 36));
  const refresh = url.searchParams.get("refresh") === "1";

  try {
    const index = await loadStyleIndex(String(shop.id), connection, refresh);
    const brands = Array.from(new Set(index.map((style) => style.brandName))).sort((a, b) => a.localeCompare(b));
    const categories = Array.from(new Set(index.map((style) => style.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const filtered = index.filter((style) => {
      const haystack = `${style.brandName} ${style.styleName} ${style.title} ${style.partNumber} ${style.category}`.toLowerCase();
      return (!q || haystack.includes(q)) && (!brand || style.brandName.toLowerCase() === brand) && (!category || style.category.toLowerCase() === category);
    });
    return NextResponse.json({
      styles: filtered.slice(offset, offset + limit),
      total: filtered.length,
      offset,
      limit,
      hasMore: offset + limit < filtered.length,
      brands,
      categories,
      cachedUntil: new Date(Date.now() + CACHE_MS).toISOString()
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the S&S catalog." }, { status: 502 });
  }
}
