import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { asNumber, field, safeImageUrl, ssRequest } from "@/lib/ss-activewear";

let cache: { shopId: string; expiresAt: number; payload: any } | null = null;
const CACHE_MS = 20 * 60 * 1000;

function firstProductImage(configuration: any) {
  const colors = Array.isArray(configuration?.colors) ? configuration.colors : [];
  return colors.find((color: any) => color?.active !== false && color?.frontImageUrl)?.frontImageUrl || configuration?.mockupImageUrl || "";
}

function styleSummary(row: Record<string, unknown>) {
  return {
    styleId: String(field(row, "styleID", "styleId") || ""),
    brandName: String(field(row, "brandName") || ""),
    styleName: String(field(row, "styleName", "name") || ""),
    title: String(field(row, "title") || ""),
    category: String(field(row, "baseCategory", "baseCateogry") || "Apparel"),
    partNumber: String(field(row, "partNumber") || ""),
    imageUrl: safeImageUrl(field(row, "styleImage"), "large"),
    newStyle: field(row, "newStyle") === true
  };
}

export async function GET(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const cached = cache;
  if (!refresh && cached && cached.shopId === shop.id && cached.expiresAt > Date.now()) return NextResponse.json(cached.payload);

  const [{ data: connection }, { data: products }, { data: orders }] = await Promise.all([
    supabase.from("supplier_connections").select("encrypted_account_number,encrypted_api_key,settings,status").eq("shop_id", shop.id).eq("provider", "ss-activewear").maybeSingle(),
    supabase.from("catalog_products").select("id,name,configuration,active").eq("shop_id", shop.id).eq("active", true),
    supabase.from("designs").select("product_name,package_quantity,status,payment_status").eq("shop_id", shop.id)
  ]);

  const imported = (products || []).filter((item: any) => item.configuration?.supplier?.provider === "ss-activewear");
  const counts = new Map<string, { orders: number; pieces: number }>();
  for (const order of orders || []) {
    const key = String((order as any).product_name || "");
    if (!key) continue;
    const current = counts.get(key) || { orders: 0, pieces: 0 };
    current.orders += 1;
    current.pieces += Number((order as any).package_quantity || 0);
    counts.set(key, current);
  }
  const topItems = imported
    .map((item: any) => ({
      id: item.id,
      name: item.name,
      brandName: item.configuration?.supplier?.brandName || "S&S",
      styleName: item.configuration?.supplier?.styleName || "",
      imageUrl: firstProductImage(item.configuration),
      orders: counts.get(item.name)?.orders || 0,
      pieces: counts.get(item.name)?.pieces || 0,
      colors: (item.configuration?.colors || []).filter((color: any) => color.active !== false).length
    }))
    .sort((a: any, b: any) => b.orders - a.orders || b.pieces - a.pieces || a.name.localeCompare(b.name))
    .slice(0, 4);

  if (!connection || connection.status !== "connected") {
    const payload = { connected: false, topItems, newItems: [], saleItems: [], updatedAt: new Date().toISOString() };
    return NextResponse.json(payload);
  }

  try {
    const rawStyles = await ssRequest<Record<string, unknown>[]>(connection, "/styles/?mediatype=json");
    const styles = (Array.isArray(rawStyles) ? rawStyles : []).map(styleSummary).filter((item) => item.styleId);
    const newItems = styles.filter((item) => item.newStyle).slice(0, 6);
    const styleIds = Array.from(new Set(imported.map((item: any) => String(item.configuration?.supplier?.styleId || "")).filter(Boolean))).slice(0, 18);
    let saleItems: any[] = [];
    if (styleIds.length) {
      const path = `/products/?styleid=${encodeURIComponent(styleIds.join(","))}&fields=Sku,StyleID,BrandName,StyleName,ColorName,SizeName,CustomerPrice,SalePrice,PiecePrice,SaleExpiration,Qty,ColorFrontImage&mediatype=json`;
      const rawProducts = await ssRequest<Record<string, unknown>[]>(connection, path);
      const grouped = new Map<string, any>();
      for (const row of Array.isArray(rawProducts) ? rawProducts : []) {
        const salePrice = asNumber(field(row, "salePrice"));
        if (salePrice <= 0) continue;
        const styleId = String(field(row, "styleID", "styleId") || "");
        const expiration = String(field(row, "saleExpiration") || "");
        if (expiration && !Number.isNaN(Date.parse(expiration)) && Date.parse(expiration) < Date.now()) continue;
        const regularPrice = asNumber(field(row, "piecePrice"));
        const accountPrice = asNumber(field(row, "customerPrice"));
        const candidate = {
          styleId,
          brandName: String(field(row, "brandName") || "S&S"),
          styleName: String(field(row, "styleName") || ""),
          colorName: String(field(row, "colorName") || ""),
          sizeName: String(field(row, "sizeName") || ""),
          imageUrl: safeImageUrl(field(row, "colorFrontImage"), "large"),
          salePrice,
          regularPrice,
          accountPrice,
          inventory: asNumber(field(row, "qty")),
          saleExpiration: expiration
        };
        const previous = grouped.get(styleId);
        const saving = Math.max(0, regularPrice - salePrice);
        const previousSaving = previous ? Math.max(0, previous.regularPrice - previous.salePrice) : -1;
        if (!previous || saving > previousSaving) grouped.set(styleId, candidate);
      }
      saleItems = Array.from(grouped.values()).sort((a, b) => (b.regularPrice - b.salePrice) - (a.regularPrice - a.salePrice)).slice(0, 6);
    }
    const payload = { connected: true, topItems, newItems, saleItems, updatedAt: new Date().toISOString() };
    cache = { shopId: shop.id, expiresAt: Date.now() + CACHE_MS, payload };
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ connected: true, topItems, newItems: [], saleItems: [], warning: error instanceof Error ? error.message : "Supplier insights are temporarily unavailable.", updatedAt: new Date().toISOString() });
  }
}
