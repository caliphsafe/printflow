import { asNumber, field, safeImageUrl, ssRequest } from "@/lib/ss-activewear";
import { decodeHtmlEntities } from "@/lib/html-entities";
import { defaultProductImage, uniqueProductImageChoices } from "@/lib/product-images";

// Keep S&S's SKU identifiers, account prices and color-specific media intact
// while presenting the same detail contract as the SanMar import wizard.
export function normalizeSSProduct(row: Record<string, unknown>) {
  const imageFields = [
    ["colorFrontImage", "Flat front", "flat-front"],
    ["colorBackImage", "Flat back", "flat-back"],
    ["colorSideImage", "Side", "ss-side"],
    ["colorDirectSideImage", "Direct side", "ss-direct-side"],
    ["colorOnModelFrontImage", "Model front", "ss-model-front"],
    ["colorOnModelBackImage", "Model back", "ss-model-back"],
    ["colorOnModelSideImage", "Model side", "ss-model-side"]
  ];
  const assets = field<unknown[]>(row, "mediaAssets");
  const imageChoices = uniqueProductImageChoices(
    imageFields.map(([key, label, classTypeId]) => ({ url: safeImageUrl(field(row, key), "large"), label, classTypeId })),
    (Array.isArray(assets) ? assets : []).flatMap((asset) => {
      if (!asset || typeof asset !== "object") return [];
      const entry = asset as Record<string, unknown>;
      const type = String(field(entry, "asset_type", "assetType") || "");
      // Style-level photos can show a different color; never mix them into a color gallery.
      if (!type || /style|swatch/i.test(type)) return [];
      const label = type.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
      return [{ url: safeImageUrl(field(entry, "image"), "large"), label }];
    })
  );
  const warehouses = field<unknown[]>(row, "warehouses");
  const quantity = field(row, "qty", "quantity");
  return {
    sku: String(field(row, "sku") || ""),
    skuId: String(field(row, "skuID_Master", "skuID", "skuId") || ""),
    gtin: String(field(row, "gtin") || ""),
    styleId: String(field(row, "styleID", "styleId") || ""),
    brandName: decodeHtmlEntities(field(row, "brandName")),
    styleName: decodeHtmlEntities(field(row, "styleName")),
    title: decodeHtmlEntities(field(row, "title")),
    colorName: String(field(row, "colorName") || "Unspecified"),
    sizeName: String(field(row, "sizeName") || "One Size"),
    sizeOrder: String(field(row, "sizeOrder") || ""),
    customerPrice: asNumber(field(row, "customerPrice")),
    quantity: quantity !== undefined ? asNumber(quantity) : (Array.isArray(warehouses) ? warehouses : []).reduce<number>((sum, entry) => sum + (entry && typeof entry === "object" ? asNumber(field(entry as Record<string, unknown>, "qty", "quantity")) : 0), 0),
    colorHex: String(field(row, "color1") || "#777777"),
    swatchImageUrl: safeImageUrl(field(row, "colorSwatchImage"), "large"),
    frontImageUrl: defaultProductImage(imageChoices, "front"),
    backImageUrl: defaultProductImage(imageChoices, "back"),
    sideImageUrl: safeImageUrl(field(row, "colorSideImage"), "large"),
    imageChoices,
    warehouses: Array.isArray(warehouses) ? warehouses : [],
    active: true
  };
}

export async function loadSSStyle(connection: Parameters<typeof ssRequest>[0], id: string) {
  const [styleRows, productRows] = await Promise.all([
    ssRequest<Record<string, unknown>[]>(connection, `/styles/?styleid=${encodeURIComponent(id)}&mediatype=json`),
    ssRequest<Record<string, unknown>[]>(connection, `/products/?styleid=${encodeURIComponent(id)}&mediatype=json`)
  ]);
  const summary = Array.isArray(styleRows) ? styleRows.find((row) => String(field(row, "styleID", "styleId")) === id) : undefined;
  if (!summary) throw new Error("S&S did not return the requested style.");
  const products = (Array.isArray(productRows) ? productRows : []).map(normalizeSSProduct).filter((row) => row.sku && row.styleId === id);
  if (!products.length) throw new Error("S&S returned no SKUs for this style.");
  const media: Record<string, { frontImageUrl: string; backImageUrl: string; swatchImageUrl: string; imageChoices: typeof products[number]["imageChoices"] }> = {};
  for (const product of products) {
    const previous = media[product.colorName];
    const imageChoices = uniqueProductImageChoices(previous?.imageChoices, product.imageChoices);
    media[product.colorName] = {
      frontImageUrl: defaultProductImage(imageChoices, "front"),
      backImageUrl: defaultProductImage(imageChoices, "back"),
      swatchImageUrl: previous?.swatchImageUrl || product.swatchImageUrl,
      imageChoices
    };
  }
  const brandName = decodeHtmlEntities(field(summary, "brandName"));
  const styleName = decodeHtmlEntities(field(summary, "styleName", "name"));
  const title = decodeHtmlEntities(field(summary, "title"));
  return {
    products,
    style: {
      styleId: id, brandName, styleName, title,
      name: `${brandName} ${styleName}${title ? ` | ${title}` : ""}`.trim(),
      description: decodeHtmlEntities(field(summary, "description")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      category: String(field(summary, "baseCategory", "baseCateogry") || "Apparel"),
      partNumber: String(field(summary, "partNumber") || ""),
      variants: products,
      media
    }
  };
}
