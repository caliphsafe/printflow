import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import {
  DEFAULT_CONFIGURATION,
  normalizeConfiguration,
  slugify
} from "@/lib/catalog";
import { sanmarCompleteStyle } from "@/lib/sanmar-complete-style";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();

  if (!shop || !membership) {
    return NextResponse.json(
      { error: "No shop configured." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const styleId = String(body.styleId || "").trim().toUpperCase();
  const displayName = String(body.displayName || "").trim();

  const category = ["T-Shirts", "Polos", "Hats"].includes(
    String(body.category)
  )
    ? String(body.category)
    : "T-Shirts";

  const requestedColors = Array.isArray(body.selectedColors)
    ? body.selectedColors.map(String).filter(Boolean)
    : [];

  const { data: connection } = await supabase
    .from("supplier_connections")
    .select(
      "encrypted_account_number,encrypted_api_key,settings,status"
    )
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
    const style = await sanmarCompleteStyle(
      supabase,
      shop.id,
      connection as any,
      styleId
    );

    const allColorNames = Array.from(
      new Set<string>(
        (style.variants || [])
          .map((variant: any) =>
            String(variant.colorName || "").trim()
          )
          .filter((name: string) => name.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    const requestedSet = new Set(
      requestedColors.map((name) => name.toLowerCase())
    );

    const selectedColors = requestedColors.length
      ? allColorNames.filter((name) =>
          requestedSet.has(name.toLowerCase())
        )
      : allColorNames;

    if (!selectedColors.length) {
      return NextResponse.json(
        { error: "Choose at least one SanMar color to add." },
        { status: 400 }
      );
    }

    const selectedColorSet = new Set(
      selectedColors.map((name) => name.toLowerCase())
    );

    const variants = (style.variants || []).filter(
      (variant: any) =>
        selectedColorSet.has(
          String(variant.colorName || "").trim().toLowerCase()
        )
    );

    const sizes = Array.from(
      new Set<string>(
        variants
          .map((variant: any) =>
            String(variant.sizeName || "").trim()
          )
          .filter((name: string) => name.length > 0)
      )
    );

    const colors = selectedColors.map((name) => ({
      id: slugify(name),
      name,
      hex: "#d9dee6",
      active: true,
      ...(style.media?.[name] || {})
    }));

    const config = normalizeConfiguration({
      sizes,
      colors,
      defaultColorId: colors[0]?.id,
      mockupImageUrl: colors[0]?.frontImageUrl,
      printLocations:
        category === "Hats" ? ["Front"] : ["Front", "Back"],
      supplier: {
        provider: "sanmar",
        supplierName: "SanMar",
        styleId: style.styleId,
        brandName: style.brandName,
        styleName: style.name || style.styleId,
        partNumber: style.styleId,
        importedAt: new Date().toISOString(),
        sourceMode: "live",
        variants: variants.map((variant: any) => ({
          sku: variant.sku,
          skuId: variant.skuId,
          gtin: variant.gtin || undefined,
          colorName: variant.colorName,
          sizeName: variant.sizeName,
          customerPrice: variant.customerPrice,
          quantity: variant.quantity,
          active: true
        }))
      },
      customization: {
        ...DEFAULT_CONFIGURATION.customization,
        category,
        minimumQuantity: category === "Hats" ? 1 : 12,
        decorationMethods:
          category === "Hats"
            ? ["Embroidery"]
            : ["Screen Print", "DTF", "Embroidery"],
        printSizes: category === "Hats" ? ["full"] : ["heart", "full"],
        designModes:
          category === "Hats"
            ? ["front"]
            : ["front", "back", "front-back"],
        backEnabled: category !== "Hats"
      }
    } as any);

    // Find a previously imported copy of this SanMar style so re-importing
    // repairs the existing product instead of accidentally creating a second
    // product with a different slug.
    const { data: existingProducts } = await supabase
      .from("catalog_products")
      .select("id,slug,name,configuration")
      .eq("shop_id", shop.id)
      .limit(500);

    const existing = (existingProducts || []).find((product: any) => {
      const supplier = product?.configuration?.supplier;
      return (
        String(supplier?.provider || "").toLowerCase() === "sanmar" &&
        String(supplier?.styleId || "").trim().toUpperCase() === styleId
      );
    });

    const name =
      displayName ||
      existing?.name ||
      `${style.brandName} ${style.styleId}`;

    const slug = existing?.slug || slugify(name);

    const { data, error } = await supabase
      .from("catalog_products")
      .upsert(
        {
          organization_id: membership.organization_id,
          shop_id: shop.id,
          slug,
          name,
          description: style.description,
          active: true,
          configuration: config,
          updated_at: new Date().toISOString()
        },
        { onConflict: "shop_id,slug" }
      )
      .select("id,slug,name")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      product: data,
      repairedExistingProduct: Boolean(existing),
      variantCount: variants.length,
      colorCount: colors.length,
      availableColorCount: allColorNames.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to import SanMar style."
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
