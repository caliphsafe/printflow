import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_CONFIGURATION, slugify } from "@/lib/catalog";
import type { ShirtColor, SupplierVariant } from "@/lib/types";

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json();
  const products = Array.isArray(body.products) ? body.products : [];
  const selectedColors = new Set(Array.isArray(body.selectedColors) ? body.selectedColors.map(String) : []);
  const chosen = products.filter((row: any) => selectedColors.has(String(row.colorName)));
  if (!chosen.length) return NextResponse.json({ error: "Select at least one color." }, { status: 400 });
  const first = chosen[0];
  const colors: ShirtColor[] = Array.from(new Map(chosen.map((row: any) => [String(row.colorName), {
    id: slugify(String(row.colorName)), name: String(row.colorName), hex: /^#[0-9a-f]{6}$/i.test(String(row.colorHex)) ? String(row.colorHex) : "#777777",
    swatchImageUrl: row.swatchImageUrl || undefined, frontImageUrl: row.frontImageUrl || undefined, backImageUrl: row.backImageUrl || undefined
  }])).values()) as ShirtColor[];
  const variants: SupplierVariant[] = chosen.map((row: any) => ({ sku: String(row.sku), skuId: row.skuId ? String(row.skuId) : undefined, gtin: row.gtin ? String(row.gtin) : undefined, colorName: String(row.colorName), sizeName: String(row.sizeName), customerPrice: Number(row.customerPrice || 0), quantity: Number(row.quantity || 0) }));
  const sizes = Array.from(new Set(variants.map((row) => row.sizeName)));
  const name = `${first.brandName} ${first.styleName}`.trim();
  const baseSlug = slugify(name); let slug = baseSlug; let suffix = 2;
  while ((await supabase.from("catalog_products").select("id").eq("shop_id", shop.id).eq("slug", slug).maybeSingle()).data) slug = `${baseSlug}-${suffix++}`;
  const configuration = { ...DEFAULT_CONFIGURATION, sizes, colors, mockupImageUrl: colors[0]?.frontImageUrl, supplier: { provider: "ss-activewear" as const, styleId: String(first.styleId), brandName: String(first.brandName), styleName: String(first.styleName), partNumber: first.partNumber ? String(first.partNumber) : undefined, importedAt: new Date().toISOString(), variants } };
  const { data, error } = await supabase.from("catalog_products").insert({ organization_id: membership.organization_id, shop_id: shop.id, slug, name, description: String(first.title || "Imported from S&S Activewear"), active: true, configuration }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ product: data });
}
