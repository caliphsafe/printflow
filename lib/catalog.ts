import type { CatalogProduct, ProductConfiguration, ShopSettings, SupplierVariant } from "@/lib/types";

export const DEFAULT_CONFIGURATION: ProductConfiguration = {
  sizes: ["S", "M", "L", "XL", "2XL"],
  colors: [
    { id: "black", name: "Black", hex: "#171717" },
    { id: "white", name: "White", hex: "#f7f7f2" }
  ],
  printLocations: ["Front Center", "Back Center"],
  packages: [{ id: "12-shirts", label: "12 shirts", quantity: 12, price: 179, checkoutUrl: "" }],
  customization: {
    category: "T-Shirts", decorationMethods: ["Screen Print"],
    designModes: ["front", "back", "front-back"], frontEnabled: true, backEnabled: true,
    frontSurcharge: 0, backSurcharge: 0, twoSideSurcharge: 36, minimumQuantity: 12,
    frontPrintArea: { x: 250, y: 210, width: 300, height: 360 },
    backPrintArea: { x: 250, y: 190, width: 300, height: 390 },
    customerInstructions: "Choose a side, upload transparent artwork, and position it inside the print area."
  }
};

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product";
}

export function normalizeConfiguration(value: unknown): ProductConfiguration {
  const raw = (value ?? {}) as Partial<ProductConfiguration>;
  const supplierRaw = raw.supplier as ProductConfiguration["supplier"] | undefined;
  const custom = raw.customization || DEFAULT_CONFIGURATION.customization;
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
      id: String(item?.id || `package-${index + 1}`), label: String(item?.label || `${item?.quantity || 1} shirts`),
      quantity: Math.max(1, Number(item?.quantity || 1)), price: Math.max(0, Number(item?.price || 0)), checkoutUrl: String(item?.checkoutUrl || "")
    })) : DEFAULT_CONFIGURATION.packages,
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
      minimumQuantity: Math.max(1, Number(custom.minimumQuantity || 1)),
      frontPrintArea: custom.frontPrintArea || DEFAULT_CONFIGURATION.customization.frontPrintArea,
      backPrintArea: custom.backPrintArea || DEFAULT_CONFIGURATION.customization.backPrintArea,
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
