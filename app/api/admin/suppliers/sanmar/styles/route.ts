import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import {
  sanmarBrowseCategory,
  type SanMarCatalogStyle
} from "@/lib/sanmar";

const ALLOWED_CATEGORIES = new Set(["T-Shirts", "Polos/Knits", "Caps"]);
const CACHE_MS = 15 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  styles: SanMarCatalogStyle[];
};

const cache = new Map<string, CacheEntry>();

async function categoryIndex(
  shopId: string,
  connection: any,
  category: string,
  refresh: boolean
) {
  const key = `${shopId}:${category}`;
  const hit = cache.get(key);

  if (!refresh && hit && hit.expiresAt > Date.now()) {
    return hit.styles;
  }

  const styles = await sanmarBrowseCategory(connection, category);
  cache.set(key, { styles, expiresAt: Date.now() + CACHE_MS });
  return styles;
}

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
  const requested = url.searchParams.get("category") || "T-Shirts";
  const category = ALLOWED_CATEGORIES.has(requested)
    ? requested
    : "T-Shirts";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const brand = (url.searchParams.get("brand") || "").trim().toLowerCase();
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
    const index = await categoryIndex(
      String(shop.id),
      connection,
      category,
      refresh
    );

    const brands = Array.from(
      new Set(index.map((item) => item.brandName).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const filtered = index.filter((style) => {
      const haystack = `${style.brandName} ${style.styleId} ${style.title} ${style.description}`.toLowerCase();
      return (
        (!q || haystack.includes(q)) &&
        (!brand || style.brandName.toLowerCase() === brand)
      );
    });

    return NextResponse.json({
      styles: filtered.slice(offset, offset + limit),
      total: filtered.length,
      offset,
      limit,
      hasMore: offset + limit < filtered.length,
      brands,
      category,
      accountHint: connection.account_hint || null,
      cachedUntil: new Date(Date.now() + CACHE_MS).toISOString()
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
