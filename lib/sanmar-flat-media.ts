import type { CatalogProduct } from "@/lib/types";

type Side = "front" | "back";

type CachedVariant = {
  colorName?: string;
  swatchImageUrl?: string;
  colorProductImageUrl?: string;
  frontModelUrl?: string;
  backModelUrl?: string;
  frontFlatUrl?: string;
  backFlatUrl?: string;
};

type CachedStyleRow = {
  style_id: string;
  category?: string | null;
  variants?: CachedVariant[] | null;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function colorKey(value: unknown) {
  return clean(value).toLowerCase();
}

function decodedUrl(value: unknown) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function isSanMarModelImage(value: unknown) {
  const url = decodedUrl(value);
  if (!url) return false;

  return (
    /model[\s_\-/]?(front|back)?/.test(url) ||
    /(front|back)[\s_\-/]?model/.test(url) ||
    /on[\s_\-/]?model/.test(url) ||
    /lifestyle/.test(url)
  );
}

export function isSanMarFlatImage(value: unknown, side?: Side) {
  const url = decodedUrl(value);
  if (!url) return false;

  const compact = url.replace(/[^a-z0-9]/g, "");

  if (side === "front") {
    return (
      compact.includes("flatfront") ||
      compact.includes("frontflat")
    );
  }

  if (side === "back") {
    return (
      compact.includes("flatback") ||
      compact.includes("backflat")
    );
  }

  return compact.includes("flatfront") || compact.includes("flatback");
}

function isWrongSide(value: unknown, side: Side) {
  const url = decodedUrl(value);
  if (!url) return false;

  const compact = url.replace(/[^a-z0-9]/g, "");

  if (side === "front") {
    return (
      (compact.includes("flatback") || compact.includes("modelback")) &&
      !compact.includes("front")
    );
  }

  return (
    (compact.includes("flatfront") || compact.includes("modelfront")) &&
    !compact.includes("back")
  );
}

function validUrl(value: unknown) {
  const raw = clean(value);
  return /^https:\/\//i.test(raw) ? raw : "";
}

function unique(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .map(validUrl)
        .filter(Boolean)
    )
  );
}

/**
 * SanMar gives us two independent ways to know an image is a flat:
 *
 * 1. The SFTP fields themselves:
 *      FRONT_FLAT_IMAGE_URL
 *      BACK_FLAT_IMAGE_URL
 *
 * 2. The CDN asset names. Example:
 *      ...A4N3142AthlOrangeFlatFront.jpg
 *      ...A4N3142AthlOrangeModelFront.jpg
 *
 * Explicit SFTP flat fields always win. A model/lifestyle image is never
 * selected for a storefront mockup or print-zone garment.
 */
function preferredImage(
  side: Side,
  explicitFlat: unknown[],
  candidates: unknown[]
) {
  const exact = unique(explicitFlat).find(
    (url) => !isWrongSide(url, side)
  );
  if (exact) return exact;

  const safe = unique(candidates).filter(
    (url) =>
      !isSanMarModelImage(url) &&
      !isWrongSide(url, side)
  );

  const markedFlat = safe.find((url) =>
    isSanMarFlatImage(url, side)
  );

  return markedFlat || safe[0] || "";
}

function cachedMediaForColor(
  cached: CachedStyleRow | null | undefined,
  colorName: string,
  current?: {
    frontImageUrl?: string;
    backImageUrl?: string;
    swatchImageUrl?: string;
  },
  variantCandidates?: Array<{
    frontImageUrl?: string;
    backImageUrl?: string;
    swatchImageUrl?: string;
  }>
) {
  const rows = (Array.isArray(cached?.variants)
    ? cached!.variants!
    : []
  ).filter(
    (variant) => colorKey(variant.colorName) === colorKey(colorName)
  );

  const currentRows = variantCandidates || [];

  const frontImageUrl = preferredImage(
    "front",
    rows.map((variant) => variant.frontFlatUrl),
    [
      ...rows.map((variant) => variant.frontFlatUrl),
      ...rows.map((variant) => variant.colorProductImageUrl),
      current?.frontImageUrl,
      ...currentRows.map((variant) => variant.frontImageUrl)
    ]
  );

  const backImageUrl = preferredImage(
    "back",
    rows.map((variant) => variant.backFlatUrl),
    [
      ...rows.map((variant) => variant.backFlatUrl),
      current?.backImageUrl,
      ...currentRows.map((variant) => variant.backImageUrl)
    ]
  );

  const swatchImageUrl =
    rows.map((variant) => validUrl(variant.swatchImageUrl)).find(Boolean) ||
    validUrl(current?.swatchImageUrl) ||
    currentRows
      .map((variant) => validUrl(variant.swatchImageUrl))
      .find(Boolean) ||
    "";

  return {
    frontImageUrl,
    backImageUrl,
    swatchImageUrl
  };
}

async function cachedStyle(
  supabase: any,
  shopId: string,
  styleId: string
): Promise<CachedStyleRow | null> {
  const { data, error } = await supabase
    .from("sanmar_catalog_styles")
    .select("style_id,category,variants")
    .eq("shop_id", shopId)
    .eq("style_id", styleId.trim().toUpperCase())
    .maybeSingle();

  if (error) throw error;
  return (data || null) as CachedStyleRow | null;
}

/**
 * Applies SanMar's flat-image policy to a live style returned by the canonical
 * SanMar pipeline.
 *
 * The color/size/SKU data is untouched. Only media selection changes.
 */
export async function withPreferredSanMarFlatMedia<T extends {
  styleId: string;
  variants: any[];
  media?: Record<
    string,
    {
      frontImageUrl?: string;
      backImageUrl?: string;
      swatchImageUrl?: string;
    }
  >;
}>(
  supabase: any,
  shopId: string,
  style: T
): Promise<T & { cached?: CachedStyleRow | null }> {
  const cached = await cachedStyle(
    supabase,
    shopId,
    style.styleId
  ).catch(() => null);

  const media = {
    ...(style.media || {})
  };

  const colors = Array.from(
    new Set(
      (style.variants || [])
        .map((variant: any) => clean(variant.colorName))
        .filter(Boolean)
    )
  );

  for (const colorName of colors) {
    const variantsForColor = (style.variants || []).filter(
      (variant: any) =>
        colorKey(variant.colorName) === colorKey(colorName)
    );

    const current = media[colorName] || {};
    const preferred = cachedMediaForColor(
      cached,
      colorName,
      current,
      variantsForColor
    );

    media[colorName] = {
      frontImageUrl: preferred.frontImageUrl || "",
      backImageUrl: preferred.backImageUrl || "",
      swatchImageUrl:
        preferred.swatchImageUrl ||
        current.swatchImageUrl ||
        ""
    };
  }

  const variants = (style.variants || []).map((variant: any) => {
    const preferred = media[variant.colorName] || {};
    return {
      ...variant,
      frontImageUrl: preferred.frontImageUrl || "",
      backImageUrl: preferred.backImageUrl || "",
      swatchImageUrl:
        preferred.swatchImageUrl ||
        variant.swatchImageUrl ||
        ""
    };
  });

  return {
    ...style,
    variants,
    media,
    cached
  };
}

function cloneConfiguration(value: any) {
  return {
    ...(value || {}),
    colors: Array.isArray(value?.colors)
      ? value.colors.map((color: any) => ({ ...color }))
      : [],
    supplier: value?.supplier
      ? {
          ...value.supplier,
          variants: Array.isArray(value.supplier.variants)
            ? value.supplier.variants.map((variant: any) => ({
                ...variant
              }))
            : []
        }
      : value?.supplier,
    customization: value?.customization
      ? { ...value.customization }
      : value?.customization
  };
}

function applyCachedMediaToConfiguration(
  configuration: any,
  cached: CachedStyleRow | null | undefined
) {
  const next = cloneConfiguration(configuration);
  if (!Array.isArray(next.colors) || !next.colors.length) {
    return { configuration: next, changed: false };
  }

  let changed = false;

  next.colors = next.colors.map((color: any) => {
    const preferred = cachedMediaForColor(
      cached,
      String(color?.name || ""),
      {
        frontImageUrl: color?.frontImageUrl,
        backImageUrl: color?.backImageUrl,
        swatchImageUrl: color?.swatchImageUrl
      }
    );

    const front =
      preferred.frontImageUrl ||
      (isSanMarModelImage(color?.frontImageUrl)
        ? ""
        : clean(color?.frontImageUrl));

    const back =
      preferred.backImageUrl ||
      (isSanMarModelImage(color?.backImageUrl)
        ? ""
        : clean(color?.backImageUrl));

    const swatch =
      preferred.swatchImageUrl ||
      clean(color?.swatchImageUrl);

    if (
      front !== clean(color?.frontImageUrl) ||
      back !== clean(color?.backImageUrl) ||
      swatch !== clean(color?.swatchImageUrl)
    ) {
      changed = true;
    }

    return {
      ...color,
      frontImageUrl: front || undefined,
      backImageUrl: back || undefined,
      swatchImageUrl: swatch || undefined
    };
  });

  const visibleColors = next.colors.filter(
    (color: any) => color?.active !== false
  );

  const defaultColor =
    visibleColors.find(
      (color: any) =>
        String(color?.id || "") ===
        String(next.defaultColorId || "")
    ) ||
    visibleColors[0] ||
    next.colors[0];

  const nextMockup = clean(defaultColor?.frontImageUrl);

  if (nextMockup !== clean(next.mockupImageUrl)) {
    changed = true;
    next.mockupImageUrl = nextMockup || undefined;
  }

  return { configuration: next, changed };
}

/**
 * Makes already-imported SanMar products use flat garment imagery.
 *
 * - Public storefronts can call this with persist=false for immediate display.
 * - Admin Products calls it with persist=true so existing stored product
 *   configuration is permanently repaired without re-importing each style.
 *
 * Only image fields and mockupImageUrl are changed. Pricing, variants,
 * print zones, colors, visibility and all other product settings are preserved.
 */
export async function hydrateSanMarProductRowsWithFlatMedia<
  T extends {
    id?: string;
    configuration?: any;
    [key: string]: any;
  }
>(
  supabase: any,
  shopId: string,
  rows: T[],
  options?: { persist?: boolean }
): Promise<T[]> {
  const styleIds = Array.from(
    new Set(
      rows
        .map((row) => {
          const supplier = row?.configuration?.supplier;
          if (
            String(supplier?.provider || "").toLowerCase() !==
            "sanmar"
          ) {
            return "";
          }

          return String(supplier?.styleId || "")
            .trim()
            .toUpperCase();
        })
        .filter(Boolean)
    )
  );

  if (!styleIds.length) return rows;

  const cachedByStyle = new Map<string, CachedStyleRow>();

  for (let index = 0; index < styleIds.length; index += 100) {
    const batch = styleIds.slice(index, index + 100);

    const { data, error } = await supabase
      .from("sanmar_catalog_styles")
      .select("style_id,category,variants")
      .eq("shop_id", shopId)
      .in("style_id", batch);

    if (error) throw error;

    for (const row of data || []) {
      cachedByStyle.set(
        String(row.style_id || "").toUpperCase(),
        row as CachedStyleRow
      );
    }
  }

  const repaired: T[] = [];

  for (const row of rows) {
    const supplier = row?.configuration?.supplier;
    const styleId = String(supplier?.styleId || "")
      .trim()
      .toUpperCase();

    if (
      String(supplier?.provider || "").toLowerCase() !== "sanmar" ||
      !styleId
    ) {
      repaired.push(row);
      continue;
    }

    const cached = cachedByStyle.get(styleId);
    const result = applyCachedMediaToConfiguration(
      row.configuration,
      cached
    );

    const nextRow = {
      ...row,
      configuration: result.configuration
    };

    repaired.push(nextRow);

    if (
      options?.persist &&
      result.changed &&
      row.id
    ) {
      const { error } = await supabase
        .from("catalog_products")
        .update({
          configuration: result.configuration,
          updated_at: new Date().toISOString()
        })
        .eq("shop_id", shopId)
        .eq("id", row.id);

      if (error) throw error;
    }
  }

  return repaired;
}

export function sanmarFlatImageDiagnostics(
  value: unknown,
  side: Side
) {
  return {
    url: clean(value),
    flat: isSanMarFlatImage(value, side),
    model: isSanMarModelImage(value)
  };
}
