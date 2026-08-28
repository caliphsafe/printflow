import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import {
  DEFAULT_CONFIGURATION,
  normalizeConfiguration,
  slugify
} from "@/lib/catalog";
import { sanmarNormalizedStyle } from "@/lib/sanmar";

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();

  if (!shop || !membership) {
    return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  }

  const body = await request.json();
  const styleId = String(body.styleId || "").trim();
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
    const style = await sanmarNormalizedStyle(connection as any, styleId);

    const allColorNames = Array.from(
      new Set(style.variants.map((variant) => variant.colorName))
    );

    const selectedColors = requestedColors.length
      ? allColorNames.filter((name) => requestedColors.includes(name))
      : allColorNames;

    if (!selectedColors.length) {
      return NextResponse.json(
        { error: "Choose at least one SanMar color to add." },
        { status: 400 }
      );
    }

    const variants = style.variants.filter((variant) =>
      selectedColors.includes(variant.colorName)
    );

    const sizes = Array.from(
      new Set(variants.map((variant) => variant.sizeName))
    );

    const colors = selectedColors.map((name) => ({
      id: slugify(name),
      name,
      hex: "#d9dee6",
      active: true,
      ...(style.media[name] || {})
    }));

    const config = normalizeConfiguration({
      sizes,
      colors,
      defaultColorId: colors[0]?.id,
      printLocations: category === "Hats" ? ["Front"] : ["Front", "Back"],
      supplier: {
        provider: "sanmar",
        supplierName: "SanMar",
        styleId: style.styleId,
        brandName: style.brandName,
        styleName: style.name || style.styleId,
        partNumber: style.styleId,
        importedAt: new Date().toISOString(),
        sourceMode: "live",
        variants
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
          category === "Hats" ? ["front"] : ["front", "back", "front-back"],
        backEnabled: category !== "Hats"
      }
    } as any);

    const name =
      displayName || `${style.brandName} ${style.styleId}`;
    const slug = slugify(name);

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
      variantCount: variants.length,
      colorCount: colors.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to import SanMar style."
      },
      { status: 502 }
    );
  }
}
