import { decryptSecret } from "@/lib/crypto";

export type SanMarConnection = {
  encrypted_account_number: string;
  encrypted_api_key: string;
  settings?: Record<string, any> | null;
};

export type SanMarCanonicalVariant = {
  sku: string;
  skuId: string;
  uniqueKey: string;
  inventoryKey: string;
  sizeIndex: string;
  catalogColor: string;
  mainframeColor: string;
  colorName: string;
  sizeName: string;
  gtin?: string;
  customerPrice: number;
  quantity: number;
  active: boolean;
  frontImageUrl?: string;
  backImageUrl?: string;
  swatchImageUrl?: string;
  imageChoices?: SanMarImageChoice[];
  source?: "cache" | "standard-product-info" | "promostandards-product-data";
};

export type SanMarImageChoice = {
  url: string;
  label: string;
  classTypeId?: string;
};

export type SanMarStyleSource = {
  name?: string;
  description?: string;
  brandName?: string;
  variants: SanMarCanonicalVariant[];
};

export type SanMarPricingMaps = {
  byInventoryAndSize: Map<string, number>;
  byCatalogColorAndSize: Map<string, number>;
};

export type SanMarMediaMap = Record<
  string,
  {
    frontImageUrl?: string;
    backImageUrl?: string;
    swatchImageUrl?: string;
    imageChoices?: SanMarImageChoice[];
  }
>;

const decode = (value: string) =>
  String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

const escapeXml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export function sanmarXmlTag(xml: string, name: string) {
  const match = String(xml || "").match(
    new RegExp(
      `<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`,
      "i"
    )
  );

  return match ? decode(match[1].replace(/<[^>]+>/g, "")) : "";
}

export function sanmarXmlBlocks(xml: string, name: string) {
  return [
    ...String(xml || "").matchAll(
      new RegExp(
        `<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`,
        "gi"
      )
    )
  ].map((match) => match[1]);
}

function secureImage(value: string) {
  const raw = String(value || "").replace(/\s+/g, "").trim();
  if (!raw) return "";
  if (/^http:\/\//i.test(raw)) return raw.replace(/^http:\/\//i, "https://");
  return /^https:\/\//i.test(raw) ? raw : "";
}

function numeric(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[$,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sanmarNormalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function credentials(connection: SanMarConnection) {
  return {
    username: decryptSecret(connection.encrypted_account_number),
    password: decryptSecret(connection.encrypted_api_key),
    customerNumber: String(connection.settings?.customerNumber || "").trim()
  };
}

function apiHost(connection: SanMarConnection) {
  const environment = String(connection.settings?.environment || "production").toLowerCase();
  // SanMar v24.6 uses EDEV for the lower environment.
  return environment === "test" || environment === "edev"
    ? "https://edev-ws.sanmar.com:8080"
    : "https://ws.sanmar.com:8080";
}

function envelope(body: string) {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`;
}

async function soap(url: string, xml: string, timeoutMs = 45000) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "text/xml"
    },
    body: xml,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await response.text();
  const hasFault = /<(?:[A-Za-z0-9_-]+:)?Fault\b/i.test(text);

  if (!response.ok || hasFault) {
    throw new Error(
      sanmarXmlTag(text, "faultstring") ||
        sanmarXmlTag(text, "message") ||
        `SanMar SOAP request failed (${response.status}).`
    );
  }

  const errorFlag =
    sanmarXmlTag(text, "errorOccurred") ||
    sanmarXmlTag(text, "errorOccured");

  if (/^true$/i.test(errorFlag)) {
    throw new Error(
      sanmarXmlTag(text, "message") ||
        "SanMar returned an error for this request."
    );
  }

  return text;
}

function emptyVariant(partial: Partial<SanMarCanonicalVariant>): SanMarCanonicalVariant {
  const uniqueKey = String(partial.uniqueKey || partial.sku || partial.skuId || "").trim();
  return {
    sku: String(partial.sku || uniqueKey),
    skuId: String(partial.skuId || uniqueKey),
    uniqueKey,
    inventoryKey: String(partial.inventoryKey || ""),
    sizeIndex: String(partial.sizeIndex || ""),
    catalogColor: String(partial.catalogColor || partial.mainframeColor || partial.colorName || ""),
    mainframeColor: String(partial.mainframeColor || partial.catalogColor || partial.colorName || ""),
    colorName: String(partial.colorName || partial.catalogColor || ""),
    sizeName: String(partial.sizeName || ""),
    gtin: partial.gtin ? String(partial.gtin) : undefined,
    customerPrice: Math.max(0, Number(partial.customerPrice || 0)),
    quantity: Math.max(0, Number(partial.quantity || 0)),
    active: partial.active !== false,
    frontImageUrl: partial.frontImageUrl || "",
    backImageUrl: partial.backImageUrl || "",
    swatchImageUrl: partial.swatchImageUrl || "",
    imageChoices: partial.imageChoices || [],
    source: partial.source
  };
}

/**
 * SanMar Standard Product Information
 * getProductInfoByStyleColorSize(style only)
 *
 * SanMar v24.6 defines:
 * - color         = full website-facing color
 * - catalogColor  = SanMar mainframe/order color
 * - uniqueKey     = inventoryKey + sizeIndex, unique per style/color/size
 */
export async function fetchSanMarStandardProductInfo(
  connection: SanMarConnection,
  styleId: string
): Promise<SanMarStyleSource> {
  const style = styleId.trim().toUpperCase();
  const c = credentials(connection);

  if (!c.customerNumber) {
    throw new Error("SanMar customer number is missing.");
  }

  const url = `${apiHost(connection)}/SanMarWebService/SanMarProductInfoServicePort`;
  const xml = envelope(
    `<impl:getProductInfoByStyleColorSize xmlns:impl="http://impl.webservice.integration.sanmar.com/">` +
      `<arg0><style>${escapeXml(style)}</style></arg0>` +
      `<arg1>` +
      `<sanMarCustomerNumber>${escapeXml(c.customerNumber)}</sanMarCustomerNumber>` +
      `<sanMarUserName>${escapeXml(c.username)}</sanMarUserName>` +
      `<sanMarUserPassword>${escapeXml(c.password)}</sanMarUserPassword>` +
      `</arg1>` +
      `</impl:getProductInfoByStyleColorSize>`
  );

  const responseXml = await soap(url, xml);
  const variants = new Map<string, SanMarCanonicalVariant>();
  let name = "";
  let description = "";
  let brandName = "";

  for (const rowXml of sanmarXmlBlocks(responseXml, "listResponse")) {
    const basic = sanmarXmlBlocks(rowXml, "productBasicInfo")[0] || rowXml;
    const images = sanmarXmlBlocks(rowXml, "productImageInfo")[0] || "";
    const priceInfo = sanmarXmlBlocks(rowXml, "productPriceInfo")[0] || "";

    const returnedStyle = sanmarXmlTag(basic, "style").trim().toUpperCase();
    if (returnedStyle && returnedStyle !== style) continue;

    if (/discontinued/i.test(sanmarXmlTag(basic, "productStatus"))) continue;

    const colorName =
      sanmarXmlTag(basic, "color").trim() ||
      sanmarXmlTag(basic, "catalogColor").trim();
    const catalogColor =
      sanmarXmlTag(basic, "catalogColor").trim() ||
      colorName;
    const sizeName = sanmarXmlTag(basic, "size").trim();
    const inventoryKey = sanmarXmlTag(basic, "inventoryKey").trim();
    const sizeIndex = sanmarXmlTag(basic, "sizeIndex").trim();
    const uniqueKey =
      sanmarXmlTag(basic, "uniqueKey").trim() ||
      `${inventoryKey}${sizeIndex}`;

    if (!colorName || !sizeName || !uniqueKey) continue;

    name ||= sanmarXmlTag(basic, "productTitle");
    description ||= sanmarXmlTag(basic, "productDescription");
    brandName ||= sanmarXmlTag(basic, "brandName");

    const variant = emptyVariant({
      sku: uniqueKey,
      skuId: uniqueKey,
      uniqueKey,
      inventoryKey,
      sizeIndex,
      catalogColor,
      mainframeColor: catalogColor,
      colorName,
      sizeName,
      gtin: sanmarXmlTag(basic, "gtin") || undefined,
      customerPrice: numeric(
        sanmarXmlTag(priceInfo, "piecePrice") ||
          sanmarXmlTag(priceInfo, "casePrice")
      ),
      quantity: 0,
      active: true,
      frontImageUrl: secureImage(
        sanmarXmlTag(images, "frontFlat") ||
          sanmarXmlTag(images, "frontModel") ||
          sanmarXmlTag(images, "colorProductImage") ||
          sanmarXmlTag(images, "productImage")
      ),
      backImageUrl: secureImage(
        sanmarXmlTag(images, "backFlat") ||
          sanmarXmlTag(images, "backModel")
      ),
      imageChoices: ([
        ["Front flat", sanmarXmlTag(images, "frontFlat")],
        ["Back flat", sanmarXmlTag(images, "backFlat")],
        ["Front model", sanmarXmlTag(images, "frontModel")],
        ["Back model", sanmarXmlTag(images, "backModel")],
        ["Color product", sanmarXmlTag(images, "colorProductImage")],
        ["Product image", sanmarXmlTag(images, "productImage")],
        ["Swatch", sanmarXmlTag(images, "colorSquareImage") || sanmarXmlTag(images, "colorSwatchImage")]
      ] as Array<[string, string]>).flatMap(([label, value]) => {
        const url = secureImage(String(value || ""));
        return url ? [{ url, label: String(label) }] : [];
      }),
      swatchImageUrl: secureImage(
        sanmarXmlTag(images, "colorSquareImage") ||
          sanmarXmlTag(images, "colorSwatchImage")
      ),
      source: "standard-product-info"
    });

    variants.set(uniqueKey, variant);
  }

  if (!variants.size) {
    throw new Error(
      sanmarXmlTag(responseXml, "message") ||
        `SanMar Standard Product Information returned no variants for ${style}.`
    );
  }

  return {
    name: name || style,
    description,
    brandName: brandName || "SanMar",
    variants: Array.from(variants.values())
  };
}

/**
 * PromoStandards Product Data V2.
 *
 * ProductPart.partId is SanMar's Unique_Key. The end-user color must come
 * from ProductPart -> ColorArray -> Color -> standardColorName. The
 * ColorArray colorName is the backend/API color. primaryColor is explicitly
 * documented by SanMar as not being the field to use for this purpose.
 */
export async function fetchSanMarPromoProductData(
  connection: SanMarConnection,
  styleId: string
): Promise<SanMarStyleSource> {
  const style = styleId.trim().toUpperCase();
  const c = credentials(connection);
  const url = `${apiHost(connection)}/promostandards/ProductDataServiceBindingV2`;

  const xml = envelope(
    `<ns:GetProductRequest xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" ` +
      `xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">` +
      `<shar:wsVersion>2.0.0</shar:wsVersion>` +
      `<shar:id>${escapeXml(c.username)}</shar:id>` +
      `<shar:password>${escapeXml(c.password)}</shar:password>` +
      `<shar:localizationCountry>us</shar:localizationCountry>` +
      `<shar:localizationLanguage>en</shar:localizationLanguage>` +
      `<shar:productId>${escapeXml(style)}</shar:productId>` +
      `</ns:GetProductRequest>`
  );

  const responseXml = await soap(url, xml);
  const variants = new Map<string, SanMarCanonicalVariant>();

  for (const partXml of sanmarXmlBlocks(responseXml, "ProductPart")) {
    const uniqueKey = sanmarXmlTag(partXml, "partId").trim();
    const colorArray = sanmarXmlBlocks(partXml, "ColorArray")[0] || "";
    const colorBlock = sanmarXmlBlocks(colorArray, "Color")[0] || colorArray;
    const sizeBlock = sanmarXmlBlocks(partXml, "ApparelSize")[0] || partXml;

    const colorName =
      sanmarXmlTag(colorBlock, "standardColorName").trim() ||
      sanmarXmlTag(colorBlock, "colorName").trim();
    const catalogColor =
      sanmarXmlTag(colorBlock, "colorName").trim() ||
      colorName;
    const sizeName = sanmarXmlTag(sizeBlock, "labelSize").trim();

    if (!uniqueKey || !colorName || !sizeName) continue;

    variants.set(
      uniqueKey,
      emptyVariant({
        sku: uniqueKey,
        skuId: uniqueKey,
        uniqueKey,
        catalogColor,
        mainframeColor: catalogColor,
        colorName,
        sizeName,
        gtin: sanmarXmlTag(partXml, "gtin") || undefined,
        active: true,
        source: "promostandards-product-data"
      })
    );
  }

  if (!variants.size) {
    throw new Error(
      `SanMar PromoStandards Product Data returned no ProductPart variants for ${style}.`
    );
  }

  const descriptions = sanmarXmlBlocks(responseXml, "description")
    .map((item) => decode(item.replace(/<[^>]+>/g, "")))
    .filter(Boolean);

  return {
    name: sanmarXmlTag(responseXml, "productName") || style,
    description: descriptions.join(" ").trim(),
    brandName:
      sanmarXmlTag(responseXml, "productBrand") ||
      sanmarXmlTag(responseXml, "brandName") ||
      "SanMar",
    variants: Array.from(variants.values())
  };
}

export async function fetchSanMarPricing(
  connection: SanMarConnection,
  styleId: string
): Promise<SanMarPricingMaps> {
  const style = styleId.trim().toUpperCase();
  const c = credentials(connection);

  if (!c.customerNumber) {
    return {
      byInventoryAndSize: new Map(),
      byCatalogColorAndSize: new Map()
    };
  }

  const url = `${apiHost(connection)}/SanMarWebService/SanMarPricingServicePort`;
  const xml = envelope(
    `<impl:getPricing xmlns:impl="http://impl.webservice.integration.sanmar.com/">` +
      `<arg0><style>${escapeXml(style)}</style></arg0>` +
      `<arg1>` +
      `<sanMarCustomerNumber>${escapeXml(c.customerNumber)}</sanMarCustomerNumber>` +
      `<sanMarUserName>${escapeXml(c.username)}</sanMarUserName>` +
      `<sanMarUserPassword>${escapeXml(c.password)}</sanMarUserPassword>` +
      `</arg1>` +
      `</impl:getPricing>`
  );

  const responseXml = await soap(url, xml);
  const byInventoryAndSize = new Map<string, number>();
  const byCatalogColorAndSize = new Map<string, number>();

  for (const rowXml of sanmarXmlBlocks(responseXml, "listResponse")) {
    const price = numeric(
      sanmarXmlTag(rowXml, "myPrice") ||
        sanmarXmlTag(rowXml, "incentivePrice") ||
        sanmarXmlTag(rowXml, "salePrice") ||
        sanmarXmlTag(rowXml, "piecePrice")
    );
    if (price <= 0) continue;

    const inventoryKey = sanmarXmlTag(rowXml, "inventoryKey").trim();
    const sizeIndex = sanmarXmlTag(rowXml, "sizeIndex").trim();
    const color = sanmarXmlTag(rowXml, "color").trim();
    const size = sanmarXmlTag(rowXml, "size").trim();

    if (inventoryKey && sizeIndex) {
      byInventoryAndSize.set(`${inventoryKey}|${sizeIndex}`, price);
    }
    if (color && size) {
      byCatalogColorAndSize.set(
        `${sanmarNormalize(color)}|${sanmarNormalize(size)}`,
        price
      );
    }
  }

  return { byInventoryAndSize, byCatalogColorAndSize };
}

async function fetchInventoryBatch(
  connection: SanMarConnection,
  styleId: string,
  partIds: string[]
) {
  const c = credentials(connection);
  const style = styleId.trim().toUpperCase();
  const url = `${apiHost(connection)}/promostandards/InventoryServiceBindingV2final`;
  const parts = partIds
    .map((partId) => `<shar:partId>${escapeXml(partId)}</shar:partId>`)
    .join("");

  const xml = envelope(
    `<ns:GetInventoryLevelsRequest xmlns:ns="http://www.promostandards.org/WSDL/Inventory/2.0.0/" ` +
      `xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/">` +
      `<shar:wsVersion>2.0.0</shar:wsVersion>` +
      `<shar:id>${escapeXml(c.username)}</shar:id>` +
      `<shar:password>${escapeXml(c.password)}</shar:password>` +
      `<shar:productId>${escapeXml(style)}</shar:productId>` +
      `<shar:Filter><shar:partIdArray>${parts}</shar:partIdArray></shar:Filter>` +
      `</ns:GetInventoryLevelsRequest>`
  );

  return soap(url, xml);
}

export async function fetchSanMarInventory(
  connection: SanMarConnection,
  styleId: string,
  partIds: string[]
) {
  const uniquePartIds = Array.from(
    new Set(partIds.map((value) => String(value || "").trim()).filter(Boolean))
  );
  const quantities = new Map<string, number>();

  // SanMar v24.6 documents a max of 200 partIds per PartArray query.
  for (let index = 0; index < uniquePartIds.length; index += 200) {
    const batch = uniquePartIds.slice(index, index + 200);
    const responseXml = await fetchInventoryBatch(connection, styleId, batch);

    for (const partXml of sanmarXmlBlocks(responseXml, "PartInventory")) {
      const partId = sanmarXmlTag(partXml, "partId").trim();
      if (!partId) continue;

      const quantityBlock =
        sanmarXmlBlocks(partXml, "quantityAvailable")[0] || "";
      let quantity = numeric(sanmarXmlTag(quantityBlock, "value"));

      // Some responses expose location quantities without a top-level total.
      if (!quantityBlock) {
        quantity = sanmarXmlBlocks(partXml, "InventoryLocation")
          .map((locationXml) =>
            numeric(
              sanmarXmlTag(
                sanmarXmlBlocks(locationXml, "inventoryLocationQuantity")[0] ||
                  locationXml,
                "value"
              )
            )
          )
          .reduce((sum, value) => sum + value, 0);
      }

      quantities.set(partId, Math.max(0, quantity));
    }
  }

  return quantities;
}

export async function fetchSanMarMedia(
  connection: SanMarConnection,
  styleId: string,
  displayColorByPartId: Map<string, string>
): Promise<SanMarMediaMap> {
  const style = styleId.trim().toUpperCase();
  const c = credentials(connection);
  const url = `${apiHost(connection)}/promostandards/MediaContentServiceBinding`;

  const xml = envelope(
    `<ns:GetMediaContentRequest xmlns:ns="http://www.promostandards.org/WSDL/MediaService/1.0.0/" ` +
      `xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">` +
      `<shar:wsVersion>1.1.0</shar:wsVersion>` +
      `<shar:id>${escapeXml(c.username)}</shar:id>` +
      `<shar:password>${escapeXml(c.password)}</shar:password>` +
      `<shar:cultureName>en-us</shar:cultureName>` +
      `<shar:mediaType>Image</shar:mediaType>` +
      `<shar:productId>${escapeXml(style)}</shar:productId>` +
      `</ns:GetMediaContentRequest>`
  );

  const responseXml = await soap(url, xml);
  const media: SanMarMediaMap = {};
  const displayColors = Array.from(new Set(displayColorByPartId.values()));
  const matchingDisplayColor = (value: string) => displayColors.find(
    (color) => sanmarNormalize(color) === sanmarNormalize(value)
  );

  for (const mediaXml of sanmarXmlBlocks(responseXml, "MediaContent")) {
    const partId = sanmarXmlTag(mediaXml, "partId").trim();
    const colorFromResponse = sanmarXmlTag(mediaXml, "color").trim();
    const mappedColor = (partId ? displayColorByPartId.get(partId) : undefined)
      || matchingDisplayColor(colorFromResponse);
    const urlValue = secureImage(sanmarXmlTag(mediaXml, "url"));
    const classTypes = sanmarXmlBlocks(mediaXml, "ClassType").map((classType) => ({
      id: sanmarXmlTag(classType, "classTypeId").trim(),
      name: sanmarXmlTag(classType, "classTypeName").trim()
    })).filter((classType) => classType.id || classType.name);
    const classTypeId = classTypes.find((item) => ["1004", "1007", "1008"].includes(item.id))?.id
      || classTypes.find((item) => ["1006", "2001"].includes(item.id))?.id
      || sanmarXmlTag(mediaXml, "classTypeId").trim();
    const classTypeName = classTypes.map((item) => item.name).filter(Boolean).join(" · ") || sanmarXmlTag(mediaXml, "classTypeName").trim();

    if (!urlValue) continue;

    const classLabels: Record<string, string> = {
      "1004": "Swatch",
      "1006": "Primary product image",
      "1007": "Front",
      "1008": "Rear",
      "2001": "High resolution product image"
    };
    const label = classTypeName || classLabels[classTypeId] || `Product image (${classTypeId || "other"})`;
    // Some valid style-level media records have no color or a partId that
    // cannot be mapped to a returned variant. Keep them available for every
    // color rather than silently dropping them from the image picker.
    const targetColors = mappedColor ? [mappedColor] : displayColors.length ? displayColors : colorFromResponse ? [colorFromResponse] : [];
    for (const targetColor of targetColors) {
      media[targetColor] ||= {};
      media[targetColor].imageChoices ||= [];
      if (!media[targetColor].imageChoices.some((choice) => choice.url === urlValue)) {
        media[targetColor].imageChoices.push({ url: urlValue, label, ...(classTypeId ? { classTypeId } : {}) });
      }

      if (classTypes.some((item) => item.id === "1007" || /\bfront\b/i.test(item.name)) || classTypeId === "1007" || /\bfront\b/i.test(label)) {
        media[targetColor].frontImageUrl = urlValue;
      } else if (classTypes.some((item) => item.id === "1008" || /\b(rear|back)\b/i.test(item.name)) || classTypeId === "1008" || /\b(rear|back)\b/i.test(label)) {
        media[targetColor].backImageUrl = urlValue;
      } else if (classTypes.some((item) => item.id === "1004" || /swatch/i.test(item.name)) || classTypeId === "1004" || /swatch/i.test(label)) {
        media[targetColor].swatchImageUrl ||= urlValue;
      } else if (classTypes.some((item) => ["1006", "2001"].includes(item.id)) || classTypeId === "1006" || classTypeId === "2001") {
        media[targetColor].frontImageUrl ||= urlValue;
      }
    }
  }

  return media;
}
