import type { CatalogProduct } from "@/lib/types";
import type { BrandDesignProductRule, BrandLockedPlacement } from "@/lib/brand-types";

export type BrandPriceEnding = "whole" | "99" | "95";

export type BrandRetailProfile = {
  currency: string;
  defaultTargetMarginPercent: number;
  paymentReservePercent: number;
  packagingCostPerItem: number;
  fulfillmentCostPerItem: number;
  priceEnding: BrandPriceEnding;
  screenPrint: {
    basePerItem: number;
    extraColorPerItem: number;
  };
  dtf: {
    ratePerSquareInch: number;
    pressLaborPerItem: number;
  };
  embroidery: {
    ratePerThousandStitches: number;
    minimumPerItem: number;
  };
};

export const DEFAULT_BRAND_RETAIL_PROFILE: BrandRetailProfile = {
  currency: "USD",
  defaultTargetMarginPercent: 65,
  paymentReservePercent: 3,
  packagingCostPerItem: 0.75,
  fulfillmentCostPerItem: 0,
  priceEnding: "whole",
  screenPrint: {
    basePerItem: 3.5,
    extraColorPerItem: 0.75
  },
  dtf: {
    ratePerSquareInch: 0.06,
    pressLaborPerItem: 1.5
  },
  embroidery: {
    ratePerThousandStitches: 0.85,
    minimumPerItem: 5
  }
};

export type BrandProductConfiguration = {
  colorIds: string[];
  sizes: string[];
  inkColors: number;
  stitchEstimate: number;
  productionCostOverride?: number | null;
  inventoryMode: "supplier" | "unlimited";
  badge?: string;
};

export type BrandMerchProduct = {
  id: string;
  brand_garment_id: string;
  brand_design_id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  featured: boolean;
  pricing_mode: "manual" | "target_margin";
  retail_price: number;
  compare_at_price?: number | null;
  target_margin_percent?: number | null;
  placement_key: string;
  configuration: BrandProductConfiguration;
  sort_order: number;
};

export type BrandBusinessSettings = {
  active: boolean;
  logoUrl?: string;
  primaryColor: string;
  textColor: string;
  accentColor: string;
  surfaceColor: string;
  heroBadge: string;
  headline: string;
  introduction: string;
  trustMessage: string;
};

export type BrandBusinessProfile = {
  id?: string;
  name: string;
  settings: BrandBusinessSettings;
};

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function money(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function percent(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(95, number)) : fallback;
}

export function normalizeBrandRetailProfile(value: unknown): BrandRetailProfile {
  const source = record(value);
  const screen = record(source.screenPrint);
  const dtf = record(source.dtf);
  const embroidery = record(source.embroidery);
  const ending = source.priceEnding === "99" || source.priceEnding === "95" || source.priceEnding === "whole"
    ? source.priceEnding
    : DEFAULT_BRAND_RETAIL_PROFILE.priceEnding;

  return {
    currency: typeof source.currency === "string" && source.currency.trim() ? source.currency.trim().toUpperCase() : "USD",
    defaultTargetMarginPercent: percent(source.defaultTargetMarginPercent, DEFAULT_BRAND_RETAIL_PROFILE.defaultTargetMarginPercent),
    paymentReservePercent: percent(source.paymentReservePercent, DEFAULT_BRAND_RETAIL_PROFILE.paymentReservePercent),
    packagingCostPerItem: money(source.packagingCostPerItem, DEFAULT_BRAND_RETAIL_PROFILE.packagingCostPerItem),
    fulfillmentCostPerItem: money(source.fulfillmentCostPerItem, DEFAULT_BRAND_RETAIL_PROFILE.fulfillmentCostPerItem),
    priceEnding: ending,
    screenPrint: {
      basePerItem: money(screen.basePerItem, DEFAULT_BRAND_RETAIL_PROFILE.screenPrint.basePerItem),
      extraColorPerItem: money(screen.extraColorPerItem, DEFAULT_BRAND_RETAIL_PROFILE.screenPrint.extraColorPerItem)
    },
    dtf: {
      ratePerSquareInch: money(dtf.ratePerSquareInch, DEFAULT_BRAND_RETAIL_PROFILE.dtf.ratePerSquareInch),
      pressLaborPerItem: money(dtf.pressLaborPerItem, DEFAULT_BRAND_RETAIL_PROFILE.dtf.pressLaborPerItem)
    },
    embroidery: {
      ratePerThousandStitches: money(embroidery.ratePerThousandStitches, DEFAULT_BRAND_RETAIL_PROFILE.embroidery.ratePerThousandStitches),
      minimumPerItem: money(embroidery.minimumPerItem, DEFAULT_BRAND_RETAIL_PROFILE.embroidery.minimumPerItem)
    }
  };
}

export function normalizeBrandBusinessProfile(value: unknown, fallbackName: string): BrandBusinessProfile {
  const source = record(value);
  const settings = record(source.settings);
  return {
    id: typeof source.id === "string" ? source.id : undefined,
    name: typeof source.name === "string" && source.name.trim() ? source.name.trim() : fallbackName,
    settings: {
      active: settings.active === true,
      logoUrl: typeof settings.logoUrl === "string" ? settings.logoUrl : undefined,
      primaryColor: String(settings.primaryColor || "#171717"),
      textColor: String(settings.textColor || "#ffffff"),
      accentColor: String(settings.accentColor || "#d8ff5f"),
      surfaceColor: String(settings.surfaceColor || "#f4f4ef"),
      heroBadge: String(settings.heroBadge || "BRAND / MERCH"),
      headline: String(settings.headline || "Shop the brand."),
      introduction: String(settings.introduction || "Approved merchandise, ready to order."),
      trustMessage: String(settings.trustMessage || "Secure checkout · Production approved · Order updates")
    }
  };
}

export function normalizeBrandProductConfiguration(value: unknown, product?: CatalogProduct): BrandProductConfiguration {
  const source = record(value);
  const allColors = product?.configuration.colors.filter((item) => item.active !== false).map((item) => item.id) || [];
  const allSizes = product?.configuration.sizes || [];
  const colors = Array.isArray(source.colorIds) ? source.colorIds.map(String).filter((id: string) => !allColors.length || allColors.includes(id)) : allColors;
  const sizes = Array.isArray(source.sizes) ? source.sizes.map(String).filter((size: string) => !allSizes.length || allSizes.includes(size)) : allSizes;

  return {
    colorIds: colors.length ? colors : allColors,
    sizes: sizes.length ? sizes : allSizes,
    inkColors: Math.max(1, Math.min(12, Math.floor(Number(source.inkColors || 1)))),
    stitchEstimate: Math.max(1000, Math.floor(Number(source.stitchEstimate || 8000))),
    productionCostOverride: source.productionCostOverride === null || source.productionCostOverride === undefined || source.productionCostOverride === ""
      ? null
      : money(source.productionCostOverride),
    inventoryMode: source.inventoryMode === "unlimited" ? "unlimited" : "supplier",
    badge: typeof source.badge === "string" ? source.badge : ""
  };
}

export function findLockedPlacement(
  rule: BrandDesignProductRule | undefined,
  placementKey: string
): BrandLockedPlacement | null {
  if (!rule) return null;
  const placement = rule.placements?.[placementKey];
  return placement?.enabled ? placement : null;
}

export function supplierUnitCost(product: CatalogProduct, colorName?: string, sizeName?: string) {
  const supplier = product.configuration.supplier;
  if (!supplier) return Math.max(0, Number(product.configuration.manualUnitCost || 0));

  const active = supplier.variants.filter((item) => item.active !== false && Number(item.customerPrice) > 0);
  const exact = active.find((item) =>
    (!colorName || item.colorName === colorName) &&
    (!sizeName || item.sizeName === sizeName)
  );
  if (exact) return Number(exact.customerPrice);

  const matchingColor = active.find((item) => !colorName || item.colorName === colorName);
  if (matchingColor) return Number(matchingColor.customerPrice);

  const costs = active.map((item) => Number(item.customerPrice)).filter((value) => value > 0);
  return costs.length ? Math.min(...costs) : 0;
}


export function maxSupplierCostForOptions(product: CatalogProduct, colorIds: string[], sizes: string[]) {
  const supplier = product.configuration.supplier;
  if (!supplier) return Math.max(0, Number(product.configuration.manualUnitCost || 0));

  const colorNames = new Set(
    product.configuration.colors
      .filter((color) => colorIds.includes(color.id))
      .map((color) => color.name)
  );
  const sizeNames = new Set(sizes);

  const costs = supplier.variants
    .filter((item) =>
      item.active !== false &&
      Number(item.customerPrice) > 0 &&
      (!colorNames.size || colorNames.has(item.colorName)) &&
      (!sizeNames.size || sizeNames.has(item.sizeName))
    )
    .map((item) => Number(item.customerPrice));

  return costs.length ? Math.max(...costs) : supplierUnitCost(product);
}

export function estimateBrandProductionCost({
  profile,
  placement,
  inkColors = 1,
  stitchEstimate = 8000,
  override
}: {
  profile: BrandRetailProfile;
  placement: BrandLockedPlacement;
  inkColors?: number;
  stitchEstimate?: number;
  override?: number | null;
}) {
  if (override !== null && override !== undefined && Number.isFinite(Number(override))) {
    return Math.max(0, Number(override));
  }

  const method = placement.decorationMethod.toLowerCase();
  if (method.includes("dtf")) {
    const squareInches = Math.max(1, Number(placement.widthInches || 1) * Number(placement.heightInches || 1));
    return squareInches * profile.dtf.ratePerSquareInch + profile.dtf.pressLaborPerItem;
  }

  if (method.includes("embroider")) {
    const calculated = (Math.max(1000, stitchEstimate) / 1000) * profile.embroidery.ratePerThousandStitches;
    return Math.max(profile.embroidery.minimumPerItem, calculated);
  }

  return profile.screenPrint.basePerItem +
    Math.max(0, Math.max(1, inkColors) - 1) * profile.screenPrint.extraColorPerItem;
}

function roundRetail(value: number, ending: BrandPriceEnding) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (ending === "99") return Math.max(0.99, Math.ceil(value) - 0.01);
  if (ending === "95") return Math.max(0.95, Math.ceil(value) - 0.05);
  return Math.ceil(value);
}

export function recommendedRetailPrice({
  fixedUnitCost,
  targetMarginPercent,
  paymentReservePercent,
  ending
}: {
  fixedUnitCost: number;
  targetMarginPercent: number;
  paymentReservePercent: number;
  ending: BrandPriceEnding;
}) {
  const denominator = 1 - Math.max(0, targetMarginPercent) / 100 - Math.max(0, paymentReservePercent) / 100;
  const raw = denominator > 0.05 ? fixedUnitCost / denominator : fixedUnitCost * 2;
  return roundRetail(raw, ending);
}

export function calculateBrandEconomics({
  profile,
  supplierCost,
  placement,
  retailPrice,
  inkColors = 1,
  stitchEstimate = 8000,
  productionCostOverride
}: {
  profile: BrandRetailProfile;
  supplierCost: number;
  placement: BrandLockedPlacement;
  retailPrice: number;
  inkColors?: number;
  stitchEstimate?: number;
  productionCostOverride?: number | null;
}) {
  const productionCost = estimateBrandProductionCost({
    profile,
    placement,
    inkColors,
    stitchEstimate,
    override: productionCostOverride
  });
  const fixedCost = Math.max(0, supplierCost) + productionCost + profile.packagingCostPerItem + profile.fulfillmentCostPerItem;
  const paymentReserve = Math.max(0, retailPrice) * profile.paymentReservePercent / 100;
  const totalEstimatedCost = fixedCost + paymentReserve;
  const grossProfit = Math.max(0, retailPrice) - totalEstimatedCost;
  const marginPercent = retailPrice > 0 ? grossProfit / retailPrice * 100 : 0;

  return {
    supplierCost: Math.max(0, supplierCost),
    productionCost,
    packagingCost: profile.packagingCostPerItem,
    fulfillmentCost: profile.fulfillmentCostPerItem,
    paymentReserve,
    fixedCost,
    totalEstimatedCost,
    grossProfit,
    marginPercent
  };
}

export function resolvedBrandRetailPrice({
  profile,
  pricingMode,
  manualRetailPrice,
  targetMarginPercent,
  supplierCost,
  placement,
  inkColors,
  stitchEstimate,
  productionCostOverride
}: {
  profile: BrandRetailProfile;
  pricingMode: "manual" | "target_margin";
  manualRetailPrice: number;
  targetMarginPercent?: number | null;
  supplierCost: number;
  placement: BrandLockedPlacement;
  inkColors: number;
  stitchEstimate: number;
  productionCostOverride?: number | null;
}) {
  const productionCost = estimateBrandProductionCost({
    profile,
    placement,
    inkColors,
    stitchEstimate,
    override: productionCostOverride
  });
  const fixedUnitCost = supplierCost + productionCost + profile.packagingCostPerItem + profile.fulfillmentCostPerItem;

  if (pricingMode === "target_margin") {
    return recommendedRetailPrice({
      fixedUnitCost,
      targetMarginPercent: targetMarginPercent ?? profile.defaultTargetMarginPercent,
      paymentReservePercent: profile.paymentReservePercent,
      ending: profile.priceEnding
    });
  }

  return Math.max(0, Number(manualRetailPrice || 0));
}

export function safeBrandSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "product";
}
