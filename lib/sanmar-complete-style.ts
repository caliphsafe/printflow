import {
  getSanMarCachedStyle
} from "@/lib/sanmar-catalog";
import {
  sanmarNormalizedStyleCorrected
} from "@/lib/sanmar-normalized-fixed";

type Connection = {
  encrypted_account_number: string;
  encrypted_api_key: string;
  settings?: Record<string, any> | null;
};

type CachedVariant = {
  uniqueKey?: string;
  inventoryKey?: string;
  sizeIndex?: string;
  mainframeColor?: string;
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

function key(colorName: unknown, sizeName: unknown) {
  return `${String(colorName || "").trim().toLowerCase()}|${String(sizeName || "")
    .trim()
    .toLowerCase()}`;
}

function cachedSku(styleId: string, variant: CachedVariant) {
  return (
    String(variant.uniqueKey || "").trim() ||
    String(variant.inventoryKey || "").trim() ||
    `${styleId}-${String(variant.colorName || "color")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${String(variant.sizeName || "size")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`
  );
}

function cachedMedia(cached: any, colorName: string) {
  const variants: CachedVariant[] = Array.isArray(cached?.variants)
    ? cached.variants
    : [];

  const rows = variants.filter(
    (variant) =>
      String(variant.colorName || "").trim().toLowerCase() ===
      colorName.trim().toLowerCase()
  );

  const first = rows[0];

  return {
    frontImageUrl:
      rows.find((row) => row.frontFlatUrl)?.frontFlatUrl ||
      rows.find((row) => row.frontModelUrl)?.frontModelUrl ||
      rows.find((row) => row.colorProductImageUrl)?.colorProductImageUrl ||
      first?.frontFlatUrl ||
      first?.frontModelUrl ||
      first?.colorProductImageUrl ||
      cached?.front_flat_url ||
      cached?.front_model_url ||
      cached?.image_url ||
      "",
    backImageUrl:
      rows.find((row) => row.backFlatUrl)?.backFlatUrl ||
      rows.find((row) => row.backModelUrl)?.backModelUrl ||
      first?.backFlatUrl ||
      first?.backModelUrl ||
      cached?.back_flat_url ||
      cached?.back_model_url ||
      "",
    swatchImageUrl:
      rows.find((row) => row.swatchImageUrl)?.swatchImageUrl ||
      first?.swatchImageUrl ||
      ""
  };
}

/**
 * Returns the complete SanMar style used by the Advanced product importer.
 *
 * Why this wrapper exists:
 * - SanMar's exact ProductData response is useful for live style data.
 * - The SFTP SDL_N/EPDD cache contains the full breadth of color/size rows.
 * - Some exact-style responses do not expose every catalog color in the same
 *   shape that the current parser expects.
 *
 * We therefore use the live response as enrichment, but never allow it to
 * shrink the complete color/size set already present in the SanMar cache.
 */
export async function sanmarCompleteStyle(
  supabase: any,
  shopId: string,
  connection: Connection,
  styleId: string
) {
  const live = await sanmarNormalizedStyleCorrected(
    connection,
    styleId
  );

  const cached = await getSanMarCachedStyle(
    supabase,
    shopId,
    styleId
  ).catch(() => null);

  if (!cached || !Array.isArray(cached.variants) || !cached.variants.length) {
    return live;
  }

  const variants = new Map<string, any>();

  // Keep every live variant first.
  for (const variant of live.variants || []) {
    variants.set(
      key(variant.colorName, variant.sizeName),
      { ...variant }
    );
  }

  // Add any color/size combinations that exist in the SFTP catalog but are
  // missing from the exact-style response. If both exist, retain live pricing
  // and inventory while filling supplier identifiers from the cache.
  for (const raw of cached.variants as CachedVariant[]) {
    const colorName = String(raw.colorName || "").trim();
    const sizeName = String(raw.sizeName || "").trim();

    if (!colorName || !sizeName) continue;

    const variantKey = key(colorName, sizeName);
    const current = variants.get(variantKey);
    const fallbackSku = cachedSku(live.styleId, raw);

    if (current) {
      variants.set(variantKey, {
        ...current,
        sku: current.sku || fallbackSku,
        skuId: current.skuId || fallbackSku,
        gtin: current.gtin || raw.gtin || "",
        inventoryKey: current.inventoryKey || raw.inventoryKey || "",
        sizeIndex: current.sizeIndex || raw.sizeIndex || "",
        mainframeColor:
          current.mainframeColor || raw.mainframeColor || colorName,
        uniqueKey: current.uniqueKey || raw.uniqueKey || ""
      });
      continue;
    }

    variants.set(variantKey, {
      sku: fallbackSku,
      skuId: fallbackSku,
      gtin: raw.gtin || "",
      colorName,
      sizeName,
      customerPrice: Math.max(0, Number(raw.piecePrice || 0)),
      quantity: Math.max(0, Number(raw.quantity || 0)),
      active: true,
      inventoryKey: raw.inventoryKey || "",
      sizeIndex: raw.sizeIndex || "",
      mainframeColor: raw.mainframeColor || colorName,
      uniqueKey: raw.uniqueKey || ""
    });
  }

  const media: Record<string, any> = { ...(live.media || {}) };

  const allColors = Array.from(
    new Set(
      Array.from(variants.values())
        .map((variant: any) => String(variant.colorName || "").trim())
        .filter(Boolean)
    )
  );

  // Build media for every color, not only colors returned by ProductData.
  for (const colorName of allColors) {
    const fallback = cachedMedia(cached, colorName);
    const current = media[colorName] || {};

    media[colorName] = {
      frontImageUrl:
        current.frontImageUrl || fallback.frontImageUrl || "",
      backImageUrl:
        current.backImageUrl || fallback.backImageUrl || "",
      swatchImageUrl:
        current.swatchImageUrl || fallback.swatchImageUrl || ""
    };
  }

  return {
    ...live,
    name: cached.title || live.name,
    description: cached.description || live.description,
    brandName: cached.brand_name || live.brandName,
    media,
    cached,
    variants: Array.from(variants.values()).sort((a: any, b: any) => {
      const colorCompare = String(a.colorName).localeCompare(
        String(b.colorName)
      );
      if (colorCompare !== 0) return colorCompare;
      return String(a.sizeName).localeCompare(String(b.sizeName), undefined, {
        numeric: true
      });
    })
  };
}
