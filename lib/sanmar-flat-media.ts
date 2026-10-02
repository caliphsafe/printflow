import { decryptSecret } from "@/lib/crypto";
import type { SanMarImageChoice } from "@/lib/sanmar-canonical";

type Side = "front" | "back";

type CachedVariant = {
  colorName?: string;
  swatchImageUrl?: string;
  colorProductImageUrl?: string;
  frontModelUrl?: string;
  backModelUrl?: string;
  frontFlatUrl?: string;
  backFlatUrl?: string;
  frontFlat?: string;
  backFlat?: string;
};

type CachedStyleRow = {
  style_id: string;
  category?: string | null;
  variants?: CachedVariant[] | null;
};

type SanMarConnection = {
  encrypted_account_number: string;
  encrypted_api_key: string;
  settings?: Record<string, any> | null;
  status?: string | null;
};

type FlatMedia = {
  frontImageUrl?: string;
  backImageUrl?: string;
  swatchImageUrl?: string;
  imageChoices?: SanMarImageChoice[];
};

type FlatMediaMap = Record<string, FlatMedia>;

function cachedImageChoices(cached: CachedStyleRow | null | undefined, colorName: string): SanMarImageChoice[] {
  const variants = (cached?.variants || []).filter((item) => colorKey(item.colorName) === colorKey(colorName));
  const fields: Array<[string, (variant: CachedVariant) => unknown]> = [
    ["Front flat", (variant) => variant.frontFlatUrl || variant.frontFlat],
    ["Back flat", (variant) => variant.backFlatUrl || variant.backFlat],
    ["Front model", (variant) => variant.frontModelUrl],
    ["Back model", (variant) => variant.backModelUrl],
    ["Color product", (variant) => variant.colorProductImageUrl],
    ["Swatch", (variant) => variant.swatchImageUrl]
  ];
  const choices = new Map<string, SanMarImageChoice>();
  for (const variant of variants) for (const [label, read] of fields) {
    const url = validUrl(read(variant));
    if (url && !choices.has(url)) choices.set(url, { url, label });
  }
  return Array.from(choices.values());
}

const LIVE_FLAT_CACHE_MS = 30 * 60 * 1000;

const liveFlatCache = new Map<
  string,
  {
    expiresAt: number;
    media: FlatMediaMap;
  }
>();

function clean(value: unknown) {
  return String(value || "").trim();
}

function colorKey(value: unknown) {
  return clean(value).toLowerCase();
}

function validUrl(value: unknown) {
  const raw = clean(value);

  if (/^http:\/\//i.test(raw)) {
    return raw.replace(/^http:\/\//i, "https://");
  }

  return /^https:\/\//i.test(raw) ? raw : "";
}

function decodedUrl(value: unknown) {
  const raw = validUrl(value) || clean(value);

  if (!raw) return "";

  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function sameUrl(a: unknown, b: unknown) {
  const left = validUrl(a);
  const right = validUrl(b);

  if (!left || !right) return false;

  return left === right;
}

function isSanMarUrl(value: unknown) {
  const raw = validUrl(value);

  if (!raw) return false;

  try {
    const host = new URL(raw).hostname.toLowerCase();

    return (
      host === "sanmar.com" ||
      host.endsWith(".sanmar.com")
    );
  } catch {
    return /sanmar\.com/i.test(raw);
  }
}

export function isSanMarModelImage(value: unknown) {
  const url = decodedUrl(value);

  if (!url) return false;

  const compact = url.replace(/[^a-z0-9]/g, "");

  return (
    compact.includes("modelfront") ||
    compact.includes("modelback") ||
    compact.includes("frontmodel") ||
    compact.includes("backmodel") ||
    compact.includes("onmodel") ||
    compact.includes("lifestyle")
  );
}

export function isSanMarFlatImage(
  value: unknown,
  side?: Side
) {
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

  return (
    compact.includes("flatfront") ||
    compact.includes("frontflat") ||
    compact.includes("flatback") ||
    compact.includes("backflat")
  );
}

function isWrongSide(
  value: unknown,
  side: Side
) {
  const compact = decodedUrl(value).replace(
    /[^a-z0-9]/g,
    ""
  );

  if (!compact) return false;

  if (side === "front") {
    return (
      (
        compact.includes("flatback") ||
        compact.includes("modelback") ||
        compact.includes("backflat") ||
        compact.includes("backmodel")
      ) &&
      !compact.includes("front")
    );
  }

  return (
    (
      compact.includes("flatfront") ||
      compact.includes("modelfront") ||
      compact.includes("frontflat") ||
      compact.includes("frontmodel")
    ) &&
    !compact.includes("back")
  );
}

function safeCustomOrNamedFlat(
  value: unknown,
  side: Side
) {
  const url = validUrl(value);

  if (!url) return "";

  if (isWrongSide(url, side)) return "";
  if (isSanMarModelImage(url)) return "";

  /*
    Non-SanMar images can be deliberate shop uploads / manual overrides.
    Keep those.

    SanMar-hosted images are accepted as a generic fallback ONLY if their
    filename explicitly identifies them as a flat. Opaque SanMar URLs such as
    "624Wx724H-null?context=..." are accepted only when they came from an
    official frontFlat/backFlat API field, never by guessing from the URL.
  */
  if (!isSanMarUrl(url)) return url;

  return isSanMarFlatImage(url, side)
    ? url
    : "";
}

function decodeXml(value: string) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function xmlTag(
  xml: string,
  name: string
) {
  const match = String(xml || "").match(
    new RegExp(
      `<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`,
      "i"
    )
  );

  return match
    ? decodeXml(
        match[1].replace(/<[^>]+>/g, "")
      )
    : "";
}

function xmlBlocks(
  xml: string,
  name: string
) {
  return [
    ...String(xml || "").matchAll(
      new RegExp(
        `<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`,
        "gi"
      )
    )
  ].map((match) => match[1]);
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function apiHost(
  connection: SanMarConnection
) {
  const environment = String(
    connection.settings?.environment ||
      "production"
  ).toLowerCase();

  return (
    environment === "test" ||
    environment === "edev"
  )
    ? "https://edev-ws.sanmar.com:8080"
    : "https://ws.sanmar.com:8080";
}

async function sanmarConnection(
  supabase: any,
  shopId: string
): Promise<SanMarConnection | null> {
  const { data, error } = await supabase
    .from("supplier_connections")
    .select(
      "encrypted_account_number,encrypted_api_key,settings,status"
    )
    .eq("shop_id", shopId)
    .eq("provider", "sanmar")
    .maybeSingle();

  if (error) throw error;

  if (
    !data ||
    data.status !== "connected"
  ) {
    return null;
  }

  return data as SanMarConnection;
}

/**
 * Fetch ONLY the fields SanMar itself identifies as flat garment images.
 *
 * This deliberately does not use:
 * - colorProductImage (SanMar documents this as a front MODEL image)
 * - productImage
 * - frontModel / backModel
 * - PromoStandards generic media classes
 *
 * The exact productImageInfo.frontFlat and .backFlat fields are authoritative,
 * even when the CDN URL itself is opaque, e.g.:
 *   https://cdnp.sanmar.com/medias/624Wx724H-null?context=...
 */
async function fetchExactFlatMedia(
  supabase: any,
  shopId: string,
  styleId: string
): Promise<FlatMediaMap> {
  const cacheKey =
    `${shopId}:${styleId.trim().toUpperCase()}`;

  const cached = liveFlatCache.get(
    cacheKey
  );

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.media;
  }

  const connection =
    await sanmarConnection(
      supabase,
      shopId
    );

  if (!connection) {
    return {};
  }

  const username = decryptSecret(
    connection.encrypted_account_number
  );

  const password = decryptSecret(
    connection.encrypted_api_key
  );

  const customerNumber = clean(
    connection.settings?.customerNumber
  );

  if (
    !username ||
    !password ||
    !customerNumber
  ) {
    return {};
  }

  const style = styleId
    .trim()
    .toUpperCase();

  const endpoint = String(
    connection.settings?.productInfoEndpoint ||
      `${apiHost(
        connection
      )}/SanMarWebService/SanMarProductInfoServicePort`
  );

  const body =
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:impl="http://impl.webservice.integration.sanmar.com/">` +
    `<soapenv:Header/><soapenv:Body>` +
    `<impl:getProductInfoByStyleColorSize>` +
    `<arg0><style>${escapeXml(
      style
    )}</style></arg0>` +
    `<arg1>` +
    `<sanMarCustomerNumber>${escapeXml(
      customerNumber
    )}</sanMarCustomerNumber>` +
    `<sanMarUserName>${escapeXml(
      username
    )}</sanMarUserName>` +
    `<sanMarUserPassword>${escapeXml(
      password
    )}</sanMarUserPassword>` +
    `</arg1>` +
    `</impl:getProductInfoByStyleColorSize>` +
    `</soapenv:Body></soapenv:Envelope>`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type":
        "text/xml; charset=utf-8",
      Accept: "text/xml"
    },
    body,
    cache: "no-store",
    signal:
      AbortSignal.timeout(45000)
  });

  const xml = await response.text();

  if (
    !response.ok ||
    /<(?:[A-Za-z0-9_-]+:)?Fault\b/i.test(
      xml
    )
  ) {
    throw new Error(
      xmlTag(xml, "faultstring") ||
        xmlTag(xml, "message") ||
        `SanMar Product Information request failed (${response.status}).`
    );
  }

  const errorFlag =
    xmlTag(xml, "errorOccurred") ||
    xmlTag(xml, "errorOccured");

  if (/^true$/i.test(errorFlag)) {
    throw new Error(
      xmlTag(xml, "message") ||
        `SanMar could not load style ${style}.`
    );
  }

  const media: FlatMediaMap = {};

  for (const rowXml of xmlBlocks(
    xml,
    "listResponse"
  )) {
    const basic =
      xmlBlocks(
        rowXml,
        "productBasicInfo"
      )[0] || rowXml;

    const images =
      xmlBlocks(
        rowXml,
        "productImageInfo"
      )[0] || "";

    const returnedStyle = xmlTag(
      basic,
      "style"
    )
      .trim()
      .toUpperCase();

    if (
      returnedStyle &&
      returnedStyle !== style
    ) {
      continue;
    }

    const colorName =
      xmlTag(basic, "color").trim() ||
      xmlTag(
        basic,
        "catalogColor"
      ).trim();

    if (!colorName) continue;

    media[colorName] ||= {};

    /*
      These two tags are the key correction.
      Their semantic meaning comes from SanMar's service schema, so their URLs
      do NOT need "FlatFront" / "FlatBack" in the filename.
    */
    const frontFlat = validUrl(
      xmlTag(images, "frontFlat")
    );

    const backFlat = validUrl(
      xmlTag(images, "backFlat")
    );

    const swatch =
      validUrl(
        xmlTag(
          images,
          "colorSquareImage"
        )
      ) ||
      validUrl(
        xmlTag(
          images,
          "colorSwatchImage"
        )
      );

    if (frontFlat) {
      media[
        colorName
      ].frontImageUrl ||= frontFlat;
    }

    if (backFlat) {
      media[
        colorName
      ].backImageUrl ||= backFlat;
    }

    if (swatch) {
      media[
        colorName
      ].swatchImageUrl ||= swatch;
    }
  }

  liveFlatCache.set(cacheKey, {
    expiresAt:
      Date.now() +
      LIVE_FLAT_CACHE_MS,
    media
  });

  return media;
}

function cacheFlat(
  rows: CachedVariant[],
  side: Side
) {
  for (const row of rows) {
    const candidate =
      side === "front"
        ? row.frontFlatUrl
        : row.backFlatUrl;

    const url = validUrl(candidate);

    if (!url) continue;

    /*
      Older PrintFlow SanMar sync code used COLOR_PRODUCT_IMAGE as a fallback
      when populating frontFlatUrl. SanMar documents COLOR_PRODUCT_IMAGE as a
      model image, so an identical URL is NOT proof of a flat.
    */
    if (
      side === "front" &&
      sameUrl(
        url,
        row.colorProductImageUrl
      )
    ) {
      continue;
    }

    if (isSanMarModelImage(url)) {
      continue;
    }

    if (isWrongSide(url, side)) {
      continue;
    }

    return url;
  }

  return "";
}

function cacheSwatch(
  rows: CachedVariant[]
) {
  return (
    rows
      .map((row) =>
        validUrl(row.swatchImageUrl)
      )
      .find(Boolean) || ""
  );
}

function rowsForColor(
  cached:
    | CachedStyleRow
    | null
    | undefined,
  colorName: string
) {
  return (
    Array.isArray(cached?.variants)
      ? cached!.variants!
      : []
  ).filter(
    (variant) =>
      colorKey(
        variant.colorName
      ) === colorKey(colorName)
  );
}

function resolvedColorMedia({
  colorName,
  cached,
  live,
  current,
  variantCandidates
}: {
  colorName: string;
  cached:
    | CachedStyleRow
    | null
    | undefined;
  live?: FlatMedia;
  current?: FlatMedia;
  variantCandidates?: FlatMedia[];
}) {
  const rows = rowsForColor(
    cached,
    colorName
  );

  const variants =
    variantCandidates || [];

  const liveFront = validUrl(
    live?.frontImageUrl
  );

  const liveBack = validUrl(
    live?.backImageUrl
  );

  const cachedFront = cacheFlat(
    rows,
    "front"
  );

  const cachedBack = cacheFlat(
    rows,
    "back"
  );

  const currentFront =
    safeCustomOrNamedFlat(
      current?.frontImageUrl,
      "front"
    ) ||
    variants
      .map((variant) =>
        safeCustomOrNamedFlat(
          variant.frontImageUrl,
          "front"
        )
      )
      .find(Boolean) ||
    "";

  const currentBack =
    safeCustomOrNamedFlat(
      current?.backImageUrl,
      "back"
    ) ||
    variants
      .map((variant) =>
        safeCustomOrNamedFlat(
          variant.backImageUrl,
          "back"
        )
      )
      .find(Boolean) ||
    "";

  return {
    /*
      Live exact frontFlat/backFlat is first because it is the freshest
      first-party signal and supports opaque CDN URLs.

      Cache exact flat is second.

      A manually supplied / clearly named flat image is third.
    */
    frontImageUrl:
      liveFront ||
      cachedFront ||
      currentFront ||
      "",

    backImageUrl:
      liveBack ||
      cachedBack ||
      currentBack ||
      "",

    swatchImageUrl:
      validUrl(
        live?.swatchImageUrl
      ) ||
      cacheSwatch(rows) ||
      validUrl(
        current?.swatchImageUrl
      ) ||
      variants
        .map((variant) =>
          validUrl(
            variant.swatchImageUrl
          )
        )
        .find(Boolean) ||
      ""
  };
}

async function cachedStyle(
  supabase: any,
  shopId: string,
  styleId: string
): Promise<CachedStyleRow | null> {
  const { data, error } = await supabase
    .from("sanmar_catalog_styles")
    .select(
      "style_id,category,variants"
    )
    .eq("shop_id", shopId)
    .eq(
      "style_id",
      styleId
        .trim()
        .toUpperCase()
    )
    .maybeSingle();

  if (error) throw error;

  return (
    data || null
  ) as CachedStyleRow | null;
}

function needsLiveExactFlats(
  cached:
    | CachedStyleRow
    | null
    | undefined,
  colorNames: string[]
) {
  if (!colorNames.length) return false;

  return colorNames.some(
    (colorName) => {
      const rows = rowsForColor(
        cached,
        colorName
      );

      return (
        !cacheFlat(
          rows,
          "front"
        ) ||
        !cacheFlat(
          rows,
          "back"
        )
      );
    }
  );
}

/**
 * Applies one strict SanMar media policy:
 *
 * - exact Standard Product Information frontFlat/backFlat
 * - exact SFTP FRONT_FLAT/BACK_FLAT
 * - user/manual or clearly named flat fallback
 * - NEVER model/lifestyle/colorProductImage for the print garment
 */
export async function withPreferredSanMarFlatMedia<
  T extends {
    styleId: string;
    variants: any[];
    media?: FlatMediaMap;
  }
>(
  supabase: any,
  shopId: string,
  style: T
): Promise<
  T & {
    cached?: CachedStyleRow | null;
  }
> {
  const cached = await cachedStyle(
    supabase,
    shopId,
    style.styleId
  ).catch(() => null);

  const colors = Array.from(
    new Set(
      (style.variants || [])
        .map((variant: any) =>
          clean(
            variant.colorName
          )
        )
        .filter(Boolean)
    )
  );

  let live: FlatMediaMap = {};

  /*
    If the current cache does not have a trustworthy exact front AND back flat
    for every color, ask SanMar's Standard Product Information service directly.
    One request returns all style/color/size rows, so this is style-level, not
    one request per color.
  */
  if (
    needsLiveExactFlats(
      cached,
      colors
    )
  ) {
    live =
      await fetchExactFlatMedia(
        supabase,
        shopId,
        style.styleId
      ).catch(() => ({}));
  }

  const media: FlatMediaMap = {};

  for (const colorName of colors) {
    const variantsForColor = (
      style.variants || []
    ).filter(
      (variant: any) =>
        colorKey(
          variant.colorName
        ) === colorKey(colorName)
    );

    media[colorName] = {
      ...resolvedColorMedia({
        colorName,
        cached,
        live:
          live[colorName] || {},
        current:
          style.media?.[
            colorName
          ] || {},
        variantCandidates:
          variantsForColor
      }),
      imageChoices:
        style.media?.[colorName]?.imageChoices || []
    };
  }

  const variants = (
    style.variants || []
  ).map((variant: any) => {
    const preferred =
      media[
        variant.colorName
      ] || {};

    return {
      ...variant,
      frontImageUrl:
        preferred.frontImageUrl ||
        "",
      backImageUrl:
        preferred.backImageUrl ||
        "",
      swatchImageUrl:
        preferred.swatchImageUrl ||
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

function cloneConfiguration(
  value: any
) {
  return {
    ...(value || {}),

    colors: Array.isArray(
      value?.colors
    )
      ? value.colors.map(
          (color: any) => ({
            ...color
          })
        )
      : [],

    supplier:
      value?.supplier
        ? {
            ...value.supplier,

            variants:
              Array.isArray(
                value.supplier
                  .variants
              )
                ? value.supplier.variants.map(
                    (
                      variant: any
                    ) => ({
                      ...variant
                    })
                  )
                : []
          }
        : value?.supplier,

    customization:
      value?.customization
        ? {
            ...value.customization
          }
        : value?.customization
  };
}

async function applyFlatMediaToConfiguration(
  supabase: any,
  shopId: string,
  configuration: any,
  cached:
    | CachedStyleRow
    | null
    | undefined,
  allowLiveSanMarLookups = false
) {
  const next =
    cloneConfiguration(
      configuration
    );

  if (
    !Array.isArray(next.colors) ||
    !next.colors.length
  ) {
    return {
      configuration: next,
      changed: false
    };
  }

  const styleId = clean(
    next.supplier?.styleId
  ).toUpperCase();

  const colorNames = next.colors
    .map((color: any) =>
      clean(color?.name)
    )
    .filter(Boolean);

  let live: FlatMediaMap = {};

  if (
    allowLiveSanMarLookups &&
    styleId &&
    needsLiveExactFlats(
      cached,
      colorNames
    )
  ) {
    live =
      await fetchExactFlatMedia(
        supabase,
        shopId,
        styleId
      ).catch(() => ({}));
  }

  let changed = false;

  next.colors = next.colors.map(
    (color: any) => {
      const name = clean(
        color?.name
      );

      const preferred =
        resolvedColorMedia({
          colorName: name,
          cached,
          live:
            live[name] || {},
          current: {
            frontImageUrl:
              color?.frontImageUrl,
            backImageUrl:
              color?.backImageUrl,
            swatchImageUrl:
              color?.swatchImageUrl
          }
        });

      const front =
        preferred.frontImageUrl ||
        "";

      const back =
        preferred.backImageUrl ||
        "";

      const swatch =
        preferred.swatchImageUrl ||
        "";
      const imageChoices = Array.from(new Map([
        ...(Array.isArray(color?.imageChoices) ? color.imageChoices : []),
        ...cachedImageChoices(cached, name),
        ...(preferred.frontImageUrl ? [{ url: preferred.frontImageUrl, label: "Selected front image" }] : []),
        ...(preferred.backImageUrl ? [{ url: preferred.backImageUrl, label: "Selected back image" }] : [])
      ].filter((choice: any) => validUrl(choice.url)).map((choice: any) => [choice.url, choice] as const)).values())
        .sort((a, b) => a.label.localeCompare(b.label));

      if (
        front !==
          clean(
            color?.frontImageUrl
          ) ||
        back !==
          clean(
            color?.backImageUrl
          ) ||
        swatch !==
          clean(
            color?.swatchImageUrl
          ) || JSON.stringify(imageChoices) !== JSON.stringify(color?.imageChoices || [])
      ) {
        changed = true;
      }

      return {
        ...color,

        frontImageUrl:
          front || undefined,

        backImageUrl:
          back || undefined,

        swatchImageUrl:
          swatch || undefined,
        imageChoices
      };
    }
  );

  const visibleColors =
    next.colors.filter(
      (color: any) =>
        color?.active !== false
    );

  const defaultColor =
    visibleColors.find(
      (color: any) =>
        String(
          color?.id || ""
        ) ===
        String(
          next.defaultColorId ||
            ""
        )
    ) ||
    visibleColors[0] ||
    next.colors[0];

  const nextMockup = clean(
    defaultColor?.frontImageUrl
  );

  if (
    nextMockup !==
    clean(
      next.mockupImageUrl
    )
  ) {
    changed = true;

    next.mockupImageUrl =
      nextMockup || undefined;
  }

  return {
    configuration: next,
    changed
  };
}

/**
 * Repair old SanMar products as they are loaded.
 *
 * Public storefront:
 *   persist=false
 *   -> correct display immediately
 *
 * Dashboard -> Products:
 *   persist=true
 *   -> correct display AND save the repaired URLs back to catalog_products
 *
 * Only garment image URLs + mockupImageUrl are changed.
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
  options?: {
    persist?: boolean;
    /**
     * Live SanMar requests can take tens of seconds and must not run while
     * rendering a storefront or catalog page. Use the local SFTP cache there.
     */
    allowLiveSanMarLookups?: boolean;
  }
): Promise<T[]> {
  const styleIds = Array.from(
    new Set(
      rows
        .map((row) => {
          const supplier =
            row?.configuration
              ?.supplier;

          if (
            String(
              supplier?.provider ||
                ""
            ).toLowerCase() !==
            "sanmar"
          ) {
            return "";
          }

          return String(
            supplier?.styleId ||
              ""
          )
            .trim()
            .toUpperCase();
        })
        .filter(Boolean)
    )
  );

  if (!styleIds.length) {
    return rows;
  }

  const cachedByStyle =
    new Map<
      string,
      CachedStyleRow
    >();

  try {
    for (
      let index = 0;
      index < styleIds.length;
      index += 100
    ) {
      const batch = styleIds.slice(
        index,
        index + 100
      );

      const { data, error } =
        await supabase
          .from(
            "sanmar_catalog_styles"
          )
          .select(
            "style_id,category,variants"
          )
          .eq("shop_id", shopId)
          .in("style_id", batch);

      if (error) throw error;

      for (const row of data || []) {
        cachedByStyle.set(
          String(
            row.style_id || ""
          ).toUpperCase(),
          row as CachedStyleRow
        );
      }
    }
  } catch (error) {
    // Media repair is best-effort. If an older database has not yet received
    // the SanMar cache migration, show the saved product configuration instead
    // of making the entire product/storefront page fail to render.
    console.warn(
      "Skipping SanMar image hydration because the catalog cache is unavailable.",
      error instanceof Error ? error.message : String(error)
    );
    return rows;
  }

  const repaired: T[] = [];

  for (const row of rows) {
    const supplier =
      row?.configuration
        ?.supplier;

    const styleId = String(
      supplier?.styleId || ""
    )
      .trim()
      .toUpperCase();

    if (
      String(
        supplier?.provider || ""
      ).toLowerCase() !==
        "sanmar" ||
      !styleId
    ) {
      repaired.push(row);
      continue;
    }

    const cached =
      cachedByStyle.get(styleId);

    const result =
      await applyFlatMediaToConfiguration(
        supabase,
        shopId,
        row.configuration,
        cached,
        options?.allowLiveSanMarLookups === true
      );

    const nextRow = {
      ...row,
      configuration:
        result.configuration
    };

    repaired.push(nextRow);

    if (
      options?.persist &&
      result.changed &&
      row.id
    ) {
      const { error } =
        await supabase
          .from(
            "catalog_products"
          )
          .update({
            configuration:
              result.configuration,
            updated_at:
              new Date().toISOString()
          })
          .eq(
            "shop_id",
            shopId
          )
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
    flat:
      isSanMarFlatImage(
        value,
        side
      ),
    model:
      isSanMarModelImage(
        value
      ),
    sanmar:
      isSanMarUrl(value)
  };
}
