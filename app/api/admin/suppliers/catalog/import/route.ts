import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import {
  DEFAULT_CONFIGURATION,
  normalizeConfiguration,
  slugify
} from "@/lib/catalog";
import { defaultBrandGarmentSetup } from "@/lib/brand-commerce";
import type {
  CatalogProduct,
  ShirtColor,
  SupplierVariant
} from "@/lib/types";
import { sanmarNormalizedStyle } from "@/lib/sanmar";

function supplierFrom(value: string) {
  if (value === "ss" || value === "ss-activewear") return "ss" as const;
  if (value === "sanmar") return "sanmar" as const;
  return null;
}

function normalizeHex(value: unknown) {
  const raw = String(value || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`;
  if (/^#[0-9a-f]{3}$/i.test(raw)) return raw;
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw}`;

  return "#777777";
}

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();

  if (!membership || !shop) {
    return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  }

  const body = await request.json();
  const supplier = supplierFrom(String(body.supplier || ""));
  const targetBusiness = body.targetBusiness === "brand" ? "brand" : "print";

  if (!supplier) {
    return NextResponse.json({ error: "Choose S&S Activewear or SanMar." }, { status: 400 });
  }

  const suppliedProducts = Array.isArray(body.products)
    ? (body.products as Record<string, unknown>[])
    : [];

  const style =
    body.style && typeof body.style === "object"
      ? (body.style as Record<string, unknown>)
      : {};

  const selectedColorNames = Array.isArray(body.selectedColors)
    ? body.selectedColors.map(String).filter(Boolean)
    : [];

  if (!selectedColorNames.length) {
    return NextResponse.json(
      { error: "Select at least one color." },
      { status: 400 }
    );
  }

  const selectedSet = new Set(selectedColorNames);
  let chosen = suppliedProducts.filter((row) =>
    selectedSet.has(String(row.colorName))
  );

  // Never trust stale client variant data for SanMar. Re-fetch the exact live
  // style at import time so the imported SKUs/pricing/inventory/media belong
  // to the currently connected SanMar account.
  if (supplier === "sanmar") {
    const styleId = String(style.styleId || "").trim();

    if (!styleId) {
      return NextResponse.json(
        { error: "A SanMar style number is required." },
        { status: 400 }
      );
    }

    const { data: connection } = await supabase
      .from("supplier_connections")
      .select("encrypted_account_number,encrypted_api_key,settings,status")
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
      const liveStyle = await sanmarNormalizedStyle(
        connection as any,
        styleId
      );

      chosen = liveStyle.variants
        .filter((variant) => selectedSet.has(variant.colorName))
        .map((variant) => {
          const media = liveStyle.media[variant.colorName] || {};

          return {
            sku: variant.sku,
            skuId: variant.skuId,
            gtin: "",
            colorName: variant.colorName,
            sizeName: variant.sizeName,
            customerPrice: variant.customerPrice,
            quantity: variant.quantity,
            colorHex: "#777777",
            swatchImageUrl: media.swatchImageUrl || "",
            frontImageUrl: media.frontImageUrl || "",
            backImageUrl: media.backImageUrl || ""
          };
        });

      body.style = {
        ...style,
        styleId: liveStyle.styleId,
        brandName: liveStyle.brandName,
        styleName: liveStyle.name || liveStyle.styleId,
        title: liveStyle.name || liveStyle.styleId,
        description: liveStyle.description,
        category: style.category || "Apparel"
      };
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to refresh the SanMar style before import."
        },
        { status: 502 }
      );
    }
  }

  if (!chosen.length) {
    return NextResponse.json(
      { error: "The selected colors no longer have active supplier SKUs." },
      { status: 400 }
    );
  }

  const first = chosen[0];

  const grouped = new Map<string, Record<string, unknown>[]>();

  for (const row of chosen) {
    const color = String(row.colorName || "Unspecified");
    grouped.set(color, [...(grouped.get(color) || []), row]);
  }

  const uniqueSelectedColors = selectedColorNames.filter(
  (name: string, index: number, all: string[]) =>
    all.indexOf(name) === index && grouped.has(name)
);

  const colors: ShirtColor[] = uniqueSelectedColors.map((colorName) => {
    const rows = grouped.get(colorName) || [];
    const mediaRow =
      rows.find(
        (row) =>
          row.frontImageUrl ||
          row.backImageUrl ||
          row.swatchImageUrl
      ) || rows[0];

    return {
      id: slugify(colorName),
      name: colorName,
      hex: normalizeHex(mediaRow?.colorHex),
      swatchImageUrl: mediaRow?.swatchImageUrl
        ? String(mediaRow.swatchImageUrl)
        : undefined,
      frontImageUrl: mediaRow?.frontImageUrl
        ? String(mediaRow.frontImageUrl)
        : undefined,
      backImageUrl: mediaRow?.backImageUrl
        ? String(mediaRow.backImageUrl)
        : undefined,
      active: true
    };
  });

  const variants: SupplierVariant[] = chosen.map((raw) => ({
    sku: String(raw.sku),
    skuId: raw.skuId ? String(raw.skuId) : undefined,
    gtin: raw.gtin ? String(raw.gtin) : undefined,
    colorName: String(raw.colorName),
    sizeName: String(raw.sizeName),
    customerPrice: Number(raw.customerPrice || 0),
    quantity: Number(raw.quantity || 0),
    active: true
  }));

  const sizes = Array.from(
    new Set(variants.map((variant) => variant.sizeName))
  );

  const brandName = String(
    style.brandName ||
      first.brandName ||
      (supplier === "sanmar" ? "SanMar" : "S&S Activewear")
  );

  const styleName = String(
    style.styleName ||
      first.styleName ||
      style.styleId ||
      "Blank"
  );

  const name = `${brandName} ${styleName}`.trim();

  const productKindText =
    `${String(style.category || "")} ${String(style.title || "")} ${styleName}`.toLowerCase();

  const oneSizeAccessory =
    sizes.length === 1 &&
    /^(one size|os|osfa|adjustable)$/i.test(String(sizes[0] || ""));

  const fullSizeOnly =
    oneSizeAccessory ||
    /\b(hat|cap|headwear|beanie|visor|bucket hat|trucker)\b/.test(
      productKindText
    );

  const category = fullSizeOnly
    ? "Hats & Headwear"
    : String(style.category || "Apparel");

  const configuration = {
    ...DEFAULT_CONFIGURATION,
    ...(targetBusiness === "brand"
      ? { businessScope: "brand-source" }
      : {}),
    sizes,
    colors,
    defaultColorId: colors[0]?.id,
    mockupImageUrl: colors[0]?.frontImageUrl,
    customization: {
      ...DEFAULT_CONFIGURATION.customization,
      category,
      decorationMethods: fullSizeOnly
        ? ["Screen Print", "DTF", "Embroidery"]
        : ["Screen Print", "DTF", "Embroidery"],
      printSizes: fullSizeOnly ? ["full"] : ["heart", "full"]
    },
    supplier: {
      provider: supplier === "sanmar" ? "sanmar" : "ss-activewear",
      supplierName: supplier === "sanmar" ? "SanMar" : "S&S Activewear",
      styleId: String(style.styleId || first.styleId || ""),
      brandName,
      styleName,
      partNumber: style.partNumber
        ? String(style.partNumber)
        : undefined,
      importedAt: new Date().toISOString(),
      sourceMode: "live",
      variants
    }
  };

  const description = String(
    style.description ||
      style.title ||
      `${name} imported from ${supplier === "sanmar" ? "SanMar" : "S&S Activewear"}`
  );

  const baseSlug = slugify(
    `${name}-${supplier}${targetBusiness === "brand" ? "-brand-source" : ""}`
  );

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

  const { data, error } = await supabase
    .from("catalog_products")
    .insert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      slug,
      name,
      description,
      active: targetBusiness === "print",
      configuration
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error:
          error?.message || "Unable to import supplier garment."
      },
      { status: 400 }
    );
  }

  if (targetBusiness === "brand") {
    const product: CatalogProduct = {
      ...data,
      configuration: normalizeConfiguration(data.configuration)
    };

    const brandSetup = {
      ...defaultBrandGarmentSetup(product),
      active: true
    };

    const { data: brandGarment, error: brandError } =
      await supabase
        .from("brand_garments")
        .upsert(
          {
            organization_id: membership.organization_id,
            shop_id: shop.id,
            source_catalog_product_id: data.id,
            active: true,
            configuration: brandSetup
          },
          {
            onConflict: "shop_id,source_catalog_product_id"
          }
        )
        .select("id")
        .single();

    if (brandError) {
      await supabase
        .from("catalog_products")
        .delete()
        .eq("id", data.id);

      return NextResponse.json(
        { error: brandError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      product: data,
      brandGarmentId: brandGarment.id,
      targetBusiness: "brand",
      supplier
    });
  }

  return NextResponse.json({
    product: data,
    targetBusiness: "print",
    supplier
  });
}
