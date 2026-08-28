import { decryptSecret } from "@/lib/crypto";

type Connection = {
  encrypted_account_number: string;
  encrypted_api_key: string;
  settings?: Record<string, any> | null;
};

export type SanMarNormalizedStyle = {
  styleId: string;
  name: string;
  description: string;
  brandName: string;
  variants: Array<{
    sku: string;
    skuId: string;
    colorName: string;
    sizeName: string;
    customerPrice: number;
    quantity: number;
    active: boolean;
  }>;
  media: Record<string, {
    frontImageUrl?: string;
    backImageUrl?: string;
    swatchImageUrl?: string;
  }>;
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

const escapeXml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const decode = (v: string) =>
  v
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

function tag(xml: string, name: string) {
  const m = xml.match(
    new RegExp(
      `<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`,
      "i"
    )
  );
  return m ? decode(m[1].replace(/<[^>]+>/g, "")) : "";
}

function blocks(xml: string, name: string) {
  return [
    ...xml.matchAll(
      new RegExp(
        `<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`,
        "gi"
      )
    )
  ].map((m) => m[1]);
}

function creds(row: Connection) {
  return {
    username: decryptSecret(row.encrypted_account_number),
    password: decryptSecret(row.encrypted_api_key),
    customerNumber: String(row.settings?.customerNumber || "")
  };
}

function host(row: Connection) {
  return row.settings?.environment === "test"
    ? "https://test-ws.sanmar.com:8080"
    : "https://ws.sanmar.com:8080";
}

function secureImage(value: string) {
  const trimmed = String(value || "").replace(/\s+/g, "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://cdn.sanmar.com/")) {
    return trimmed.replace("http://", "https://");
  }
  return /^https:\/\//i.test(trimmed) ? trimmed : "";
}

async function soap(url: string, body: string, timeoutMs = 30000) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "text/xml"
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await r.text();

  if (!r.ok || /<(?:\w+:)?Fault\b/i.test(text)) {
    throw new Error(
      tag(text, "faultstring") ||
      tag(text, "message") ||
      `SanMar request failed (${r.status}).`
    );
  }

  return text;
}

const envelope = (body: string) =>
  `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`;

export async function sanmarGetProduct(row: Connection, style: string) {
  const c = creds(row);
  const url = String(
    row.settings?.productDataEndpoint ||
      `${host(row)}/promostandards/ProductDataServiceBindingV2`
  );

  const xml = envelope(
    `<ns:GetProductRequest xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/"><shar:wsVersion>2.0.0</shar:wsVersion><shar:id>${escapeXml(c.username)}</shar:id><shar:password>${escapeXml(c.password)}</shar:password><shar:localizationCountry>us</shar:localizationCountry><shar:localizationLanguage>en</shar:localizationLanguage><shar:productId>${escapeXml(style)}</shar:productId></ns:GetProductRequest>`
  );

  return soap(url, xml);
}

export async function sanmarGetPricing(row: Connection, style: string) {
  const c = creds(row);
  if (!c.customerNumber) return "";

  const url = String(
    row.settings?.pricingEndpoint ||
      `${host(row)}/SanMarWebService/SanMarPricingServicePort`
  );

  const xml = envelope(
    `<impl:getPricing xmlns:impl="http://impl.webservice.integration.sanmar.com/"><arg0><style>${escapeXml(style)}</style></arg0><arg1><sanMarCustomerNumber>${escapeXml(c.customerNumber)}</sanMarCustomerNumber><sanMarUserName>${escapeXml(c.username)}</sanMarUserName><sanMarUserPassword>${escapeXml(c.password)}</sanMarUserPassword></arg1></impl:getPricing>`
  );

  return soap(url, xml);
}

export async function sanmarGetInventory(
  row: Connection,
  style: string,
  partIds: string[]
) {
  const c = creds(row);
  const url = String(
    row.settings?.inventoryEndpoint ||
      `${host(row)}/promostandards/InventoryServiceBindingV2`
  );
  const parts = partIds
    .map((id) => `<shar:partId>${escapeXml(id)}</shar:partId>`)
    .join("");

  const xml = envelope(
    `<ns:GetInventoryLevelsRequest xmlns:ns="http://www.promostandards.org/WSDL/Inventory/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/Inventory/2.0.0/SharedObjects/"><shar:wsVersion>2.0.0</shar:wsVersion><shar:id>${escapeXml(c.username)}</shar:id><shar:password>${escapeXml(c.password)}</shar:password><shar:productId>${escapeXml(style)}</shar:productId><shar:Filter><shar:partIdArray>${parts}</shar:partIdArray></shar:Filter></ns:GetInventoryLevelsRequest>`
  );

  return soap(url, xml);
}

export async function sanmarGetMedia(row: Connection, style: string) {
  const c = creds(row);
  const url = String(
    row.settings?.mediaEndpoint ||
      `${host(row)}/promostandards/MediaServiceBinding`
  );

  const xml = envelope(
    `<ns:GetMediaContentRequest xmlns:ns="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/"><shar:wsVersion>1.1.0</shar:wsVersion><shar:id>${escapeXml(c.username)}</shar:id><shar:password>${escapeXml(c.password)}</shar:password><shar:cultureName>en-us</shar:cultureName><shar:mediaType>Image</shar:mediaType><shar:productId>${escapeXml(style)}</shar:productId></ns:GetMediaContentRequest>`
  );

  try {
    return await soap(url, xml);
  } catch {
    return "";
  }
}

/**
 * SanMar Standard Product Information Services:
 * getProductInfoByCategory.
 *
 * This is intentionally used as a browse/index call only. When a user opens a
 * style, sanmarNormalizedStyle() still performs the exact PromoStandards
 * ProductData + account pricing + live inventory + media calls.
 */
export async function sanmarGetProductInfoByCategory(
  row: Connection,
  category: string
) {
  const c = creds(row);

  if (!c.customerNumber) {
    throw new Error(
      "Your SanMar connection needs the customer number before the visual catalog can be browsed. Update the SanMar connection under Settings."
    );
  }

  const url = String(
    row.settings?.productInfoEndpoint ||
      `${host(row)}/SanMarWebService/SanMarProductInfoServicePort`
  );

  const xml = envelope(
    `<impl:getProductInfoByCategory xmlns:impl="http://impl.webservice.integration.sanmar.com/"><arg0><category>${escapeXml(category)}</category></arg0><arg1><sanMarCustomerNumber>${escapeXml(c.customerNumber)}</sanMarCustomerNumber><sanMarUserName>${escapeXml(c.username)}</sanMarUserName><sanMarUserPassword>${escapeXml(c.password)}</sanMarUserPassword></arg1></impl:getProductInfoByCategory>`
  );

  // Category payloads are much larger than exact-style requests.
  return soap(url, xml, 55000);
}

export async function sanmarBrowseCategory(
  row: Connection,
  category: string
): Promise<SanMarCatalogStyle[]> {
  const xml = await sanmarGetProductInfoByCategory(row, category);
  const rows = blocks(xml, "listResponse");

  if (!rows.length) {
    const message = tag(xml, "message");
    if (/ftp|csv|file/i.test(message)) {
      throw new Error(
        "SanMar moved this large category response to its FTP export instead of returning products immediately. Try the category again, use an exact style search, or contact SanMar integration support to enable reliable product-data browsing for this account."
      );
    }
    throw new Error(
      message || `SanMar returned no browseable products for ${category}.`
    );
  }

  type Group = SanMarCatalogStyle & {
    colors: Set<string>;
    sizes: Set<string>;
    prices: number[];
  };

  const grouped = new Map<string, Group>();

  for (const rowXml of rows) {
    const basic = blocks(rowXml, "productBasicInfo")[0] || rowXml;
    const images = blocks(rowXml, "productImageInfo")[0] || "";
    const priceInfo = blocks(rowXml, "productPriceInfo")[0] || "";

    const styleId = tag(basic, "style").trim().toUpperCase();
    if (!styleId) continue;

    const status = tag(basic, "productStatus");
    if (status && !/active/i.test(status)) continue;

    const brandName = tag(basic, "brandName") || "SanMar";
    const title =
      tag(basic, "productTitle") ||
      `${brandName} ${styleId}`;
    const description = tag(basic, "productDescription")
      .replace(/\s*\|\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const imageUrl = secureImage(
      tag(images, "frontFlat") ||
      tag(images, "frontModel") ||
      tag(images, "colorProductImage") ||
      tag(images, "productImage") ||
      tag(images, "thumbnailImage")
    );

    const price = Number(
      tag(priceInfo, "piecePrice") ||
      tag(priceInfo, "casePrice") ||
      0
    );

    const current = grouped.get(styleId) || {
      styleId,
      brandName,
      title,
      description,
      category,
      imageUrl,
      colorCount: 0,
      sizeCount: 0,
      priceMin: 0,
      priceMax: 0,
      colors: new Set<string>(),
      sizes: new Set<string>(),
      prices: []
    };

    if (!current.imageUrl && imageUrl) current.imageUrl = imageUrl;
    if (!current.description && description) current.description = description;

    const color = tag(basic, "color") || tag(basic, "catalogColor");
    const size = tag(basic, "size");
    if (color) current.colors.add(color);
    if (size) current.sizes.add(size);
    if (price > 0) current.prices.push(price);

    grouped.set(styleId, current);
  }

  return [...grouped.values()]
    .map((item) => ({
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
    }))
    .sort((a, b) =>
      `${a.brandName} ${a.styleId}`.localeCompare(
        `${b.brandName} ${b.styleId}`
      )
    );
}

export async function sanmarNormalizedStyle(
  row: Connection,
  styleInput: string
): Promise<SanMarNormalizedStyle> {
  const style = styleInput.trim().toUpperCase();
  if (!style) throw new Error("Enter a SanMar style number.");

  const productXml = await sanmarGetProduct(row, style);
  const productBlocks = blocks(productXml, "ProductPart");

  if (!productBlocks.length) {
    throw new Error(`SanMar did not return variants for ${style}.`);
  }

  const parts = productBlocks
    .map((b) => ({
      partId: tag(b, "partId"),
      color: tag(b, "colorName"),
      size: tag(b, "labelSize")
    }))
    .filter((p) => p.partId && p.color && p.size);

  const [pricingXml, inventoryXml, mediaXml] = await Promise.all([
    sanmarGetPricing(row, style).catch(() => ""),
    sanmarGetInventory(
      row,
      style,
      parts.map((p) => p.partId)
    ).catch(() => ""),
    sanmarGetMedia(row, style)
  ]);

  const pricing = new Map<string, number>();
  for (const b of blocks(pricingXml, "listResponse")) {
    const k = `${tag(b, "color").toLowerCase()}|${tag(
      b,
      "size"
    ).toLowerCase()}`;
    pricing.set(
      k,
      Number(tag(b, "myPrice") || tag(b, "piecePrice") || 0)
    );
  }

  const inventory = new Map<string, number>();
  for (const b of blocks(inventoryXml, "PartInventory")) {
    const q = blocks(b, "quantityAvailable")[0] || b;
    inventory.set(tag(b, "partId"), Number(tag(q, "value") || 0));
  }

  const media: Record<
    string,
    {
      frontImageUrl?: string;
      backImageUrl?: string;
      swatchImageUrl?: string;
    }
  > = {};

  for (const b of blocks(mediaXml, "MediaContent")) {
    const color = tag(b, "color");
    const u = secureImage(tag(b, "url"));
    if (!color || !u) continue;

    const cls = tag(b, "classTypeId");
    media[color] = media[color] || {};

    if (cls === "1007" || /front/i.test(u)) {
      media[color].frontImageUrl = u;
    } else if (cls === "1008" || /back|rear/i.test(u)) {
      media[color].backImageUrl = u;
    } else if (cls === "1004" || /swatch/i.test(u)) {
      media[color].swatchImageUrl = u;
    }
  }

  const description =
    tag(productXml, "description") || `SanMar style ${style}`;
  const name = tag(productXml, "productName") || style;
  const brandName =
    tag(productXml, "brandName") || tag(productXml, "brand") || "SanMar";

  const variants = parts.map((p) => ({
    sku: p.partId,
    skuId: p.partId,
    colorName: p.color,
    sizeName: p.size,
    customerPrice:
      pricing.get(`${p.color.toLowerCase()}|${p.size.toLowerCase()}`) || 0,
    quantity: inventory.get(p.partId) || 0,
    active: true
  }));

  return {
    styleId: style,
    name,
    description,
    brandName,
    variants,
    media
  };
}
