import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import {
  DEFAULT_CONFIGURATION,
  normalizeConfiguration,
  slugify
} from "@/lib/catalog";
import { sanmarCompleteStyle } from "@/lib/sanmar-complete-style";
import { withPreferredSanMarFlatMedia } from "@/lib/sanmar-flat-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { supabase, membership, shop } =
    await getAdminContext();

  if (!shop || !membership) {
    return NextResponse.json(
      { error: "No shop configured." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const styleId = String(body.styleId || "")
    .trim()
    .toUpperCase();
  const displayName = String(
    body.displayName || ""
  ).trim();

  const category = String(body.category || "Apparel").trim() || "Apparel";
  const headwear = /\b(hat|cap|headwear|beanie|visor|bucket hat|trucker|caps)\b/i.test(
    `${category} ${displayName}`
  );
  const requestedCustomization = body.customization && typeof body.customization === "object" ? body.customization : {};
  const requestedPrintAreas = requestedCustomization.printAreas && typeof requestedCustomization.printAreas === "object"
    ? requestedCustomization.printAreas
    : {};
  const availableMethods = ["Screen Print", "DTF", "Embroidery", "Heat Transfer", "Sublimation"];
  const availablePrintSizes = ["heart", "full"];
  const availablePrintLocations = ["Front", "Back", "Left Chest", "Right Chest", "Left Sleeve", "Right Sleeve", "Hat Front", "Hat Side", "Hat Back"];
  const requestedMethods = Array.isArray(requestedCustomization.decorationMethods)
    ? requestedCustomization.decorationMethods.map((value: unknown) => String(value)).filter((value: string) => availableMethods.includes(value))
    : [];
  const requestedPrintSizes = Array.isArray(requestedCustomization.printSizes)
    ? requestedCustomization.printSizes.map((value: unknown) => String(value)).filter((value: string) => availablePrintSizes.includes(value))
    : [];
  const finalCategory = String(requestedCustomization.category || category).trim().slice(0, 80) || category;
  const minimumQuantity = Math.min(100000, Math.max(1, Math.floor(Number(requestedCustomization.minimumQuantity) || (headwear ? 1 : 12))));
  const finalMethods = requestedMethods.length ? requestedMethods : (headwear ? ["Embroidery"] : ["Screen Print", "DTF", "Embroidery"]);
  const finalPrintSizes = requestedPrintSizes.length ? requestedPrintSizes : (headwear ? ["full"] : ["heart", "full"]);
  const requestedLocations = Array.isArray(requestedCustomization.printLocations)
    ? requestedCustomization.printLocations.map((value: unknown) => String(value)).filter((value: string) => availablePrintLocations.includes(value))
    : [];
  if (Array.isArray(requestedCustomization.printLocations) && requestedLocations.length === 0) {
    return NextResponse.json({ error: "Choose at least one print zone before importing this product." }, { status: 400 });
  }
  const printLocations = requestedLocations.length
    ? requestedLocations
    : (headwear ? ["Hat Front"] : ["Front", "Back"]);
  const backEnabled = printLocations.some((location: string) => ["Back", "Left Sleeve", "Right Sleeve", "Hat Side", "Hat Back"].includes(location));

  const requestedColors: string[] =
    Array.isArray(body.selectedColors)
      ? body.selectedColors
          .map((value: unknown) =>
            String(value).trim()
          )
          .filter(Boolean)
      : [];

  const { data: connection } = await supabase
    .from("supplier_connections")
    .select(
      "encrypted_account_number,encrypted_api_key,settings,status"
    )
    .eq("shop_id", shop.id)
    .eq("provider", "sanmar")
    .maybeSingle();

  if (
    !connection ||
    connection.status !== "connected"
  ) {
    return NextResponse.json(
      { error: "Connect SanMar first." },
      { status: 409 }
    );
  }

  try {
    const canonical = await sanmarCompleteStyle(
      supabase,
      shop.id,
      connection as any,
      styleId
    );

    const style =
      await withPreferredSanMarFlatMedia(
        supabase,
        shop.id,
        canonical
      );

    const allColorNames = Array.from(
      new Set<string>(
        style.variants
          .map((variant: any) =>
            String(
              variant.colorName || ""
            ).trim()
          )
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    const requestedSet = new Set(
      requestedColors.map((name) =>
        name.toLowerCase()
      )
    );

    const selectedColors =
      requestedColors.length
        ? allColorNames.filter((name) =>
            requestedSet.has(
              name.toLowerCase()
            )
          )
        : allColorNames;

    if (!selectedColors.length) {
      return NextResponse.json(
        {
          error:
            "SanMar returned no selected colors for this style. Re-open the product and choose at least one color.",
          diagnostics: style.diagnostics
        },
        { status: 400 }
      );
    }

    const selectedColorSet = new Set(
      selectedColors.map((name) =>
        name.toLowerCase()
      )
    );

    const variants = style.variants.filter(
      (variant: any) =>
        selectedColorSet.has(
          String(
            variant.colorName || ""
          )
            .trim()
            .toLowerCase()
        )
    );

    const sizes = Array.from(
      new Set<string>(
        variants
          .map((variant: any) =>
            String(
              variant.sizeName || ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

    const imageSelections = body.imageSelections && typeof body.imageSelections === "object"
      ? body.imageSelections as Record<string, { frontImageUrl?: string; backImageUrl?: string }>
      : {};
    const colors = selectedColors.map((name) => {
      const media = style.media?.[name] || {};
      const requested = imageSelections[name] || {};
      const choices = [
        ...(media.imageChoices || []),
        ...(media.frontImageUrl ? [{ url: media.frontImageUrl }] : []),
        ...(media.backImageUrl ? [{ url: media.backImageUrl }] : [])
      ];
      const selectedImage = (side: "frontImageUrl" | "backImageUrl") => {
        const candidate = String(requested[side] || "").trim();
        if (candidate && choices.some((choice: any) => choice.url === candidate)) {
          return candidate;
        }
        return media[side] || "";
      };

      return {
        id: slugify(name),
        name,
        hex: "#d9dee6",
        active: true,
        ...media,
        frontImageUrl: selectedImage("frontImageUrl"),
        backImageUrl: selectedImage("backImageUrl")
      };
    });

    const canonicalSupplierVariants =
      variants.map((variant: any) => ({
        sku: String(
          variant.uniqueKey ||
            variant.sku ||
            ""
        ),
        skuId: String(
          variant.uniqueKey ||
            variant.skuId ||
            variant.sku ||
            ""
        ),
        gtin: variant.gtin || undefined,
        colorName: variant.colorName,
        sizeName: variant.sizeName,
        customerPrice: Math.max(
          0,
          Number(
            variant.customerPrice || 0
          )
        ),
        quantity: Math.max(
          0,
          Number(variant.quantity || 0)
        ),
        active: true,
        uniqueKey: String(
          variant.uniqueKey ||
            variant.sku ||
            ""
        ),
        inventoryKey: String(
          variant.inventoryKey || ""
        ),
        sizeIndex: String(
          variant.sizeIndex || ""
        ),
        catalogColor: String(
          variant.catalogColor ||
            variant.mainframeColor ||
            variant.colorName ||
            ""
        ),
        mainframeColor: String(
          variant.mainframeColor ||
            variant.catalogColor ||
            variant.colorName ||
            ""
        )
      }));

    const config = normalizeConfiguration({
      sizes,
      colors,
      defaultColorId: colors[0]?.id,
      mockupImageUrl:
        colors[0]?.frontImageUrl,
      printLocations,
      supplier: {
        provider: "sanmar",
        supplierName: "SanMar",
        styleId: style.styleId,
        brandName: style.brandName,
        styleName:
          style.name || style.styleId,
        partNumber: style.styleId,
        importedAt:
          new Date().toISOString(),
        sourceMode: "live",
        variants:
          canonicalSupplierVariants
      },
      customization: {
        ...DEFAULT_CONFIGURATION.customization,
        category: finalCategory,
        minimumQuantity,
        decorationMethods: finalMethods,
        printSizes: finalPrintSizes,
        frontHeartArea: requestedPrintAreas.frontHeartArea,
        frontFullArea: requestedPrintAreas.frontFullArea,
        backHeartArea: requestedPrintAreas.backHeartArea,
        backFullArea: requestedPrintAreas.backFullArea,
        designModes: backEnabled ? ["front", "back", "front-back"] : ["front"],
        backEnabled
      }
    } as any) as any;

    if (config.supplier) {
      config.supplier.variants =
        canonicalSupplierVariants;
    }

    const { data: existingProducts } =
      await supabase
        .from("catalog_products")
        .select(
          "id,slug,name,configuration"
        )
        .eq("shop_id", shop.id)
        .limit(500);

    const existing = (
      existingProducts || []
    ).find((product: any) => {
      const supplier =
        product?.configuration?.supplier;

      return (
        String(
          supplier?.provider || ""
        ).toLowerCase() === "sanmar" &&
        String(
          supplier?.styleId || ""
        )
          .trim()
          .toUpperCase() === styleId
      );
    });

    const name =
      displayName ||
      existing?.name ||
      `${style.brandName} ${style.styleId}`;

    const slug =
      existing?.slug || slugify(name);

    const { data, error } = await supabase
      .from("catalog_products")
      .upsert(
        {
          organization_id:
            membership.organization_id,
          shop_id: shop.id,
          slug,
          name,
          description:
            style.description,
          active: true,
          configuration: config,
          updated_at:
            new Date().toISOString()
        },
        {
          onConflict: "shop_id,slug"
        }
      )
      .select("id,slug,name")
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      product: data,
      repairedExistingProduct:
        Boolean(existing),
      variantCount: variants.length,
      colorCount: colors.length,
      availableColorCount:
        allColorNames.length,
      diagnostics: style.diagnostics,
      flatImagePolicy: true
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
