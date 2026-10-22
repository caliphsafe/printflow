import { NextResponse } from "next/server";
import { DEFAULT_CONFIGURATION, normalizeConfiguration, normalizeDecorationMethods, slugify } from "@/lib/catalog";
import { loadSSStyle } from "@/lib/ss-catalog";
import { decodeHtmlEntities } from "@/lib/html-entities";
import type { getAdminContext } from "@/lib/admin-data";

type ImportContext = Awaited<ReturnType<typeof getAdminContext>>;
const FRONT_LOCATIONS = ["Front", "Left Chest", "Right Chest", "Hat Front"];
const BACK_LOCATIONS = ["Back", "Left Sleeve", "Right Sleeve", "Hat Side", "Hat Back"];

export async function importSSPrintProduct(body: any, { supabase, shop, membership }: ImportContext) {
  if (!shop || !membership) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const styleId = String(body.styleId || body.style?.styleId || "").trim();
  const requested = body.customization || {};
  const selectedColors: string[] = Array.isArray(body.selectedColors) ? [...new Set<string>(body.selectedColors.map(String))] : [];
  const methods = Array.isArray(requested.decorationMethods) ? normalizeDecorationMethods(requested.decorationMethods) : [];
  const printSizes: string[] = Array.isArray(requested.printSizes) ? requested.printSizes.filter((size: string) => ["heart", "full"].includes(size)) : [];
  const printLocations: string[] = Array.isArray(requested.printLocations) ? [...new Set<string>(requested.printLocations.filter((location: string) => [...FRONT_LOCATIONS, ...BACK_LOCATIONS].includes(location)))] : [];
  if (!styleId || !selectedColors.length || !methods.length || !printSizes.length || !printLocations.length) {
    return NextResponse.json({ error: "Choose a style, colors, decoration methods, print sizes and print zones before importing." }, { status: 400 });
  }
  const { data: connection } = await supabase.from("supplier_connections")
    .select("encrypted_account_number,encrypted_api_key,settings,status")
    .eq("shop_id", shop.id).eq("provider", "ss-activewear").maybeSingle();
  if (connection?.status !== "connected") return NextResponse.json({ error: "Connect S&S Activewear first." }, { status: 409 });

  try {
    // Re-fetch on the server: submitted SKU prices/inventory are not authoritative.
    const { style } = await loadSSStyle(connection, styleId);
    const colors = selectedColors.map((colorName) => {
      const media = style.media[colorName];
      if (!media) throw new Error(`S&S did not return the selected color: ${colorName}.`);
      const selection = body.imageSelections?.[colorName] || {};
      const selectImage = (side: "frontImageUrl" | "backImageUrl") => {
        const url = String(selection[side] || "");
        if (url && !media.imageChoices.some((choice) => choice.url === url)) throw new Error(`The selected image for ${colorName} is no longer available. Reload the style.`);
        return url || media[side];
      };
      const frontImageUrl = selectImage("frontImageUrl");
      if (!frontImageUrl) throw new Error(`${colorName} needs a product image before import.`);
      const hex = String(style.variants.find((row) => row.colorName === colorName)?.colorHex || "").replace(/^#/, "");
      return { id: slugify(colorName), name: colorName, hex: /^[a-f0-9]{3}([a-f0-9]{3})?$/i.test(hex) ? `#${hex}` : "#777777", active: true,
        frontImageUrl, backImageUrl: selectImage("backImageUrl"), swatchImageUrl: media.swatchImageUrl, imageChoices: media.imageChoices };
    });
    const frontEnabled = printLocations.some((location) => FRONT_LOCATIONS.includes(location));
    const backEnabled = printLocations.some((location) => BACK_LOCATIONS.includes(location));
    if (backEnabled && colors.some((color) => !color.backImageUrl)) {
      return NextResponse.json({ error: "Every selected color needs a back image for back/side print zones. Choose front-only zones or deselect colors without back images." }, { status: 400 });
    }
    const variants = style.variants.filter((row) => selectedColors.includes(row.colorName)).map(({ sku, skuId, gtin, colorName, sizeName, customerPrice, quantity, active }) => ({ sku, skuId, gtin, colorName, sizeName, customerPrice, quantity, active }));
    const { data: existingRows, error: lookupError } = await supabase.from("catalog_products")
      .select("id,slug,name,description,active,configuration").eq("shop_id", shop.id)
      .contains("configuration", { supplier: { provider: "ss-activewear", styleId } }).order("created_at", { ascending: true });
    if (lookupError) throw new Error(lookupError.message);
    // Match only this shop's print catalog; brand sourcing is a separate workflow.
    const existing = (existingRows || []).find((row: any) => row.configuration?.businessScope !== "brand-source" && row.configuration?.supplier?.sourceMode !== "demo");
    const previous = existing?.configuration || {};
    const mergedColors = new Map<string, any>((previous.colors || []).map((color: any) => [color.name, color]));
    for (const color of colors) {
      const old = mergedColors.get(color.name);
      mergedColors.set(color.name, { ...old, ...color, id: old?.id || color.id, active: old?.active !== false });
    }
    const mergedVariants = new Map<string, any>((previous.supplier?.variants || []).map((variant: any) => [variant.sku, variant]));
    for (const variant of variants) mergedVariants.set(variant.sku, variant);
    const allColors = [...mergedColors.values()];
    const allVariants = [...mergedVariants.values()];
    const areas = requested.printAreas || {};
    const configuration = normalizeConfiguration({
      ...previous,
      colors: allColors,
      sizes: [...new Set(allVariants.map((variant) => variant.sizeName))],
      defaultColorId: previous.defaultColorId || colors[0].id,
      mockupImageUrl: allColors.find((color) => color.id === previous.defaultColorId)?.frontImageUrl || colors[0].frontImageUrl,
      printLocations,
      supplier: { ...previous.supplier, provider: "ss-activewear", supplierName: "S&S Activewear", styleId,
        brandName: style.brandName, styleName: style.styleName, partNumber: style.partNumber,
        importedAt: new Date().toISOString(), sourceMode: "live", variants: allVariants },
      customization: {
        ...DEFAULT_CONFIGURATION.customization, ...previous.customization,
        category: String(requested.category || body.category || style.category).slice(0, 80),
        minimumQuantity: Math.min(100000, Math.max(1, Math.floor(Number(requested.minimumQuantity) || 12))),
        decorationMethods: methods, printSizes, frontEnabled, backEnabled,
        designModes: frontEnabled && backEnabled ? ["front", "back", "front-back"] : [frontEnabled ? "front" : "back"],
        frontHeartArea: areas.frontHeartArea || previous.customization?.frontHeartArea,
        frontFullArea: areas.frontFullArea || previous.customization?.frontFullArea,
        backHeartArea: areas.backHeartArea || previous.customization?.backHeartArea,
        backFullArea: areas.backFullArea || previous.customization?.backFullArea
      }
    });
    const name = decodeHtmlEntities(body.displayName || existing?.name || style.name).trim();
    const record = { name, description: style.description || existing?.description || "", configuration };
    const query = existing
      ? supabase.from("catalog_products").update(record).eq("shop_id", shop.id).eq("id", existing.id)
      : supabase.from("catalog_products").insert({ ...record, organization_id: membership.organization_id, shop_id: shop.id,
          slug: `${slugify(name)}-ss-${styleId}`, active: true });
    const { data, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ product: data, repairedExistingProduct: Boolean(existing), targetBusiness: "print" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import the S&S style." }, { status: 400 });
  }
}
