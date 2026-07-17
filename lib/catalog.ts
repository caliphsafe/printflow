import type { CatalogProduct, PrintArea, ProductConfiguration, ProductPackage, ShopSettings, SupplierVariant } from "@/lib/types";

export const CANVAS_PX_PER_INCH = 28;

export function inchesToPrintArea(area: PrintArea): PrintArea {
  const widthInches = Math.max(1, Number(area.widthInches ?? area.width / CANVAS_PX_PER_INCH));
  const heightInches = Math.max(1, Number(area.heightInches ?? area.height / CANVAS_PX_PER_INCH));
  const topInches = Math.max(0, Number(area.topInches ?? area.y / CANVAS_PX_PER_INCH));
  const width = Math.min(560, widthInches * CANVAS_PX_PER_INCH);
  const height = Math.min(560, heightInches * CANVAS_PX_PER_INCH);
  return { widthInches, heightInches, topInches, width, height, x: 400 - width / 2, y: Math.min(700 - height, topInches * CANVAS_PX_PER_INCH) };
}

export function tierUnitPrice(tier: ProductPackage) {
  return tier.quantity > 0 ? tier.price / tier.quantity : 0;
}

export function pricingForQuantity(tiers: ProductPackage[], quantity: number) {
  const sorted = [...tiers].sort((a, b) => a.quantity - b.quantity);
  const eligible = sorted.filter((tier) => quantity >= tier.quantity);
  const tier = eligible.at(-1) || sorted[0];
  const unitPrice = tier ? tierUnitPrice(tier) : 0;
  return { tier, unitPrice, basePrice: Number((unitPrice * quantity).toFixed(2)) };
}

export const DEFAULT_CONFIGURATION: ProductConfiguration = {
  sizes: ["S", "M", "L", "XL", "2XL"],
  colors: [
    { id: "black", name: "Black", hex: "#171717" },
    { id: "white", name: "White", hex: "#f7f7f2" }
  ],
  printLocations: ["Front Center", "Back Center"],
  packages: [
    { id: "12-plus", label: "12–23", quantity: 12, price: 216, checkoutUrl: "" },
    { id: "24-plus", label: "24–47", quantity: 24, price: 384, checkoutUrl: "" },
    { id: "48-plus", label: "48+", quantity: 48, price: 672, checkoutUrl: "" }
  ],
  customization: {
    category: "T-Shirts", decorationMethods: ["Screen Print"],
    designModes: ["front", "back", "front-back"], frontEnabled: true, backEnabled: true,
    frontSurcharge: 0, backSurcharge: 0, twoSideSurcharge: 36, minimumQuantity: 12,
    frontPrintArea: inchesToPrintArea({ x: 0, y: 0, width: 0, height: 0, widthInches: 11, heightInches: 13, topInches: 7.5 }),
    backPrintArea: inchesToPrintArea({ x: 0, y: 0, width: 0, height: 0, widthInches: 11, heightInches: 14, topInches: 6.8 }),
    customerInstructions: "Upload transparent, high-resolution artwork and keep important details inside the outlined print area."
  }
};

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product";
}

export function normalizeConfiguration(value: unknown): ProductConfiguration {
  const raw = (value ?? {}) as Partial<ProductConfiguration>;
  const supplierRaw = raw.supplier as ProductConfiguration["supplier"] | undefined;
  const custom = raw.customization || DEFAULT_CONFIGURATION.customization;
  const normalizeArea = (value: PrintArea | undefined, fallback: PrintArea) => inchesToPrintArea(value || fallback);
  return {
    sizes: Array.isArray(raw.sizes) && raw.sizes.length ? raw.sizes.map(String) : DEFAULT_CONFIGURATION.sizes,
    colors: Array.isArray(raw.colors) && raw.colors.length ? raw.colors.map((item, index) => ({
      id: String(item?.id || `color-${index + 1}`), name: String(item?.name || `Color ${index + 1}`), hex: String(item?.hex || "#111111"),
      swatchImageUrl: item?.swatchImageUrl ? String(item.swatchImageUrl) : undefined,
      frontImageUrl: item?.frontImageUrl ? String(item.frontImageUrl) : undefined,
      backImageUrl: item?.backImageUrl ? String(item.backImageUrl) : undefined,
      active: item?.active !== false
    })) : DEFAULT_CONFIGURATION.colors,
    printLocations: Array.isArray(raw.printLocations) && raw.printLocations.length ? raw.printLocations.map(String) : DEFAULT_CONFIGURATION.printLocations,
    packages: Array.isArray(raw.packages) && raw.packages.length ? raw.packages.map((item, index) => ({
      id: String(item?.id || `tier-${index + 1}`), label: String(item?.label || `${item?.quantity || 1}+`),
      quantity: Math.max(1, Number(item?.quantity || 1)), price: Math.max(0, Number(item?.price || 0)), checkoutUrl: String(item?.checkoutUrl || "")
    })).sort((a, b) => a.quantity - b.quantity) : DEFAULT_CONFIGURATION.packages,
    mockupImageUrl: raw.mockupImageUrl ? String(raw.mockupImageUrl) : undefined,
    customization: {
      category: String(custom.category || "T-Shirts"),
      decorationMethods: Array.isArray(custom.decorationMethods) && custom.decorationMethods.length ? custom.decorationMethods.map(String) : ["Screen Print"],
      designModes: Array.isArray(custom.designModes) && custom.designModes.length ? custom.designModes : ["front", "back", "front-back"],
      frontEnabled: custom.frontEnabled !== false,
      backEnabled: custom.backEnabled !== false,
      frontSurcharge: Math.max(0, Number(custom.frontSurcharge || 0)),
      backSurcharge: Math.max(0, Number(custom.backSurcharge || 0)),
      twoSideSurcharge: Math.max(0, Number(custom.twoSideSurcharge || 0)),
      minimumQuantity: Math.max(12, Number(custom.minimumQuantity || 12)),
      frontPrintArea: normalizeArea(custom.frontPrintArea, DEFAULT_CONFIGURATION.customization.frontPrintArea),
      backPrintArea: normalizeArea(custom.backPrintArea, DEFAULT_CONFIGURATION.customization.backPrintArea),
      customerInstructions: custom.customerInstructions ? String(custom.customerInstructions) : DEFAULT_CONFIGURATION.customization.customerInstructions
    },
    supplier: supplierRaw?.provider ? {
      provider: String(supplierRaw.provider), supplierName: supplierRaw.supplierName ? String(supplierRaw.supplierName) : undefined,
      styleId: String(supplierRaw.styleId), brandName: String(supplierRaw.brandName), styleName: String(supplierRaw.styleName),
      partNumber: supplierRaw.partNumber ? String(supplierRaw.partNumber) : undefined,
      importedAt: String(supplierRaw.importedAt || new Date().toISOString()),
      sourceMode: supplierRaw.sourceMode === "demo" || supplierRaw.sourceMode === "manual" ? supplierRaw.sourceMode : "live",
      variants: Array.isArray(supplierRaw.variants) ? supplierRaw.variants.map((item: SupplierVariant) => ({
        sku: String(item.sku), skuId: item.skuId ? String(item.skuId) : undefined, gtin: item.gtin ? String(item.gtin) : undefined,
        colorName: String(item.colorName), sizeName: String(item.sizeName), customerPrice: Math.max(0, Number(item.customerPrice || 0)),
        quantity: Math.max(0, Number(item.quantity || 0)), active: item.active !== false
      })) : []
    } : undefined
  };
}

export function legacyProductFromSettings(settings: ShopSettings): CatalogProduct {
  return { id: "legacy-product", slug: "custom-shirts", name: settings.product.name, description: settings.product.description ?? null, active: true,
    configuration: normalizeConfiguration({ sizes: settings.sizes, colors: settings.colors, printLocations: settings.printLocations, packages: settings.packages }) };
}
