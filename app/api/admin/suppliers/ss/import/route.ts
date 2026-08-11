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

function normalizeHex(value: unknown) {
  const raw = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`;
  if (/^#[0-9a-f]{3}$/i.test(raw)) return raw;
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw}`;
  return "#777777";
}

function firstMedia(
  rows: Record<string, unknown>[],
  key: "swatchImageUrl" | "frontImageUrl" | "backImageUrl"
) {
  for (const row of rows) {
    const value = String(row[key] || "").trim();
    if (value) return value;
  }
  return undefined;
}

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) {
    return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  }

  const body = await request.json();

  const products: Record<string, unknown>[] = Array.isArray(body.products)
    ? (body.products as Record<string, unknown>[])
    : [];

  const style: StyleSummary =
    body.style && typeof body.style === "object"
      ? (body.style as StyleSummary)
      : {};

  const selectedColorNames: string[] = Array.isArray(body.selectedColors)
    ? body.selectedColors.map((value: unknown) => String(value))
    : [];

  const selectedColors = new Set<string>(selectedColorNames);

  const chosen: Record<string, unknown>[] = products.filter((row) =>
    selectedColors.has(String(row.colorName))
  );

  if (!chosen.length) {
    return NextResponse.json(
      { error: "Select at least one color." },
      { status: 400 }
    );
  }

  const first = chosen[0];

  const grouped = new Map<string, Record<string, unknown>[]>();

  for (const row of chosen) {
    const name = String(row.colorName || "Unspecified");
    grouped.set(name, [...(grouped.get(name) || []), row]);
  }

  // Preserve the exact color order selected by the merchant.
  // Every imported color is built exclusively from S&S rows for that color.
  const uniqueSelectedColorNames: string[] = selectedColorNames.filter(
    (name: string, index: number, all: string[]) =>
      all.indexOf(name) === index && grouped.has(name)
  );

  const colors: ShirtColor[] = uniqueSelectedColorNames.map(
    (colorName: string): ShirtColor => {
      const rows = grouped.get(colorName) || [];

      const mediaRow =
        rows.find(
          (row: Record<string, unknown>) =>
            Boolean(row.frontImageUrl) ||
            Boolean(row.backImageUrl) ||
            Boolean(row.swatchImageUrl)
        ) || rows[0];

      return {
        id: slugify(colorName),
        name: colorName,
        hex: normalizeHex(mediaRow?.colorHex),
        swatchImageUrl: firstMedia(rows, "swatchImageUrl"),
        frontImageUrl: firstMedia(rows, "frontImageUrl"),
        backImageUrl: firstMedia(rows, "backImageUrl"),
        active: true
      };
    }
  );

  const variants: SupplierVariant[] = chosen.map(
    (raw: Record<string, unknown>): SupplierVariant => ({
      sku: String(raw.sku),
      skuId: raw.skuId ? String(raw.skuId) : undefined,
      gtin: raw.gtin ? String(raw.gtin) : undefined,
      colorName: String(raw.colorName),
      sizeName: String(raw.sizeName),
      customerPrice: Number(raw.customerPrice || 0),
      quantity: Number(raw.quantity || 0),
      active: true
    })
  );

  const sizes: string[] = Array.from(
    new Set<string>(variants.map((row: SupplierVariant) => row.sizeName))
  );

  const brandName = String(style.brandName || first.brandName || "S&S");
  const styleName = String(style.styleName || first.styleName || "Blank");
  const name = `${brandName} ${styleName}`.trim();

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 2;

  while (
    (
      await supabase
        .from("catalog_products")
        .select("id")
        .eq("shop_id", shop.id)
        .eq("slug", slug)
        .maybeSingle()
    ).data
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }

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

  const description = String(
    style.description ||
      style.title ||
      `${name} imported from S&S Activewear`
  );

  const { data, error } = await supabase
    .from("catalog_products")
    .insert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      slug,
      name,
      description,
      active: true,
      configuration
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ product: data });
}
