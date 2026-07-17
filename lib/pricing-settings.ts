import { pricingForPrintOrder } from "@/lib/catalog";
import type {
  CatalogProduct,
  DecorationPricingRule,
  FeeOverride,
  PricingAddOn,
  ProductPricingOverrides,
  ResolvedOrderPricing,
  SelectedPricingAddOn,
  ShopPricingProfile
} from "@/lib/types";

const money = (value: number) => Number(Math.max(0, value || 0).toFixed(2));
const percent = (value: number) => Math.min(500, Math.max(-100, Number(value || 0)));

export const DEFAULT_PRICING_PROFILE: ShopPricingProfile = {
  setupFee: {
    enabled: true,
    label: "Order setup",
    description: "Covers production setup, file preparation, and press-ready administration.",
    amount: 60
  },
  designOptimizationFee: {
    enabled: true,
    label: "Design optimization",
    description: "Optional professional cleanup and production adjustment by the print shop.",
    amount: 100
  },
  decorationServices: [
    { id: "screen-print", name: "Screen Print", percentageAdjustment: 0, active: true },
    { id: "dtf", name: "DTF", percentageAdjustment: 0, active: true },
    { id: "embroidery", name: "Embroidery", percentageAdjustment: 0, active: true },
    { id: "heat-transfer", name: "Heat Transfer", percentageAdjustment: 0, active: true }
  ],
  addOns: []
};

export const DEFAULT_PRODUCT_PRICING_OVERRIDES: ProductPricingOverrides = {
  setupFee: { mode: "inherit" },
  designOptimizationFee: { mode: "inherit" },
  decorationAdjustments: {},
  addOnModes: {}
};

function cleanId(value: unknown, fallback: string) {
  const normalized = String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return normalized || fallback;
}

function normalizeFee(value: any, fallback: ShopPricingProfile["setupFee"]) {
  return {
    enabled: value?.enabled !== false,
    label: String(value?.label || fallback.label).trim() || fallback.label,
    description: String(value?.description || fallback.description).trim(),
    amount: money(Number(value?.amount ?? fallback.amount))
  };
}

export function normalizePricingProfile(input: unknown): ShopPricingProfile {
  const raw = input && typeof input === "object" ? (input as any) : {};
  const services = Array.isArray(raw.decorationServices) ? raw.decorationServices : DEFAULT_PRICING_PROFILE.decorationServices;
  const addOns = Array.isArray(raw.addOns) ? raw.addOns : DEFAULT_PRICING_PROFILE.addOns;

  const normalizedServices: DecorationPricingRule[] = services.map((item: any, index: number) => ({
    id: cleanId(item?.id || item?.name, `service-${index + 1}`),
    name: String(item?.name || `Decoration ${index + 1}`).trim() || `Decoration ${index + 1}`,
    percentageAdjustment: percent(Number(item?.percentageAdjustment || 0)),
    active: item?.active !== false
  }));

  const normalizedAddOns: PricingAddOn[] = addOns.map((item: any, index: number) => ({
    id: cleanId(item?.id || item?.name, `add-on-${index + 1}`),
    name: String(item?.name || `Add-on ${index + 1}`).trim() || `Add-on ${index + 1}`,
    description: String(item?.description || "").trim(),
    amount: money(Number(item?.amount || 0)),
    pricingMode: item?.pricingMode === "per_item" ? "per_item" : "order",
    active: item?.active !== false,
    customerSelectable: item?.customerSelectable !== false,
    selectedByDefault: item?.selectedByDefault === true
  }));

  return {
    setupFee: normalizeFee(raw.setupFee, DEFAULT_PRICING_PROFILE.setupFee),
    designOptimizationFee: normalizeFee(raw.designOptimizationFee, DEFAULT_PRICING_PROFILE.designOptimizationFee),
    decorationServices: normalizedServices.length ? normalizedServices : DEFAULT_PRICING_PROFILE.decorationServices,
    addOns: normalizedAddOns
  };
}

function normalizeOverride(value: any): FeeOverride {
  const mode = value?.mode === "custom" || value?.mode === "disabled" ? value.mode : "inherit";
  return { mode, amount: mode === "custom" ? money(Number(value?.amount || 0)) : undefined };
}

export function normalizeProductPricingOverrides(input: unknown): ProductPricingOverrides {
  const raw = input && typeof input === "object" ? (input as any) : {};
  const decorations = raw.decorationAdjustments && typeof raw.decorationAdjustments === "object" ? raw.decorationAdjustments : {};
  const addOnModes = raw.addOnModes && typeof raw.addOnModes === "object" ? raw.addOnModes : {};
  return {
    setupFee: normalizeOverride(raw.setupFee),
    designOptimizationFee: normalizeOverride(raw.designOptimizationFee),
    decorationAdjustments: Object.fromEntries(
      Object.entries(decorations).map(([key, value]) => [key, value === null || value === "" ? null : percent(Number(value))])
    ),
    addOnModes: Object.fromEntries(
      Object.entries(addOnModes).map(([key, value]) => [key, value === "enabled" || value === "disabled" ? value : "inherit"])
    )
  };
}

function resolveFee(globalFee: ShopPricingProfile["setupFee"], override: FeeOverride) {
  if (override.mode === "disabled") return 0;
  if (override.mode === "custom") return money(Number(override.amount || 0));
  return globalFee.enabled ? money(globalFee.amount) : 0;
}

export function resolveSetupFee(profile: ShopPricingProfile, product: CatalogProduct) {
  return resolveFee(profile.setupFee, product.configuration.customization.pricingOverrides.setupFee);
}

export function resolveDesignOptimizationFee(profile: ShopPricingProfile, product: CatalogProduct) {
  return resolveFee(profile.designOptimizationFee, product.configuration.customization.pricingOverrides.designOptimizationFee);
}

export function decorationRuleFor(profile: ShopPricingProfile, product: CatalogProduct, method: string) {
  const key = cleanId(method, "decoration");
  const override = product.configuration.customization.pricingOverrides.decorationAdjustments[key];
  if (typeof override === "number") return { name: method, percentageAdjustment: percent(override) };
  const global = profile.decorationServices.find((item) => item.id === key || item.name.toLowerCase() === method.toLowerCase());
  return { name: method, percentageAdjustment: global?.active === false ? 0 : percent(global?.percentageAdjustment || 0) };
}

export function availableAddOns(profile: ShopPricingProfile, product: CatalogProduct) {
  const modes = product.configuration.customization.pricingOverrides.addOnModes;
  return profile.addOns.filter((item) => {
    const mode = modes[item.id] || "inherit";
    if (mode === "disabled") return false;
    if (mode === "enabled") return true;
    return item.active;
  });
}

export function calculateResolvedOrderPricing({
  profile,
  product,
  quantity,
  printSelections,
  decorationMethod,
  designOptimizationRequested,
  selectedAddOnIds
}: {
  profile: ShopPricingProfile;
  product: CatalogProduct;
  quantity: number;
  printSelections: Parameters<typeof pricingForPrintOrder>[2];
  decorationMethod: string;
  designOptimizationRequested: boolean;
  selectedAddOnIds: string[];
}): ResolvedOrderPricing {
  const base = pricingForPrintOrder(product.configuration.packages, quantity, printSelections);
  const decoration = decorationRuleFor(profile, product, decorationMethod);
  const multiplier = 1 + decoration.percentageAdjustment / 100;
  const frontPrintUnitPrice = money(base.frontPrintUnitPrice * multiplier);
  const backPrintUnitPrice = money(base.backPrintUnitPrice * multiplier);
  const unitPrice = money(base.garmentUnitPrice + frontPrintUnitPrice + backPrintUnitPrice);
  const merchandiseSubtotal = money(unitPrice * quantity);
  const setupFee = resolveSetupFee(profile, product);
  const designOptimizationFee = designOptimizationRequested ? resolveDesignOptimizationFee(profile, product) : 0;

  const addOns: SelectedPricingAddOn[] = availableAddOns(profile, product)
    .filter((item) => selectedAddOnIds.includes(item.id) || (!item.customerSelectable && item.selectedByDefault))
    .map((item) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      pricingMode: item.pricingMode,
      total: money(item.pricingMode === "per_item" ? item.amount * quantity : item.amount)
    }));
  const addOnTotal = money(addOns.reduce((sum, item) => sum + item.total, 0));
  const totalPrice = money(merchandiseSubtotal + setupFee + designOptimizationFee + addOnTotal);

  return {
    tierId: base.tier?.id,
    quantity,
    garmentUnitPrice: base.garmentUnitPrice,
    baseFrontPrintUnitPrice: base.frontPrintUnitPrice,
    baseBackPrintUnitPrice: base.backPrintUnitPrice,
    decorationMethod,
    decorationPercentage: decoration.percentageAdjustment,
    frontPrintUnitPrice,
    backPrintUnitPrice,
    unitPrice,
    merchandiseSubtotal,
    setupFee,
    designOptimizationRequested,
    designOptimizationFee,
    addOns,
    addOnTotal,
    totalPrice
  };
}
