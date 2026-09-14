import { decryptSecret } from "@/lib/crypto";
import {
  sanmarGetInventory,
  sanmarGetPricing,
  sanmarNormalizedStyle,
  type SanMarNormalizedStyle
} from "@/lib/sanmar";

type Connection = {
  encrypted_account_number: string;
  encrypted_api_key: string;
  settings?: Record<string, any> | null;
};

type ProductInfoVariant = {
  uniqueKey: string;
  inventoryKey: string;
  sizeIndex: string;
  displayColor: string;
  catalogColor: string;
  sizeName: string;
  piecePrice: number;
  brandName: string;
  title: string;
  description: string;
  frontImageUrl: string;
  backImageUrl: string;
  swatchImageUrl: string;
};

const decode = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

function tag(xml: string, name: string) {
  const match = xml.match(
    new RegExp(
      `<(?:(?:[A-Za-z0-9_-]+):)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:(?:[A-Za-z0-9_-]+):)?${name}>`,
      "i"
    )
  );

  return match
    ? decode(match[1].replace(/<[^>]+>/g, ""))
    : "";
}

function blocks(xml: string, name: string) {
  return [
    ...xml.matchAll(
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

function secureImage(value: string) {
  const raw = String(value || "")
    .replace(/\s+/g, "")
    .trim();

  if (!raw) return "";
  if (/^http:\/\//i.test(raw)) {
    return raw.replace(/^http:\/\//i, "https://");
  }

  return /^https:\/\//i.test(raw) ? raw : "";
}

function numberValue(value: string) {
  const amount = Number(
    String(value || "").replace(/[$,]/g, "")
  );
  return Number.isFinite(amount) ? amount : 0;
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function connectionCredentials(connection: Connection) {
  return {
    username: decryptSecret(connection.encrypted_account_number),
    password: decryptSecret(connection.encrypted_api_key),
    customerNumber: String(
      connection.settings?.customerNumber || ""
    ).trim()
  };
}

function productInfoHost(connection: Connection) {
  // SanMar's v24.6 guide names EDEV as the lower/test environment.
  return connection.settings?.environment === "test"
    ? "https://edev-ws.sanmar.com:8080"
    : "https://ws.sanmar.com:8080";
}

/**
 * SanMar Standard Product Information:
 * getProductInfoByStyleColorSize
 *
 * This is intentionally called with STYLE ONLY.
 *
 * SanMar's v24.6 guide explicitly says this method can search by:
 *   style
 *   style-color-size
 *   style-color
 *   style-size
 *
 * A style-only call returns the flattened style/color/size rows we need for
 * the customer catalog. Each listResponse includes the website color,
 * catalog/mainframe color, unique key, size, product images and base pricing.
 *
 * This is a much better source for exact color enumeration than trying to
 * infer colors from the nested PromoStandards ProductPart XML.
 */
async function getProductInfoByStyle(
  connection: Connection,
  styleId: string
) {
  const credentials = connectionCredentials(connection);

  if (!credentials.customerNumber) {
    throw new Error(
      "SanMar customer number is required to load complete style colors."
    );
  }

  const endpoint = String(
    connection.settings?.productInfoEndpoint ||
      `${productInfoHost(connection)}/SanMarWebService/SanMarProductInfoServicePort`
  );

  const body =
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:impl="http://impl.webservice.integration.sanmar.com/">` +
    `<soapenv:Header/><soapenv:Body>` +
    `<impl:getProductInfoByStyleColorSize>` +
    `<arg0><style>${escapeXml(styleId)}</style></arg0>` +
    `<arg1>` +
    `<sanMarCustomerNumber>${escapeXml(credentials.customerNumber)}</sanMarCustomerNumber>` +
    `<sanMarUserName>${escapeXml(credentials.username)}</sanMarUserName>` +
    `<sanMarUserPassword>${escapeXml(credentials.password)}</sanMarUserPassword>` +
    `</arg1>` +
    `</impl:getProductInfoByStyleColorSize>` +
    `</soapenv:Body></soapenv:Envelope>`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "text/xml"
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(45000)
  });

  const xml = await response.text();

  if (
    !response.ok ||
    /<(?:\w+:)?Fault\b/i.test(xml)
  ) {
    throw new Error(
      tag(xml, "faultstring") ||
        tag(xml, "message") ||
        `SanMar Product Information request failed (${response.status}).`
    );
  }

  const errorFlag =
    tag(xml, "errorOccured") ||
    tag(xml, "errorOccurred");

  if (/^true$/i.test(errorFlag)) {
    throw new Error(
      tag(xml, "message") ||
        `SanMar could not load style ${styleId}.`
    );
  }

  return xml;
}

function parseProductInfoRows(
  xml: string,
  requestedStyle: string
): ProductInfoVariant[] {
  const rows = blocks(xml, "listResponse");
  const variants = new Map<string, ProductInfoVariant>();

  for (const rowXml of rows) {
    const basic =
      blocks(rowXml, "productBasicInfo")[0] ||
      rowXml;

    const images =
      blocks(rowXml, "productImageInfo")[0] ||
      "";

    const priceInfo =
      blocks(rowXml, "productPriceInfo")[0] ||
      "";

    const rowStyle = tag(basic, "style")
      .trim()
      .toUpperCase();

    if (
      rowStyle &&
      rowStyle !== requestedStyle
    ) {
      continue;
    }

    const productStatus =
      tag(basic, "productStatus");

    if (/discontinued/i.test(productStatus)) {
      continue;
    }

    // SanMar v24.6:
    //   color        = Full Color Name / website-facing color.
    //   catalogColor = Mainframe color / ordering color.
    const displayColor =
      tag(basic, "color").trim() ||
      tag(basic, "catalogColor").trim();

    const catalogColor =
      tag(basic, "catalogColor").trim() ||
      displayColor;

    const sizeName = tag(basic, "size").trim();
    const inventoryKey =
      tag(basic, "inventoryKey").trim();
    const sizeIndex =
      tag(basic, "sizeIndex").trim();

    const uniqueKey =
      tag(basic, "uniqueKey").trim() ||
      `${inventoryKey}${sizeIndex}`;

    if (
      !displayColor ||
      !sizeName ||
      !uniqueKey
    ) {
      continue;
    }

    const frontImageUrl = secureImage(
      tag(images, "frontFlat") ||
        tag(images, "frontModel") ||
        tag(images, "colorProductImage") ||
        tag(images, "productImage")
    );

    const backImageUrl = secureImage(
      tag(images, "backFlat") ||
        tag(images, "backModel")
    );

    const swatchImageUrl = secureImage(
      tag(images, "colorSquareImage") ||
        tag(images, "colorSwatchImage")
    );

    const item: ProductInfoVariant = {
      uniqueKey,
      inventoryKey,
      sizeIndex,
      displayColor,
      catalogColor,
      sizeName,
      piecePrice: numberValue(
        tag(priceInfo, "piecePrice") ||
          tag(priceInfo, "casePrice")
      ),
      brandName:
        tag(basic, "brandName") ||
        "SanMar",
      title:
        tag(basic, "productTitle") ||
        `${requestedStyle}`,
      description:
        tag(basic, "productDescription") ||
        "",
      frontImageUrl,
      backImageUrl,
      swatchImageUrl
    };

    // uniqueKey is documented by SanMar as the unique identifier for one
    // style/color/size combination. It is the correct dedupe key here.
    variants.set(uniqueKey, item);
  }

  return Array.from(variants.values());
}

function parseAccountPricing(xml: string) {
  const byInventoryAndSize = new Map<string, number>();
  const byCatalogColorAndSize = new Map<string, number>();

  for (const rowXml of blocks(xml, "listResponse")) {
    const inventoryKey =
      tag(rowXml, "inventoryKey").trim();

    const sizeIndex =
      tag(rowXml, "sizeIndex").trim();

    const color =
      tag(rowXml, "color").trim();

    const size =
      tag(rowXml, "size").trim();

    const amount = numberValue(
      tag(rowXml, "myPrice") ||
        tag(rowXml, "incentivePrice") ||
        tag(rowXml, "salePrice") ||
        tag(rowXml, "piecePrice")
    );

    if (amount <= 0) continue;

    if (inventoryKey && sizeIndex) {
      byInventoryAndSize.set(
        `${inventoryKey}|${sizeIndex}`,
        amount
      );
    }

    if (color && size) {
      byCatalogColorAndSize.set(
        `${normalize(color)}|${normalize(size)}`,
        amount
      );
    }
  }

  return {
    byInventoryAndSize,
    byCatalogColorAndSize
  };
}

function parseInventory(xml: string) {
  const quantityByPartId = new Map<string, number>();

  for (const partXml of blocks(xml, "PartInventory")) {
    const partId = tag(partXml, "partId").trim();

    if (!partId) continue;

    // PromoStandards Inventory can include quantityAvailable at the part level.
    // If multiple values are present, summing them is safer than silently
    // keeping only the first warehouse/location quantity.
    const quantityBlocks =
      blocks(partXml, "quantityAvailable");

    let quantity = 0;

    if (quantityBlocks.length) {
      for (const quantityXml of quantityBlocks) {
        quantity += numberValue(
          tag(quantityXml, "value")
        );
      }
    } else {
      quantity = numberValue(
        tag(partXml, "value")
      );
    }

    quantityByPartId.set(partId, quantity);
  }

  return quantityByPartId;
}

/**
 * Correct SanMar exact-style normalizer.
 *
 * Source of truth for COLOR BREADTH:
 *   Standard Product Information getProductInfoByStyleColorSize(style only)
 *
 * Live enrichment:
 *   Standard Pricing getPricing(style only)
 *   PromoStandards Inventory using each returned uniqueKey as partId
 *
 * The existing sanmarCompleteStyle() then unions this result with the SFTP
 * SDL_N/EPDD cache, so neither source can accidentally shrink the color list.
 */
export async function sanmarNormalizedStyleCorrected(
  connection: Connection,
  styleInput: string
): Promise<SanMarNormalizedStyle> {
  const styleId = styleInput
    .trim()
    .toUpperCase();

  if (!styleId) {
    throw new Error(
      "Enter a SanMar style number."
    );
  }

  try {
    const productInfoXml =
      await getProductInfoByStyle(
        connection,
        styleId
      );

    const rows = parseProductInfoRows(
      productInfoXml,
      styleId
    );

    if (!rows.length) {
      throw new Error(
        `SanMar Product Information returned no style/color/size rows for ${styleId}.`
      );
    }

    const uniqueKeys = Array.from(
      new Set(
        rows
          .map((row) => row.uniqueKey)
          .filter(Boolean)
      )
    );

    const [pricingXml, inventoryXml] =
      await Promise.all([
        sanmarGetPricing(
          connection,
          styleId
        ).catch(() => ""),
        sanmarGetInventory(
          connection,
          styleId,
          uniqueKeys
        ).catch(() => "")
      ]);

    const accountPricing =
      parseAccountPricing(pricingXml);

    const inventory =
      parseInventory(inventoryXml);

    const media: SanMarNormalizedStyle["media"] =
      {};

    const variants = rows.map((row) => {
      const inventoryPrice =
        accountPricing.byInventoryAndSize.get(
          `${row.inventoryKey}|${row.sizeIndex}`
        );

      const colorSizePrice =
        accountPricing.byCatalogColorAndSize.get(
          `${normalize(row.catalogColor)}|${normalize(row.sizeName)}`
        );

      media[row.displayColor] =
        media[row.displayColor] || {};

      if (
        row.frontImageUrl &&
        !media[row.displayColor].frontImageUrl
      ) {
        media[row.displayColor].frontImageUrl =
          row.frontImageUrl;
      }

      if (
        row.backImageUrl &&
        !media[row.displayColor].backImageUrl
      ) {
        media[row.displayColor].backImageUrl =
          row.backImageUrl;
      }

      if (
        row.swatchImageUrl &&
        !media[row.displayColor].swatchImageUrl
      ) {
        media[row.displayColor].swatchImageUrl =
          row.swatchImageUrl;
      }

      return {
        sku: row.uniqueKey,
        skuId: row.uniqueKey,
        colorName: row.displayColor,
        sizeName: row.sizeName,
        customerPrice:
          inventoryPrice ||
          colorSizePrice ||
          row.piecePrice ||
          0,
        quantity:
          inventory.get(row.uniqueKey) ||
          0,
        active: true
      };
    });

    const first = rows[0];

    return {
      styleId,
      name:
        first.title ||
        styleId,
      description:
        first.description ||
        `SanMar style ${styleId}`,
      brandName:
        first.brandName ||
        "SanMar",
      variants,
      media
    };
  } catch (error) {
    // Keep the original PromoStandards path only as a last-resort fallback.
    // sanmarCompleteStyle() will still merge the SFTP cache afterward.
    try {
      return await sanmarNormalizedStyle(
        connection,
        styleId
      );
    } catch {
      throw error;
    }
  }
}
