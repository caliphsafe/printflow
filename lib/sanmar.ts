import { decryptSecret } from "@/lib/crypto";
import {
  fetchSanMarInventory,
  fetchSanMarMedia,
  fetchSanMarPricing,
  fetchSanMarPromoProductData,
  fetchSanMarStandardProductInfo,
  sanmarNormalize,
  type SanMarConnection
} from "@/lib/sanmar-canonical";

type Connection = SanMarConnection;

export type SanMarNormalizedStyle = {
  styleId: string;
  name: string;
  description: string;
  brandName: string;
  variants: Array<{
    sku: string;
    skuId: string;
    gtin?: string;
    colorName: string;
    sizeName: string;
    customerPrice: number;
    quantity: number;
    active: boolean;
    uniqueKey?: string;
    inventoryKey?: string;
    sizeIndex?: string;
    catalogColor?: string;
    mainframeColor?: string;
  }>;
  media: Record<
    string,
    {
      frontImageUrl?: string;
      backImageUrl?: string;
      swatchImageUrl?: string;
    }
  >;
};

export type SanMarCatalogStyle = {
  styleId: string;
  brandName: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  colorCount: number;
  sizeCount: number;
  priceMin: number;
  priceMax: number;
};

const escapeXml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function decode(value: string) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(xml: string, name: string) {
  const match = String(xml || "").match(
    new RegExp(
      `<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`,
      "i"
    )
  );
  return match ? decode(match[1].replace(/<[^>]+>/g, "")) : "";
}

function blocks(xml: string, name: string) {
  return [
    ...String(xml || "").matchAll(
      new RegExp(
        `<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`,
        "gi"
      )
    )
  ].map((match) => match[1]);
}

function creds(row: Connection) {
  return {
    username: decryptSecret(row.encrypted_account_number),
    password: decryptSecret(row.encrypted_api_key),
    customerNumber: String(row.settings?.customerNumber || "").trim()
  };
}

function host(row: Connection) {
  const environment = String(row.settings?.environment || "production").toLowerCase();
  return environment === "test" || environment === "edev"
    ? "https://edev-ws.sanmar.com:8080"
    : "https://ws.sanmar.com:8080";
}

function envelope(body: string) {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`;
}

async function soap(url: string, body: string, timeoutMs = 45000) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "text/xml"
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await response.text();
  const fault = /<(?:[A-Za-z0-9_-]+:)?Fault\b/i.test(text);

  if (!response.ok || fault) {
    throw new Error(
      tag(text, "faultstring") ||
        tag(text, "message") ||
        `SanMar SOAP request failed (${response.status}).`
    );
  }

  const errorFlag = tag(text, "errorOccurred") || tag(text, "errorOccured");
  if (/^true$/i.test(errorFlag)) {
    throw new Error(tag(text, "message") || "SanMar returned an error.");
  }

  return text;
}

/**
 * Raw PromoStandards Product Data V2 request.
 * Production endpoint matches SanMar Web Services Guide v24.6.
 */
export async function sanmarGetProduct(row: Connection, style: string) {
  const c = creds(row);
  const url = `${host(row)}/promostandards/ProductDataServiceBindingV2`;

  return soap(
    url,
    envelope(
      `<ns:GetProductRequest xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" ` +
        `xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">` +
        `<shar:wsVersion>2.0.0</shar:wsVersion>` +
        `<shar:id>${escapeXml(c.username)}</shar:id>` +
        `<shar:password>${escapeXml(c.password)}</shar:password>` +
        `<shar:localizationCountry>us</shar:localizationCountry>` +
        `<shar:localizationLanguage>en</shar:localizationLanguage>` +
        `<shar:productId>${escapeXml(style.trim().toUpperCase())}</shar:productId>` +
        `</ns:GetProductRequest>`
    )
  );
}

/**
 * Raw SanMar Standard Pricing request. A style-only request returns all SKUs.
 */
export async function sanmarGetPricing(row: Connection, style: string) {
  const c = creds(row);
  if (!c.customerNumber) return "";

  const url = `${host(row)}/SanMarWebService/SanMarPricingServicePort`;

  return soap(
    url,
    envelope(
      `<impl:getPricing xmlns:impl="http://impl.webservice.integration.sanmar.com/">` +
        `<arg0><style>${escapeXml(style.trim().toUpperCase())}</style></arg0>` +
        `<arg1>` +
        `<sanMarCustomerNumber>${escapeXml(c.customerNumber)}</sanMarCustomerNumber>` +
        `<sanMarUserName>${escapeXml(c.username)}</sanMarUserName>` +
        `<sanMarUserPassword>${escapeXml(c.password)}</sanMarUserPassword>` +
        `</arg1>` +
        `</impl:getPricing>`
    )
  );
}

/**
 * Raw PromoStandards Inventory V2 request.
 *
 * IMPORTANT: v24.6 endpoint is InventoryServiceBindingV2final.
 * partIds are SanMar Unique_Key values and are limited to 200 per request.
 */
export async function sanmarGetInventory(
  row: Connection,
  style: string,
  partIds: string[]
) {
  const c = creds(row);
  const ids = Array.from(
    new Set(partIds.map((value) => String(value || "").trim()).filter(Boolean))
  ).slice(0, 200);

  const url = `${host(row)}/promostandards/InventoryServiceBindingV2final`;
  const parts = ids
    .map((id) => `<shar:partId>${escapeXml(id)}</shar:partId>`)
    .join("");

  return soap(
    url,
    envelope(
      `<ns:GetInventoryLevelsRequest xmlns:ns="http://www.promostandards.org/WSDL/Inventory/2.0.0/" ` +
        `xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">` +
        `<shar:wsVersion>2.0.0</shar:wsVersion>` +
        `<shar:id>${escapeXml(c.username)}</shar:id>` +
        `<shar:password>${escapeXml(c.password)}</shar:password>` +
        `<shar:productId>${escapeXml(style.trim().toUpperCase())}</shar:productId>` +
        `<shar:Filter><shar:partIdArray>${parts}</shar:partIdArray></shar:Filter>` +
        `</ns:GetInventoryLevelsRequest>`
    )
  );
}

/**
 * Raw PromoStandards Media Content request.
 * v24.6 endpoint is MediaContentServiceBinding.
 */
export async function sanmarGetMedia(row: Connection, style: string) {
  const c = creds(row);
  const url = `${host(row)}/promostandards/MediaContentServiceBinding`;

  return soap(
    url,
    envelope(
      `<ns:GetMediaContentRequest xmlns:ns="http://www.promostandards.org/WSDL/MediaService/1.0.0/" ` +
        `xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">` +
        `<shar:wsVersion>1.1.0</shar:wsVersion>` +
        `<shar:id>${escapeXml(c.username)}</shar:id>` +
        `<shar:password>${escapeXml(c.password)}</shar:password>` +
        `<shar:cultureName>en-us</shar:cultureName>` +
        `<shar:mediaType>Image</shar:mediaType>` +
        `<shar:productId>${escapeXml(style.trim().toUpperCase())}</shar:productId>` +
        `</ns:GetMediaContentRequest>`
    )
  );
}

/**
 * Standard Product Information by-category is ASYNCHRONOUS in SanMar v24.6.
 * The response is an acknowledgement and the generated CSV is written to FTP.
 * It must never be treated as an immediate product browser response.
 */
export async function sanmarGetProductInfoByCategory(
  row: Connection,
  category: string
) {
  const c = creds(row);
  if (!c.customerNumber) {
    throw new Error("SanMar customer number is required.");
  }

  const url = `${host(row)}/SanMarWebService/SanMarProductInfoServicePort`;

  return soap(
    url,
    envelope(
      `<impl:getProductInfoByCategory xmlns:impl="http://impl.webservice.integration.sanmar.com/">` +
        `<arg0><category>${escapeXml(category)}</category></arg0>` +
        `<arg1>` +
        `<sanMarCustomerNumber>${escapeXml(c.customerNumber)}</sanMarCustomerNumber>` +
        `<sanMarUserName>${escapeXml(c.username)}</sanMarUserName>` +
        `<sanMarUserPassword>${escapeXml(c.password)}</sanMarUserPassword>` +
        `</arg1>` +
        `</impl:getProductInfoByCategory>`
    ),
    55000
  );
}

export async function sanmarBrowseCategory(
  row: Connection,
  category: string
): Promise<SanMarCatalogStyle[]> {
  const xml = await sanmarGetProductInfoByCategory(row, category);
  const immediateRows = blocks(xml, "listResponse");

  // Keep backwards compatibility if SanMar ever returns rows directly, but
  // current v24.6 behavior is an async FTP export.
  if (!immediateRows.length) {
    throw new Error(
      tag(xml, "message") ||
        "SanMar category Product Information is asynchronous. Use the SFTP SDL_N/EPDD catalog cache for browsing."
    );
  }

  const grouped = new Map<string, SanMarCatalogStyle & { colors: Set<string>; sizes: Set<string>; prices: number[] }>();

  for (const rowXml of immediateRows) {
    const basic = blocks(rowXml, "productBasicInfo")[0] || rowXml;
    const image = blocks(rowXml, "productImageInfo")[0] || "";
    const priceInfo = blocks(rowXml, "productPriceInfo")[0] || "";
    const styleId = tag(basic, "style").trim().toUpperCase();
    if (!styleId) continue;

    const colorName = tag(basic, "color").trim();
    const sizeName = tag(basic, "size").trim();
    const price = Number(tag(priceInfo, "piecePrice") || 0);

    let item = grouped.get(styleId);
    if (!item) {
      item = {
        styleId,
        brandName: tag(basic, "brandName") || "SanMar",
        title: tag(basic, "productTitle") || styleId,
        description: tag(basic, "productDescription") || "",
        category,
        imageUrl:
          tag(image, "frontFlat") ||
          tag(image, "frontModel") ||
          tag(image, "colorProductImage") ||
          tag(image, "productImage") ||
          "",
        colorCount: 0,
        sizeCount: 0,
        priceMin: 0,
        priceMax: 0,
        colors: new Set<string>(),
        sizes: new Set<string>(),
        prices: []
      };
      grouped.set(styleId, item);
    }

    if (colorName) item.colors.add(colorName);
    if (sizeName) item.sizes.add(sizeName);
    if (Number.isFinite(price) && price > 0) item.prices.push(price);
  }

  return Array.from(grouped.values()).map((item) => ({
    styleId: item.styleId,
    brandName: item.brandName,
    title: item.title,
    description: item.description,
    category: item.category,
    imageUrl: item.imageUrl,
    colorCount: item.colors.size,
    sizeCount: item.sizes.size,
    priceMin: item.prices.length ? Math.min(...item.prices) : 0,
    priceMax: item.prices.length ? Math.max(...item.prices) : 0
  }));
}

/**
 * Legacy compatibility entry point.
 *
 * This no longer guesses colors from the first colorName inside ProductPart.
 * It unions Standard Product Information + PromoStandards Product Data by
 * SanMar Unique_Key and enriches the complete set with pricing/inventory/media.
 */
export async function sanmarNormalizedStyle(
  row: Connection,
  styleInput: string
): Promise<SanMarNormalizedStyle> {
  const styleId = styleInput.trim().toUpperCase();
  if (!styleId) throw new Error("Enter a SanMar style number.");

  const [standardResult, promoResult] = await Promise.allSettled([
    fetchSanMarStandardProductInfo(row, styleId),
    fetchSanMarPromoProductData(row, styleId)
  ]);

  const standard =
    standardResult.status === "fulfilled" ? standardResult.value : null;
  const promo =
    promoResult.status === "fulfilled" ? promoResult.value : null;

  if (!standard && !promo) {
    const standardError =
      standardResult.status === "rejected"
        ? standardResult.reason
        : undefined;
    const promoError =
      promoResult.status === "rejected"
        ? promoResult.reason
        : undefined;

    throw new Error(
      `Unable to load SanMar ${styleId}. Standard Product Information: ${
        standardError instanceof Error ? standardError.message : String(standardError || "failed")
      }. PromoStandards Product Data: ${
        promoError instanceof Error ? promoError.message : String(promoError || "failed")
      }.`
    );
  }

  const variants = new Map<string, any>();

  for (const source of [standard, promo]) {
    for (const variant of source?.variants || []) {
      const key =
        String(variant.uniqueKey || variant.sku || "").trim() ||
        `${sanmarNormalize(variant.colorName)}|${sanmarNormalize(variant.sizeName)}`;
      const current = variants.get(key);

      variants.set(key, {
        ...(current || {}),
        ...variant,
        colorName: current?.colorName || variant.colorName,
        sizeName: current?.sizeName || variant.sizeName,
        inventoryKey: current?.inventoryKey || variant.inventoryKey || "",
        sizeIndex: current?.sizeIndex || variant.sizeIndex || "",
        catalogColor: current?.catalogColor || variant.catalogColor || variant.colorName,
        mainframeColor: current?.mainframeColor || variant.mainframeColor || variant.catalogColor || variant.colorName,
        uniqueKey: current?.uniqueKey || variant.uniqueKey || variant.sku
      });
    }
  }

  let rows = Array.from(variants.values());
  const partIds = Array.from(
    new Set(rows.map((variant) => variant.uniqueKey || variant.sku).filter(Boolean))
  );
  const displayColorByPartId = new Map(
    rows.map((variant) => [variant.uniqueKey || variant.sku, variant.colorName])
  );

  const [pricingResult, inventoryResult, mediaResult] = await Promise.allSettled([
    fetchSanMarPricing(row, styleId),
    partIds.length
      ? fetchSanMarInventory(row, styleId, partIds)
      : Promise.resolve(new Map<string, number>()),
    fetchSanMarMedia(row, styleId, displayColorByPartId)
  ]);

  const pricing =
    pricingResult.status === "fulfilled" ? pricingResult.value : null;
  const inventory =
    inventoryResult.status === "fulfilled"
      ? inventoryResult.value
      : new Map<string, number>();
  const media =
    mediaResult.status === "fulfilled" ? mediaResult.value : {};

  rows = rows.map((variant) => {
    const customerPrice =
      (variant.inventoryKey && variant.sizeIndex
        ? pricing?.byInventoryAndSize.get(
            `${variant.inventoryKey}|${variant.sizeIndex}`
          )
        : undefined) ||
      pricing?.byCatalogColorAndSize.get(
        `${sanmarNormalize(
          variant.catalogColor || variant.mainframeColor || variant.colorName
        )}|${sanmarNormalize(variant.sizeName)}`
      ) ||
      variant.customerPrice ||
      0;

    const quantity = inventory.has(variant.uniqueKey || variant.sku)
      ? inventory.get(variant.uniqueKey || variant.sku) || 0
      : variant.quantity || 0;

    return {
      ...variant,
      customerPrice,
      quantity
    };
  });

  for (const variant of rows) {
    media[variant.colorName] ||= {};
    if (variant.frontImageUrl) {
      media[variant.colorName].frontImageUrl ||= variant.frontImageUrl;
    }
    if (variant.backImageUrl) {
      media[variant.colorName].backImageUrl ||= variant.backImageUrl;
    }
    if (variant.swatchImageUrl) {
      media[variant.colorName].swatchImageUrl ||= variant.swatchImageUrl;
    }
  }

  return {
    styleId,
    name: standard?.name || promo?.name || styleId,
    description: standard?.description || promo?.description || "",
    brandName: standard?.brandName || promo?.brandName || "SanMar",
    variants: rows.map((variant) => ({
      sku: variant.uniqueKey || variant.sku,
      skuId: variant.uniqueKey || variant.skuId || variant.sku,
      gtin: variant.gtin || undefined,
      colorName: variant.colorName,
      sizeName: variant.sizeName,
      customerPrice: Math.max(0, Number(variant.customerPrice || 0)),
      quantity: Math.max(0, Number(variant.quantity || 0)),
      active: variant.active !== false,
      uniqueKey: variant.uniqueKey || variant.sku,
      inventoryKey: variant.inventoryKey || "",
      sizeIndex: variant.sizeIndex || "",
      catalogColor: variant.catalogColor || variant.mainframeColor || variant.colorName,
      mainframeColor: variant.mainframeColor || variant.catalogColor || variant.colorName
    })),
    media
  };
}
