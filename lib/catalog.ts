import type {
  CatalogProduct,
  DesignSide,
  PrintArea,
  PrintSize,
  ProductConfiguration,
  ProductPackage,
  ProductPricingOverrides,
  ShopSettings,
  SupplierVariant
} from "@/lib/types";


const DEFAULT_PRODUCT_PRICING_OVERRIDES: ProductPricingOverrides = {
  setupFee: { mode: "inherit" as const },
  designOptimizationFee: { mode: "inherit" as const },
  decorationAdjustments: {},
  addOnModes: {}
};

function normalizeProductPricingOverrides(input: unknown): ProductPricingOverrides {
  const raw = input && typeof input === "object" ? input as any : {};
  const normalizeFee = (value: any): ProductPricingOverrides["setupFee"] => {
    const mode: ProductPricingOverrides["setupFee"]["mode"] = value?.mode === "custom" || value?.mode === "disabled" ? value.mode : "inherit";
    return { mode, amount: mode === "custom" ? Math.max(0, Number(value?.amount || 0)) : undefined };
  };
  const decorations = raw.decorationAdjustments && typeof raw.decorationAdjustments === "object" ? raw.decorationAdjustments : {};
  const addOnModes = raw.addOnModes && typeof raw.addOnModes === "object" ? raw.addOnModes : {};
  return {
    setupFee: normalizeFee(raw.setupFee),
    designOptimizationFee: normalizeFee(raw.designOptimizationFee),
    decorationAdjustments: Object.fromEntries(Object.entries(decorations).map(([key, value]) => [key, value === null || value === "" ? null : Number(value) || 0])),
    addOnModes: Object.fromEntries(Object.entries(addOnModes).map(([key, value]) => [key, value === "enabled" || value === "disabled" ? value : "inherit"])) as ProductPricingOverrides["addOnModes"]
  };
}

export const CANVAS_SIZE = 800;
export const CANVAS_PX_PER_INCH = 24;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const money = (value: number) => Number(Math.max(0, value).toFixed(2));

export function normalizePrintArea(value: PrintArea | undefined, fallback: PrintArea): PrintArea {
  const raw = value || fallback;
  const width = clamp(Number(raw.width || fallback.width), 80, 650);
  const height = clamp(Number(raw.height || fallback.height), 80, 650);
  const x = clamp(Number(raw.x ?? fallback.x), 0, CANVAS_SIZE - width);
  const y = clamp(Number(raw.y ?? fallback.y), 0, CANVAS_SIZE - height);
  const widthInches = clamp(Number(raw.widthInches ?? fallback.widthInches ?? 4), 1, 20);
  const heightInches = clamp(Number(raw.heightInches ?? fallback.heightInches ?? 4), 1, 24);
  const aspect = widthInches / heightInches;
  let artworkWidth = clamp(Number(raw.artworkWidth ?? fallback.artworkWidth ?? Math.min(width, widthInches * CANVAS_PX_PER_INCH)), 40, width);
  let artworkHeight = artworkWidth / aspect;
  if (artworkHeight > height) {
    artworkHeight = height;
    artworkWidth = artworkHeight * aspect;
  }
  if (raw.artworkHeight && !raw.artworkWidth) {
    artworkHeight = clamp(Number(raw.artworkHeight), 40, height);
    artworkWidth = artworkHeight * aspect;
    if (artworkWidth > width) {
      artworkWidth = width;
      artworkHeight = artworkWidth / aspect;
    }
  }
  const defaultX = clamp(Number(raw.defaultX ?? fallback.defaultX ?? x + (width - artworkWidth) / 2), x, x + width - artworkWidth);
  const defaultY = clamp(Number(raw.defaultY ?? fallback.defaultY ?? y + (height - artworkHeight) / 2), y, y + height - artworkHeight);
  return {
    x,
    y,
    width,
    height,
    widthInches,
    heightInches,
    topInches: Number(raw.topInches ?? y / CANVAS_PX_PER_INCH),
    artworkWidth,
    artworkHeight,
    defaultX,
    defaultY
  };
}

/** Legacy helper kept for existing imports and older product data. */
export function inchesToPrintArea(area: PrintArea): PrintArea {
  const widthInches = Math.max(1, Number(area.widthInches ?? area.width / CANVAS_PX_PER_INCH));
  const heightInches = Math.max(1, Number(area.heightInches ?? area.height / CANVAS_PX_PER_INCH));
  const topInches = Math.max(0, Number(area.topInches ?? area.y / CANVAS_PX_PER_INCH));
  const width = Math.min(560, widthInches * CANVAS_PX_PER_INCH);
  const height = Math.min(560, heightInches * CANVAS_PX_PER_INCH);
  return normalizePrintArea(
    {
      ...area,
      widthInches,
      heightInches,
      topInches,
      width,
      height,
      x: area.x || 400 - width / 2,
      y: area.y || Math.min(700 - height, topInches * CANVAS_PX_PER_INCH),
      artworkWidth: area.artworkWidth || width,
      artworkHeight: area.artworkHeight || height
    },
    area
  );
}

export function tierGarmentUnitPrice(tier: ProductPackage) {
  if (Number.isFinite(Number(tier.garmentUnitPrice))) return money(Number(tier.garmentUnitPrice));
  return tier.quantity > 0 ? money(tier.price / tier.quantity) : 0;
}

/** Backwards-compatible alias used by older dashboard code. */
export function tierUnitPrice(tier: ProductPackage) {
  return tierGarmentUnitPrice(tier);
}

export function tierHeartUnitPrice(tier: ProductPackage) {
  return money(Number(tier.heartPrintUnitPrice || 0));
}

export function tierFullUnitPrice(tier: ProductPackage) {
  return money(Number(tier.fullPrintUnitPrice || 0));
}

export function pricingTierForQuantity(tiers: ProductPackage[], quantity: number) {
  const sorted = [...tiers].sort((a, b) => a.quantity - b.quantity);
  const eligible = sorted.filter((tier) => quantity >= tier.quantity);
  return eligible.at(-1) || sorted[0];
}

export function pricingForQuantity(tiers: ProductPackage[], quantity: number) {
  const tier = pricingTierForQuantity(tiers, quantity);
  const unitPrice = tier ? tierGarmentUnitPrice(tier) : 0;
  return { tier, unitPrice, basePrice: money(unitPrice * quantity) };
}

export function printUnitPrice(tier: ProductPackage | undefined, size?: PrintSize) {
  if (!tier || !size) return 0;
  return size === "heart" ? tierHeartUnitPrice(tier) : tierFullUnitPrice(tier);
}

export function pricingForPrintOrder(
  tiers: ProductPackage[],
  quantity: number,
  selections: Partial<Record<DesignSide, PrintSize>>
) {
  const tier = pricingTierForQuantity(tiers, quantity);
  const garmentUnitPrice = tier ? tierGarmentUnitPrice(tier) : 0;
  const frontPrintUnitPrice = printUnitPrice(tier, selections.front);
  const backPrintUnitPrice = printUnitPrice(tier, selections.back);
  const unitPrice = money(garmentUnitPrice + frontPrintUnitPrice + backPrintUnitPrice);
  return {
    tier,
    garmentUnitPrice,
    frontPrintUnitPrice,
    backPrintUnitPrice,
    unitPrice,
    totalPrice: money(unitPrice * quantity)
  };
}

export function printAreaFor(configuration: ProductConfiguration, side: DesignSide, size: PrintSize) {
  const custom = configuration.customization;
  if (side === "front") return size === "heart" ? custom.frontHeartArea : custom.frontFullArea;
  return size === "heart" ? custom.backHeartArea : custom.backFullArea;
}

const DEFAULT_FRONT_HEART: PrintArea = {
  x: 250,
  y: 170,
  width: 310,
  height: 210,
  widthInches: 4,
  heightInches: 4,
  artworkWidth: 104,
  artworkHeight: 104,
  defaultX: 330,
  defaultY: 220
};
const DEFAULT_BACK_HEART: PrintArea = { ...DEFAULT_FRONT_HEART, y: 165, defaultY: 215 };
const DEFAULT_FRONT_FULL: PrintArea = {
  x: 215,
  y: 170,
  width: 370,
  height: 470,
  widthInches: 14,
  heightInches: 18,
  artworkWidth: 330,
  artworkHeight: 424,
  defaultX: 235,
  defaultY: 190
};
const DEFAULT_BACK_FULL: PrintArea = { ...DEFAULT_FRONT_FULL, y: 155, defaultY: 175 };

export const DEFAULT_CONFIGURATION: ProductConfiguration = {
  sizes: ["S", "M", "L", "XL", "2XL"],
  colors: [
    { id: "black", name: "Black", hex: "#171717" },
    { id: "white", name: "White", hex: "#f7f7f2" }
  ],
  printLocations: ["Front", "Back"],
  manualUnitCost: 0,
  packages: [
    {
      id: "12-plus",
      label: "12–23",
      quantity: 12,
      price: 36,
      checkoutUrl: "",
      garmentUnitPrice: 3,
      heartPrintUnitPrice: 3,
      fullPrintUnitPrice: 5
    },
    {
      id: "24-plus",
      label: "24–47",
      quantity: 24,
      price: 67.2,
      checkoutUrl: "",
      garmentUnitPrice: 2.8,
      heartPrintUnitPrice: 2.75,
      fullPrintUnitPrice: 4.5
    },
    {
      id: "48-plus",
      label: "48+",
      quantity: 48,
      price: 120,
      checkoutUrl: "",
      garmentUnitPrice: 2.5,
      heartPrintUnitPrice: 2.5,
      fullPrintUnitPrice: 4
    }
  ],
  customization: {
    category: "T-Shirts",
    decorationMethods: ["Screen Print", "DTF", "Embroidery"],
    designModes: ["front", "back", "front-back"],
    frontEnabled: true,
    backEnabled: true,
    frontSurcharge: 0,
    backSurcharge: 0,
    twoSideSurcharge: 0,
    minimumQuantity: 12,
    frontPrintArea: normalizePrintArea(DEFAULT_FRONT_FULL, DEFAULT_FRONT_FULL),
    backPrintArea: normalizePrintArea(DEFAULT_BACK_FULL, DEFAULT_BACK_FULL),
    frontHeartArea: normalizePrintArea(DEFAULT_FRONT_HEART, DEFAULT_FRONT_HEART),
    frontFullArea: normalizePrintArea(DEFAULT_FRONT_FULL, DEFAULT_FRONT_FULL),
    backHeartArea: normalizePrintArea(DEFAULT_BACK_HEART, DEFAULT_BACK_HEART),
    backFullArea: normalizePrintArea(DEFAULT_BACK_FULL, DEFAULT_BACK_FULL),
    customerInstructions: "Upload transparent, high-resolution artwork. Choose Heart Size for a compact 4 × 4 inch print or Full Size for a print up to 14 × 18 inches.",
    pricingOverrides: DEFAULT_PRODUCT_PRICING_OVERRIDES
  }
};

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product";
}

export function normalizeConfiguration(value: unknown): ProductConfiguration {
  const raw = (value ?? {}) as Partial<ProductConfiguration>;
  const supplierRaw = raw.supplier as ProductConfiguration["supplier"] | undefined;
  const custom = raw.customization || DEFAULT_CONFIGURATION.customization;
  const legacyFront = normalizePrintArea(custom.frontPrintArea, DEFAULT_CONFIGURATION.customization.frontFullArea);
  const legacyBack = normalizePrintArea(custom.backPrintArea, DEFAULT_CONFIGURATION.customization.backFullArea);

  return {
    sizes: Array.isArray(raw.sizes) && raw.sizes.length ? raw.sizes.map(String) : DEFAULT_CONFIGURATION.sizes,
    colors: Array.isArray(raw.colors) && raw.colors.length
      ? raw.colors.map((item, index) => ({
          id: String(item?.id || `color-${index + 1}`),
          name: String(item?.name || `Color ${index + 1}`),
          hex: String(item?.hex || "#111111"),
          swatchImageUrl: item?.swatchImageUrl ? String(item.swatchImageUrl) : undefined,
          frontImageUrl: item?.frontImageUrl ? String(item.frontImageUrl) : undefined,
          backImageUrl: item?.backImageUrl ? String(item.backImageUrl) : undefined,
          active: item?.active !== false
        }))
      : DEFAULT_CONFIGURATION.colors,
    printLocations: Array.isArray(raw.printLocations) && raw.printLocations.length ? raw.printLocations.map(String) : DEFAULT_CONFIGURATION.printLocations,
    packages: Array.isArray(raw.packages) && raw.packages.length
      ? raw.packages
          .map((item, index) => {
            const quantity = Math.max(1, Number(item?.quantity || 1));
            const legacyGarment = quantity > 0 ? Number(item?.price || 0) / quantity : 0;
            const garmentUnitPrice = money(Number(item?.garmentUnitPrice ?? legacyGarment));
            const heartPrintUnitPrice = money(Number(item?.heartPrintUnitPrice ?? 0));
            const fullPrintUnitPrice = money(Number(item?.fullPrintUnitPrice ?? 0));
            return {
              id: String(item?.id || `tier-${index + 1}`),
              label: String(item?.label || `${quantity}+`),
              quantity,
              price: money(garmentUnitPrice * quantity),
              checkoutUrl: String(item?.checkoutUrl || ""),
              garmentUnitPrice,
              heartPrintUnitPrice,
              fullPrintUnitPrice
            };
          })
          .sort((a, b) => a.quantity - b.quantity)
      : DEFAULT_CONFIGURATION.packages,
    mockupImageUrl: raw.mockupImageUrl ? String(raw.mockupImageUrl) : undefined,
    manualUnitCost: Math.max(0, Number(raw.manualUnitCost ?? 0)),
    customization: {
      category: String(custom.category || "T-Shirts"),
      decorationMethods:
        Array.isArray(custom.decorationMethods) && custom.decorationMethods.length ? custom.decorationMethods.map(String) : ["Screen Print", "DTF", "Embroidery"],
      designModes: Array.isArray(custom.designModes) && custom.designModes.length ? custom.designModes : ["front", "back", "front-back"],
      frontEnabled: custom.frontEnabled !== false,
      backEnabled: custom.backEnabled !== false,
      frontSurcharge: 0,
      backSurcharge: 0,
      twoSideSurcharge: 0,
      minimumQuantity: Math.max(12, Number(custom.minimumQuantity || 12)),
      frontPrintArea: legacyFront,
      backPrintArea: legacyBack,
      frontHeartArea: normalizePrintArea(custom.frontHeartArea, DEFAULT_CONFIGURATION.customization.frontHeartArea),
      frontFullArea: normalizePrintArea(custom.frontFullArea || custom.frontPrintArea, DEFAULT_CONFIGURATION.customization.frontFullArea),
      backHeartArea: normalizePrintArea(custom.backHeartArea, DEFAULT_CONFIGURATION.customization.backHeartArea),
      backFullArea: normalizePrintArea(custom.backFullArea || custom.backPrintArea, DEFAULT_CONFIGURATION.customization.backFullArea),
      customerInstructions: custom.customerInstructions
        ? String(custom.customerInstructions)
        : DEFAULT_CONFIGURATION.customization.customerInstructions,
      pricingOverrides: normalizeProductPricingOverrides(custom.pricingOverrides)
    },
    supplier: supplierRaw?.provider
      ? {
          provider: String(supplierRaw.provider),
          supplierName: supplierRaw.supplierName ? String(supplierRaw.supplierName) : undefined,
          styleId: String(supplierRaw.styleId),
          brandName: String(supplierRaw.brandName),
          styleName: String(supplierRaw.styleName),
          partNumber: supplierRaw.partNumber ? String(supplierRaw.partNumber) : undefined,
          importedAt: String(supplierRaw.importedAt || new Date().toISOString()),
          sourceMode: supplierRaw.sourceMode === "demo" || supplierRaw.sourceMode === "manual" ? supplierRaw.sourceMode : "live",
          variants: Array.isArray(supplierRaw.variants)
            ? supplierRaw.variants.map((item: SupplierVariant) => ({
                sku: String(item.sku),
                skuId: item.skuId ? String(item.skuId) : undefined,
                gtin: item.gtin ? String(item.gtin) : undefined,
                colorName: String(item.colorName),
                sizeName: String(item.sizeName),
                customerPrice: Math.max(0, Number(item.customerPrice || 0)),
                quantity: Math.max(0, Number(item.quantity || 0)),
                active: item.active !== false
              }))
            : []
        }
      : undefined
  };
}

export function legacyProductFromSettings(settings: ShopSettings): CatalogProduct {
  return {
    id: "legacy-product",
    slug: "custom-shirts",
    name: settings.product.name,
    description: settings.product.description ?? null,
    active: true,
    configuration: normalizeConfiguration({
      sizes: settings.sizes,
      colors: settings.colors,
      printLocations: settings.printLocations,
      packages: settings.packages
    })
  };
}
