import {
  sanmarGetInventory,
  sanmarGetMedia,
  sanmarGetPricing,
  sanmarGetProduct,
  type SanMarNormalizedStyle
} from "@/lib/sanmar";

type Connection = {
  encrypted_account_number: string;
  encrypted_api_key: string;
  settings?: Record<string, any> | null;
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

function secureImage(value: string) {
  const trimmed = String(value || "")
    .replace(/\s+/g, "")
    .trim();

  if (!trimmed) return "";

  if (/^http:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, "https://");
  }

  return /^https:\/\//i.test(trimmed) ? trimmed : "";
}

type ParsedPart = {
  partId: string;
  displayColor: string;
  apiColor: string;
  size: string;
};

/**
 * Parse one SanMar ProductPart using the structure documented by SanMar.
 *
 * The important distinction is that ProductPart can contain BOTH primaryColor
 * and ColorArray. SanMar documents primaryColor as the "go to market" color
 * and says it is not used by SanMar. The customer-facing color is
 * ColorArray -> Color -> standardColorName.
 *
 * Reading the first colorName anywhere in ProductPart can therefore make many
 * different SKUs appear to have the same single color.
 */
function parsePart(partXml: string): ParsedPart | null {
  const partId = tag(partXml, "partId");

  const colorArrayXml = blocks(partXml, "ColorArray")[0] || "";
  const colorXml =
    blocks(colorArrayXml, "Color")[0] ||
    colorArrayXml;

  const displayColor =
    tag(colorXml, "standardColorName") ||
    tag(colorXml, "colorName") ||
    tag(partXml, "standardColorName");

  const apiColor =
    tag(colorXml, "colorName") ||
    displayColor;

  const apparelSizeXml =
    blocks(partXml, "ApparelSize")[0] ||
    partXml;

  const size = tag(apparelSizeXml, "labelSize");

  if (!partId || !displayColor || !size) {
    return null;
  }

  return {
    partId,
    displayColor,
    apiColor,
    size
  };
}

export async function sanmarNormalizedStyleCorrected(
  connection: Connection,
  styleInput: string
): Promise<SanMarNormalizedStyle> {
  const style = styleInput.trim().toUpperCase();

  if (!style) {
    throw new Error("Enter a SanMar style number.");
  }

  const productXml = await sanmarGetProduct(connection, style);
  const productBlocks = blocks(productXml, "ProductPart");

  if (!productBlocks.length) {
    throw new Error(
      `SanMar did not return variants for ${style}.`
    );
  }

  const parts = productBlocks
    .map(parsePart)
    .filter((part): part is ParsedPart => Boolean(part));

  if (!parts.length) {
    throw new Error(
      `SanMar returned ProductPart records for ${style}, but no usable color/size variants could be parsed.`
    );
  }

  const [pricingXml, inventoryXml, mediaXml] = await Promise.all([
    sanmarGetPricing(connection, style).catch(() => ""),
    sanmarGetInventory(
      connection,
      style,
      parts.map((part) => part.partId)
    ).catch(() => ""),
    sanmarGetMedia(connection, style)
  ]);

  const pricing = new Map<string, number>();

  for (const priceXml of blocks(pricingXml, "listResponse")) {
    const color = tag(priceXml, "color")
      .trim()
      .toLowerCase();

    const size = tag(priceXml, "size")
      .trim()
      .toLowerCase();

    if (!color || !size) continue;

    pricing.set(
      `${color}|${size}`,
      Number(
        tag(priceXml, "myPrice") ||
        tag(priceXml, "piecePrice") ||
        0
      )
    );
  }

  const inventory = new Map<string, number>();

  for (const inventoryBlock of blocks(inventoryXml, "PartInventory")) {
    const quantityBlock =
      blocks(inventoryBlock, "quantityAvailable")[0] ||
      inventoryBlock;

    inventory.set(
      tag(inventoryBlock, "partId"),
      Number(tag(quantityBlock, "value") || 0)
    );
  }

  const displayColorByPartId = new Map(
    parts.map((part) => [
      part.partId,
      part.displayColor
    ])
  );

  const media: SanMarNormalizedStyle["media"] = {};

  for (const mediaBlock of blocks(mediaXml, "MediaContent")) {
    const partId = tag(mediaBlock, "partId");
    const mediaColor = tag(mediaBlock, "color").trim();

    const color =
      (partId
        ? displayColorByPartId.get(partId)
        : undefined) ||
      mediaColor;

    const url = secureImage(tag(mediaBlock, "url"));

    if (!color || !url) continue;

    const classTypeId = tag(
      mediaBlock,
      "classTypeId"
    );

    media[color] = media[color] || {};

    if (
      classTypeId === "1007" ||
      classTypeId === "1006" ||
      /(?:^|[_/-])front(?:[_./-]|$)/i.test(url)
    ) {
      if (
        classTypeId === "1007" ||
        !media[color].frontImageUrl
      ) {
        media[color].frontImageUrl = url;
      }
    } else if (
      classTypeId === "1008" ||
      /(?:^|[_/-])(?:back|rear)(?:[_./-]|$)/i.test(url)
    ) {
      media[color].backImageUrl = url;
    } else if (
      classTypeId === "1004" ||
      /swatch/i.test(url)
    ) {
      media[color].swatchImageUrl = url;
    }
  }

  const description =
    tag(productXml, "description") ||
    `SanMar style ${style}`;

  const name =
    tag(productXml, "productName") ||
    style;

  const brandName =
    tag(productXml, "productBrand") ||
    tag(productXml, "brandName") ||
    tag(productXml, "brand") ||
    "SanMar";

  const variants = parts.map((part) => {
    const sizeKey = part.size.toLowerCase();

    const displayPriceKey =
      `${part.displayColor.toLowerCase()}|${sizeKey}`;

    const apiPriceKey =
      `${part.apiColor.toLowerCase()}|${sizeKey}`;

    return {
      sku: part.partId,
      skuId: part.partId,
      colorName: part.displayColor,
      sizeName: part.size,
      customerPrice:
        pricing.get(displayPriceKey) ||
        pricing.get(apiPriceKey) ||
        0,
      quantity:
        inventory.get(part.partId) ||
        0,
      active: true
    };
  });

  return {
    styleId: style,
    name,
    description,
    brandName,
    variants,
    media
  };
}
