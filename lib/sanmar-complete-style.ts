import { getSanMarCachedStyle } from "@/lib/sanmar-catalog";
import {
  fetchSanMarInventory,
  fetchSanMarMedia,
  fetchSanMarPricing,
  fetchSanMarPromoProductData,
  fetchSanMarStandardProductInfo,
  sanmarNormalize,
  type SanMarCanonicalVariant,
  type SanMarConnection,
  type SanMarMediaMap,
  type SanMarStyleSource
} from "@/lib/sanmar-canonical";

type CachedVariant = {
  uniqueKey?: string;
  inventoryKey?: string;
  sizeIndex?: string;
  mainframeColor?: string;
  catalogColor?: string;
  colorName?: string;
  sizeName?: string;
  quantity?: number;
  piecePrice?: number;
  gtin?: string;
  swatchImageUrl?: string;
  colorProductImageUrl?: string;
  frontModelUrl?: string;
  backModelUrl?: string;
  frontFlatUrl?: string;
  backFlatUrl?: string;
};

function sourceKey(variant: Partial<SanMarCanonicalVariant>) {
  const uniqueKey = String(variant.uniqueKey || variant.sku || variant.skuId || "").trim();
  if (uniqueKey) return `unique:${uniqueKey}`;

  const inventoryKey = String(variant.inventoryKey || "").trim();
  const sizeIndex = String(variant.sizeIndex || "").trim();
  if (inventoryKey && sizeIndex) {
    return `inventory:${inventoryKey}|${sizeIndex}`;
  }

  return `display:${sanmarNormalize(variant.colorName)}|${sanmarNormalize(
    variant.sizeName
  )}`;
}

function cacheVariant(styleId: string, raw: CachedVariant): SanMarCanonicalVariant | null {
  const colorName = String(raw.colorName || "").trim();
  const sizeName = String(raw.sizeName || "").trim();
  if (!colorName || !sizeName) return null;

  const uniqueKey = String(
    raw.uniqueKey ||
      (raw.inventoryKey && raw.sizeIndex
        ? `${raw.inventoryKey}${raw.sizeIndex}`
        : "")
  ).trim();

  const fallbackSku =
    uniqueKey ||
    `${styleId}-${colorName}-${sizeName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const catalogColor = String(
    raw.mainframeColor || raw.catalogColor || colorName
  ).trim();

  return {
    sku: fallbackSku,
    skuId: fallbackSku,
    uniqueKey,
    inventoryKey: String(raw.inventoryKey || ""),
    sizeIndex: String(raw.sizeIndex || ""),
    catalogColor,
    mainframeColor: catalogColor,
    colorName,
    sizeName,
    gtin: raw.gtin ? String(raw.gtin) : undefined,
    customerPrice: Math.max(0, Number(raw.piecePrice || 0)),
    quantity: Math.max(0, Number(raw.quantity || 0)),
    active: true,
    frontImageUrl:
      raw.frontFlatUrl ||
      raw.frontModelUrl ||
      raw.colorProductImageUrl ||
      "",
    backImageUrl:
      raw.backFlatUrl ||
      raw.backModelUrl ||
      "",
    swatchImageUrl: raw.swatchImageUrl || "",
    source: "cache"
  };
}

function mergeVariant(
  current: SanMarCanonicalVariant | undefined,
  incoming: SanMarCanonicalVariant
): SanMarCanonicalVariant {
  if (!current) return { ...incoming };

  // The cache / Standard Product Info contain SanMar's canonical order
  // identifiers. Never replace a populated identifier with an empty live field.
  return {
    ...current,
    sku: current.sku || incoming.sku,
    skuId: current.skuId || incoming.skuId,
    uniqueKey: current.uniqueKey || incoming.uniqueKey,
    inventoryKey: current.inventoryKey || incoming.inventoryKey,
    sizeIndex: current.sizeIndex || incoming.sizeIndex,
    catalogColor: current.catalogColor || incoming.catalogColor,
    mainframeColor: current.mainframeColor || incoming.mainframeColor,
    colorName: current.colorName || incoming.colorName,
    sizeName: current.sizeName || incoming.sizeName,
    gtin: current.gtin || incoming.gtin,
    customerPrice:
      incoming.customerPrice > 0
        ? incoming.customerPrice
        : current.customerPrice,
    quantity:
      incoming.quantity > 0
        ? incoming.quantity
        : current.quantity,
    active: current.active !== false && incoming.active !== false,
    frontImageUrl: current.frontImageUrl || incoming.frontImageUrl,
    backImageUrl: current.backImageUrl || incoming.backImageUrl,
    swatchImageUrl: current.swatchImageUrl || incoming.swatchImageUrl
  };
}

function colorCount(variants: SanMarCanonicalVariant[]) {
  return new Set(
    variants
      .map((variant) => String(variant.colorName || "").trim().toLowerCase())
      .filter(Boolean)
  ).size;
}

function cacheMedia(cached: any, variants: SanMarCanonicalVariant[]): SanMarMediaMap {
  const media: SanMarMediaMap = {};

  for (const variant of variants) {
    const color = variant.colorName;
    if (!color) continue;

    media[color] ||= {};

    if (variant.frontImageUrl) media[color].frontImageUrl ||= variant.frontImageUrl;
    if (variant.backImageUrl) media[color].backImageUrl ||= variant.backImageUrl;
    if (variant.swatchImageUrl) media[color].swatchImageUrl ||= variant.swatchImageUrl;
  }

  if (cached?.image_url) {
    const firstColor = variants[0]?.colorName;
    if (firstColor) {
      media[firstColor] ||= {};
      media[firstColor].frontImageUrl ||= String(cached.image_url);
    }
  }

  return media;
}

function mergeMedia(base: SanMarMediaMap, incoming: SanMarMediaMap) {
  const result: SanMarMediaMap = { ...base };

  for (const [color, value] of Object.entries(incoming || {})) {
    result[color] ||= {};
    result[color] = {
      frontImageUrl:
        value.frontImageUrl ||
        result[color].frontImageUrl ||
        "",
      backImageUrl:
        value.backImageUrl ||
        result[color].backImageUrl ||
        "",
      swatchImageUrl:
        value.swatchImageUrl ||
        result[color].swatchImageUrl ||
        ""
    };
  }

  return result;
}

function sourceMetadata(
  cached: any,
  standard: SanMarStyleSource | null,
  promo: SanMarStyleSource | null,
  styleId: string
) {
  return {
    name:
      cached?.title ||
      standard?.name ||
      promo?.name ||
      styleId,
    description:
      cached?.description ||
      standard?.description ||
      promo?.description ||
      `SanMar style ${styleId}`,
    brandName:
      cached?.brand_name ||
      standard?.brandName ||
      promo?.brandName ||
      "SanMar"
  };
}

/**
 * One canonical SanMar style pipeline.
 *
 * COLOR BREADTH comes from the UNION of:
 * 1. SFTP SDL_N / EPDD cache
 * 2. Standard Product Information style-only response
 * 3. PromoStandards Product Data ProductPartArray
 *
 * Live pricing, inventory and media only ENRICH that union. They are never
 * allowed to replace the color set or shrink a multi-color style to one color.
 */
export async function sanmarCompleteStyle(
  supabase: any,
  shopId: string,
  connection: SanMarConnection,
  styleInput: string
) {
  const styleId = styleInput.trim().toUpperCase();
  if (!styleId) throw new Error("Enter a SanMar style number.");

  const warnings: string[] = [];
  const cached = await getSanMarCachedStyle(supabase, shopId, styleId).catch(
    (error) => {
      warnings.push(
        `Cache lookup: ${
          error instanceof Error ? error.message : "unavailable"
        }`
      );
      return null;
    }
  );

  const cachedVariants: SanMarCanonicalVariant[] = (
    Array.isArray(cached?.variants) ? cached.variants : []
  )
    .map((raw: CachedVariant) => cacheVariant(styleId, raw))
    .filter((value: SanMarCanonicalVariant | null): value is SanMarCanonicalVariant => Boolean(value));

  const [standardResult, promoResult] = await Promise.allSettled([
    fetchSanMarStandardProductInfo(connection, styleId),
    fetchSanMarPromoProductData(connection, styleId)
  ]);

  const standard =
    standardResult.status === "fulfilled" ? standardResult.value : null;
  const promo = promoResult.status === "fulfilled" ? promoResult.value : null;

  if (standardResult.status === "rejected") {
    warnings.push(
      `Standard Product Information: ${
        standardResult.reason instanceof Error
          ? standardResult.reason.message
          : String(standardResult.reason)
      }`
    );
  }

  if (promoResult.status === "rejected") {
    warnings.push(
      `PromoStandards Product Data: ${
        promoResult.reason instanceof Error
          ? promoResult.reason.message
          : String(promoResult.reason)
      }`
    );
  }

  const combined = new Map<string, SanMarCanonicalVariant>();

  for (const variant of cachedVariants) {
    const key = sourceKey(variant);
    combined.set(key, mergeVariant(combined.get(key), variant));
  }

  for (const variant of standard?.variants || []) {
    const key = sourceKey(variant);
    combined.set(key, mergeVariant(combined.get(key), variant));
  }

  for (const variant of promo?.variants || []) {
    const key = sourceKey(variant);
    combined.set(key, mergeVariant(combined.get(key), variant));
  }

  let variants = Array.from(combined.values()).filter(
    (variant) => variant.colorName && variant.sizeName
  );

  if (!variants.length) {
    throw new Error(
      [
        `SanMar returned no usable color/size variants for ${styleId}.`,
        ...warnings
      ].join(" ")
    );
  }

  // Live enrichment happens AFTER the complete color list has been built.
  const partIds = Array.from(
    new Set(
      variants
        .map((variant) => variant.uniqueKey || variant.sku)
        .filter(Boolean)
    )
  );
  const displayColorByPartId = new Map(
    variants
      .filter((variant) => variant.uniqueKey || variant.sku)
      .map((variant) => [
        variant.uniqueKey || variant.sku,
        variant.colorName
      ])
  );

  const [pricingResult, inventoryResult, mediaResult] =
    await Promise.allSettled([
      fetchSanMarPricing(connection, styleId),
      partIds.length
        ? fetchSanMarInventory(connection, styleId, partIds)
        : Promise.resolve(new Map<string, number>()),
      fetchSanMarMedia(connection, styleId, displayColorByPartId)
    ]);

  if (pricingResult.status === "rejected") {
    warnings.push(
      `Pricing: ${
        pricingResult.reason instanceof Error
          ? pricingResult.reason.message
          : String(pricingResult.reason)
      }`
    );
  }

  if (inventoryResult.status === "rejected") {
    warnings.push(
      `Inventory: ${
        inventoryResult.reason instanceof Error
          ? inventoryResult.reason.message
          : String(inventoryResult.reason)
      }`
    );
  }

  if (mediaResult.status === "rejected") {
    warnings.push(
      `Media: ${
        mediaResult.reason instanceof Error
          ? mediaResult.reason.message
          : String(mediaResult.reason)
      }`
    );
  }

  const pricing =
    pricingResult.status === "fulfilled" ? pricingResult.value : null;
  const inventory =
    inventoryResult.status === "fulfilled"
      ? inventoryResult.value
      : new Map<string, number>();
  const liveMedia =
    mediaResult.status === "fulfilled" ? mediaResult.value : {};

  variants = variants.map((variant) => {
    const canonicalPrice =
      variant.inventoryKey && variant.sizeIndex
        ? pricing?.byInventoryAndSize.get(
            `${variant.inventoryKey}|${variant.sizeIndex}`
          )
        : undefined;

    const colorSizePrice = pricing?.byCatalogColorAndSize.get(
      `${sanmarNormalize(
        variant.catalogColor || variant.mainframeColor || variant.colorName
      )}|${sanmarNormalize(variant.sizeName)}`
    );

    const inventoryKey = variant.uniqueKey || variant.sku;
    const liveQuantity = inventory.get(inventoryKey);

    return {
      ...variant,
      customerPrice:
        canonicalPrice ||
        colorSizePrice ||
        variant.customerPrice ||
        0,
      quantity:
        liveQuantity !== undefined
          ? Math.max(0, Number(liveQuantity || 0))
          : variant.quantity
    };
  });

  variants.sort((a, b) => {
    const color = a.colorName.localeCompare(b.colorName);
    if (color !== 0) return color;
    return a.sizeName.localeCompare(b.sizeName, undefined, { numeric: true });
  });

  let media = cacheMedia(cached, variants);

  const standardMedia: SanMarMediaMap = {};
  for (const variant of standard?.variants || []) {
    standardMedia[variant.colorName] ||= {};
    if (variant.frontImageUrl) {
      standardMedia[variant.colorName].frontImageUrl ||= variant.frontImageUrl;
    }
    if (variant.backImageUrl) {
      standardMedia[variant.colorName].backImageUrl ||= variant.backImageUrl;
    }
    if (variant.swatchImageUrl) {
      standardMedia[variant.colorName].swatchImageUrl ||= variant.swatchImageUrl;
    }
  }

  media = mergeMedia(media, standardMedia);
  media = mergeMedia(media, liveMedia);

  // Guarantee every displayed color has a media object so the importer never
  // treats a missing image record as a missing color.
  for (const variant of variants) {
    media[variant.colorName] ||= {};
  }

  const meta = sourceMetadata(cached, standard, promo, styleId);
  const diagnostics = {
    cacheVariantCount: cachedVariants.length,
    cacheColorCount: colorCount(cachedVariants),
    standardVariantCount: standard?.variants.length || 0,
    standardColorCount: colorCount(standard?.variants || []),
    promoVariantCount: promo?.variants.length || 0,
    promoColorCount: colorCount(promo?.variants || []),
    finalVariantCount: variants.length,
    finalColorCount: colorCount(variants),
    pricingRows:
      pricingResult.status === "fulfilled"
        ? pricingResult.value.byInventoryAndSize.size
        : 0,
    inventoryRows:
      inventoryResult.status === "fulfilled"
        ? inventoryResult.value.size
        : 0,
    mediaColors: Object.keys(media).length,
    warnings
  };

  // Self-heal an existing SFTP cache row if the live union discovers more
  // complete color/size data. This does not create a new row or require SQL.
  if (
    cached &&
    (diagnostics.finalVariantCount > diagnostics.cacheVariantCount ||
      diagnostics.finalColorCount > diagnostics.cacheColorCount)
  ) {
    const repairedVariants = variants.map((variant) => ({
      uniqueKey: variant.uniqueKey || variant.sku,
      inventoryKey: variant.inventoryKey || "",
      sizeIndex: variant.sizeIndex || "",
      mainframeColor:
        variant.mainframeColor || variant.catalogColor || variant.colorName,
      colorName: variant.colorName,
      sizeName: variant.sizeName,
      quantity: variant.quantity,
      piecePrice: variant.customerPrice,
      gtin: variant.gtin || "",
      swatchImageUrl: media[variant.colorName]?.swatchImageUrl || "",
      colorProductImageUrl: media[variant.colorName]?.frontImageUrl || "",
      frontModelUrl: media[variant.colorName]?.frontImageUrl || "",
      backModelUrl: media[variant.colorName]?.backImageUrl || "",
      frontFlatUrl: media[variant.colorName]?.frontImageUrl || "",
      backFlatUrl: media[variant.colorName]?.backImageUrl || ""
    }));

    const positivePrices = variants
      .map((variant) => Number(variant.customerPrice || 0))
      .filter((value) => value > 0);

    await supabase
      .from("sanmar_catalog_styles")
      .update({
        variants: repairedVariants,
        color_count: diagnostics.finalColorCount,
        size_count: new Set(variants.map((variant) => variant.sizeName)).size,
        price_min: positivePrices.length ? Math.min(...positivePrices) : 0,
        price_max: positivePrices.length ? Math.max(...positivePrices) : 0,
        synced_at: new Date().toISOString()
      })
      .eq("shop_id", shopId)
      .eq("style_id", styleId);
  }

  return {
    styleId,
    name: meta.name,
    description: meta.description,
    brandName: meta.brandName,
    variants,
    media,
    diagnostics
  };
}
