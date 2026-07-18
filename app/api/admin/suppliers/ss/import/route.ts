import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_CONFIGURATION, slugify } from "@/lib/catalog";
import type { ShirtColor, SupplierVariant } from "@/lib/types";

type StyleSummary = {
  styleId?: string;
  brandName?: string;
  styleName?: string;
  title?: string;
  description?: string;
  partNumber?: string;
  category?: string;
};

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json();
  const products = Array.isArray(body.products) ? body.products : [];
  const style: StyleSummary = body.style && typeof body.style === "object" ? body.style : {};
  const selectedColors = new Set(Array.isArray(body.selectedColors) ? body.selectedColors.map(String) : []);
  const chosen = products.filter((row: Record<string, unknown>) => selectedColors.has(String(row.colorName)));
  if (!chosen.length) return NextResponse.json({ error: "Select at least one color." }, { status: 400 });
  const first = chosen[0] as Record<string, unknown>;
  const colors: ShirtColor[] = Array.from(new Map(chosen.map((raw: Record<string, unknown>) => {
    const colorName = String(raw.colorName || "Unspecified");
    return [colorName, {
      id: slugify(colorName),
      name: colorName,
      hex: /^#[0-9a-f]{6}$/i.test(String(raw.colorHex)) ? String(raw.colorHex) : "#777777",
      swatchImageUrl: raw.swatchImageUrl ? String(raw.swatchImageUrl) : undefined,
      frontImageUrl: raw.frontImageUrl ? String(raw.frontImageUrl) : undefined,
      backImageUrl: raw.backImageUrl ? String(raw.backImageUrl) : undefined,
      active: true
    }];
  })).values()) as ShirtColor[];
  const variants: SupplierVariant[] = chosen.map((raw: Record<string, unknown>) => ({
    sku: String(raw.sku),
    skuId: raw.skuId ? String(raw.skuId) : undefined,
    gtin: raw.gtin ? String(raw.gtin) : undefined,
    colorName: String(raw.colorName),
    sizeName: String(raw.sizeName),
    customerPrice: Number(raw.customerPrice || 0),
    quantity: Number(raw.quantity || 0),
    active: true
  }));
  const sizes = Array.from(new Set(variants.map((row) => row.sizeName)));
  const brandName = String(style.brandName || first.brandName || "S&S");
  const styleName = String(style.styleName || first.styleName || "Blank");
  const name = `${brandName} ${styleName}`.trim();
  const baseSlug = slugify(name); let slug = baseSlug; let suffix = 2;
  while ((await supabase.from("catalog_products").select("id").eq("shop_id", shop.id).eq("slug", slug).maybeSingle()).data) slug = `${baseSlug}-${suffix++}`;
  const configuration = {
    ...DEFAULT_CONFIGURATION,
    sizes,
    colors,
    mockupImageUrl: colors[0]?.frontImageUrl,
    customization: {
      ...DEFAULT_CONFIGURATION.customization,
      category: String(style.category || "Apparel"),
      decorationMethods: ["Screen Print", "DTF", "Embroidery"]
    },
    supplier: {
      provider: "ss-activewear" as const,
      supplierName: "S&S Activewear",
      styleId: String(style.styleId || first.styleId || ""),
      brandName,
      styleName,
      partNumber: style.partNumber ? String(style.partNumber) : undefined,
      importedAt: new Date().toISOString(),
      sourceMode: "live" as const,
      variants
    }
  };
  const description = String(style.description || style.title || `${name} imported from S&S Activewear`);
  const { data, error } = await supabase.from("catalog_products").insert({
    organization_id: membership.organization_id,
    shop_id: shop.id,
    slug,
    name,
    description,
    active: true,
    configuration
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ product: data });
}
