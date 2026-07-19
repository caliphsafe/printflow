import { printAreaFor } from "@/lib/catalog";
import type {
  ArtworkPlacement,
  CatalogProduct,
  DesignSide,
  DtfPricing,
  EmbroideryPricing,
  GarmentPricingLine,
  PricingAddOn,
  PrintPricingLine,
  PrintSize,
  QuantityDiscountTier,
  ResolvedOrderPricing,
  ScreenPrintingPricing,
  SelectedPricingAddOn,
  ShirtColor,
  ShopPricingProfile,
  SizeQuantity
} from "@/lib/types";

const money = (value: number) => Number(Math.max(0, Number(value || 0)).toFixed(2));
const percent = (value: number) => Math.min(95, Math.max(0, Number(value || 0)));
const integer = (value: number, minimum = 0) => Math.max(minimum, Math.round(Number(value || 0)));

const DEFAULT_DISCOUNTS: QuantityDiscountTier[] = [
  { id: "12", minQuantity: 12, discountPercent: 0 },
  { id: "36", minQuantity: 36, discountPercent: 10 },
  { id: "72", minQuantity: 72, discountPercent: 18 },
  { id: "144", minQuantity: 144, discountPercent: 25 }
];

export const DEFAULT_PRICING_PROFILE: ShopPricingProfile = {
  currency: "usd",
  garmentMarkupPercent: 10,
  orderSetupFee: {
    enabled: true,
    label: "Production setup",
    description: "Covers order preparation, production administration, and the minimum setup required to run a custom job.",
    amount: 60
  },
  designOptimizationFee: {
    enabled: true,
    label: "Professional design optimization",
    description: "Optional artwork cleanup, production preparation, and design adjustment by the print shop.",
    amount: 100
  },
  screenPrinting: {
    active: true,
    label: "Screen Printing",
    minimumQuantity: 12,
    maximumColors: 6,
    heartBasePerItem: 3,
    fullBasePerItem: 5,
    additionalColorPerItem: 1,
    setupPerScreen: 20,
    countWhiteUnderbase: true,
    additionalLocationDiscountPercent: 0,
    quantityDiscounts: DEFAULT_DISCOUNTS
  },
  dtf: {
    active: true,
    label: "DTF",
    minimumQuantity: 12,
    ratePerSquareInch: 0.055,
    pressFeePerLocation: 1.5,
    minimumPerLocation: 3,
    setupFee: 25,
    quantityDiscounts: DEFAULT_DISCOUNTS
  },
  embroidery: {
    active: true,
    label: "Embroidery",
    minimumQuantity: 12,
    ratePerThousandStitches: 0.85,
    minimumPerLocation: 6,
    setupPerLocation: 25,
    digitizingFee: 50,
    heartEstimatedStitches: 8000,
    fullEstimatedStitches: 25000,
    quantityDiscounts: DEFAULT_DISCOUNTS
  },
  addOns: []
};

function cleanId(value: unknown, fallback: string) {
  const normalized = String(value || fallback)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return normalized || fallback;
}

function normalizeFee(value: any, fallback: ShopPricingProfile["orderSetupFee"]) {
  return {
    enabled: value?.enabled !== false,
    label: String(value?.label || fallback.label).trim() || fallback.label,
    description: String(value?.description || fallback.description).trim(),
    amount: money(Number(value?.amount ?? fallback.amount))
  };
}

function normalizeDiscounts(value: unknown, fallback = DEFAULT_DISCOUNTS): QuantityDiscountTier[] {
  const raw = Array.isArray(value) ? value : fallback;
  const used = new Set<string>();
  const normalized = raw
    .map((item: any, index) => {
      const baseId = cleanId(item?.id || item?.minQuantity, `tier-${index + 1}`);
      let id = baseId;
      let suffix = 2;
      while (used.has(id)) id = `${baseId}-${suffix++}`;
      used.add(id);
      return {
        id,
        minQuantity: integer(item?.minQuantity ?? item?.quantity ?? 12, 1),
        discountPercent: percent(item?.discountPercent ?? item?.percentage ?? 0)
      };
    })
    .sort((a, b) => a.minQuantity - b.minQuantity);
  if (!normalized.length) return fallback;
  if (normalized[0].minQuantity > 12) normalized.unshift({ id: "tier-12-base", minQuantity: 12, discountPercent: 0 });
  return normalized;
}

function normalizeScreenPrinting(value: any): ScreenPrintingPricing {
  const fallback = DEFAULT_PRICING_PROFILE.screenPrinting;
  return {
    active: value?.active !== false,
    label: String(value?.label || fallback.label),
    minimumQuantity: integer(value?.minimumQuantity ?? fallback.minimumQuantity, 1),
    maximumColors: Math.min(12, integer(value?.maximumColors ?? fallback.maximumColors, 1)),
    heartBasePerItem: money(value?.heartBasePerItem ?? fallback.heartBasePerItem),
    fullBasePerItem: money(value?.fullBasePerItem ?? fallback.fullBasePerItem),
    additionalColorPerItem: money(value?.additionalColorPerItem ?? fallback.additionalColorPerItem),
    setupPerScreen: money(value?.setupPerScreen ?? fallback.setupPerScreen),
    countWhiteUnderbase: value?.countWhiteUnderbase !== false,
    additionalLocationDiscountPercent: percent(value?.additionalLocationDiscountPercent ?? fallback.additionalLocationDiscountPercent),
    quantityDiscounts: normalizeDiscounts(value?.quantityDiscounts, fallback.quantityDiscounts)
  };
}

function normalizeDtf(value: any): DtfPricing {
  const fallback = DEFAULT_PRICING_PROFILE.dtf;
  return {
    active: value?.active !== false,
    label: String(value?.label || fallback.label),
    minimumQuantity: integer(value?.minimumQuantity ?? fallback.minimumQuantity, 1),
    ratePerSquareInch: Math.max(0, Number(value?.ratePerSquareInch ?? fallback.ratePerSquareInch)),
    pressFeePerLocation: money(value?.pressFeePerLocation ?? fallback.pressFeePerLocation),
    minimumPerLocation: money(value?.minimumPerLocation ?? fallback.minimumPerLocation),
    setupFee: money(value?.setupFee ?? fallback.setupFee),
    quantityDiscounts: normalizeDiscounts(value?.quantityDiscounts, fallback.quantityDiscounts)
  };
}

function normalizeEmbroidery(value: any): EmbroideryPricing {
  const fallback = DEFAULT_PRICING_PROFILE.embroidery;
  return {
    active: value?.active !== false,
    label: String(value?.label || fallback.label),
    minimumQuantity: integer(value?.minimumQuantity ?? fallback.minimumQuantity, 1),
    ratePerThousandStitches: Math.max(0, Number(value?.ratePerThousandStitches ?? fallback.ratePerThousandStitches)),
    minimumPerLocation: money(value?.minimumPerLocation ?? fallback.minimumPerLocation),
    setupPerLocation: money(value?.setupPerLocation ?? fallback.setupPerLocation),
    digitizingFee: money(value?.digitizingFee ?? fallback.digitizingFee),
    heartEstimatedStitches: integer(value?.heartEstimatedStitches ?? fallback.heartEstimatedStitches, 1000),
    fullEstimatedStitches: integer(value?.fullEstimatedStitches ?? fallback.fullEstimatedStitches, 1000),
    quantityDiscounts: normalizeDiscounts(value?.quantityDiscounts, fallback.quantityDiscounts)
  };
}

export function normalizePricingProfile(input: unknown): ShopPricingProfile {
  const raw = input && typeof input === "object" ? (input as any) : {};
  const legacySetup = raw.orderSetupFee || raw.setupFee;
  const addOns = Array.isArray(raw.addOns) ? raw.addOns : [];
  const normalizedAddOns: PricingAddOn[] = addOns.map((item: any, index: number) => ({
    id: cleanId(item?.id || item?.name, `add-on-${index + 1}`),
    name: String(item?.name || `Add-on ${index + 1}`).trim() || `Add-on ${index + 1}`,
    description: String(item?.description || "").trim(),
    amount: money(item?.amount || 0),
    pricingMode: item?.pricingMode === "per_item" ? "per_item" : "order",
    active: item?.active !== false,
    customerSelectable: item?.customerSelectable !== false,
    selectedByDefault: item?.selectedByDefault === true
  }));

  return {
    currency: String(raw.currency || "usd").toLowerCase(),
    garmentMarkupPercent: Math.min(500, Math.max(0, Number(raw.garmentMarkupPercent ?? 10))),
    orderSetupFee: normalizeFee(legacySetup, DEFAULT_PRICING_PROFILE.orderSetupFee),
    designOptimizationFee: normalizeFee(raw.designOptimizationFee, DEFAULT_PRICING_PROFILE.designOptimizationFee),
    screenPrinting: normalizeScreenPrinting(raw.screenPrinting),
    dtf: normalizeDtf(raw.dtf),
    embroidery: normalizeEmbroidery(raw.embroidery),
    addOns: normalizedAddOns
  };
}

export function availableAddOns(profile: ShopPricingProfile, _product?: CatalogProduct) {
  return profile.addOns.filter((item) => item.active);
}

export function resolveDesignOptimizationFee(profile: ShopPricingProfile, _product?: CatalogProduct) {
  return profile.designOptimizationFee.enabled ? profile.designOptimizationFee.amount : 0;
}

/** Compatibility helper used by older UI; v8 pricing uses method-specific matrices instead. */
export function decorationRuleFor(_profile: ShopPricingProfile, _product: CatalogProduct, method: string) {
  return { name: method, percentageAdjustment: 0 };
}

function discountForQuantity(tiers: QuantityDiscountTier[], quantity: number) {
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  return sorted.filter((item) => quantity >= item.minQuantity).at(-1) || sorted[0] || { id: "base", minQuantity: 1, discountPercent: 0 };
}

function normalizeMethod(method: string): "screen-print" | "dtf" | "embroidery" {
  const value = method.toLowerCase().replace(/[^a-z]/g, "");
  if (value.includes("embroider")) return "embroidery";
  if (value.includes("dtf") || value.includes("directtofilm")) return "dtf";
  return "screen-print";
}

function isDarkColor(color?: ShirtColor) {
  const hex = String(color?.hex || "#ffffff").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 145;
}

function supplierUnitCost(product: CatalogProduct, color: ShirtColor, size: string) {
  const variants = product.configuration.supplier?.variants || [];
  const exact = variants.find((variant) => variant.active !== false && variant.colorName === color.name && variant.sizeName === size);
  if (exact) return money(exact.customerPrice);
  const sameSize = variants.find((variant) => variant.active !== false && variant.sizeName === size);
  if (sameSize) return money(sameSize.customerPrice);
  const any = variants.find((variant) => variant.active !== false);
  if (any) return money(any.customerPrice);
  return money(product.configuration.manualUnitCost || 0);
}

function actualDimensions(product: CatalogProduct, side: DesignSide, size: PrintSize, placement?: ArtworkPlacement) {
  const area = printAreaFor(product.configuration, side, size);
  const maxWidthPx = Math.max(1, Number(area.artworkWidth || area.width));
  const maxHeightPx = Math.max(1, Number(area.artworkHeight || area.height));
  const widthRatio = placement ? Math.min(1, Math.max(0.05, placement.width / maxWidthPx)) : 1;
  const heightRatio = placement ? Math.min(1, Math.max(0.05, placement.height / maxHeightPx)) : 1;
  const widthInches = Number(((area.widthInches || (size === "heart" ? 4 : 14)) * widthRatio).toFixed(2));
  const heightInches = Number(((area.heightInches || (size === "heart" ? 4 : 18)) * heightRatio).toFixed(2));
  return { widthInches, heightInches, squareInches: Number((widthInches * heightInches).toFixed(2)) };
}

export type PricingPrintSelection = {
  printSize: PrintSize;
  placement?: ArtworkPlacement;
  inkColors?: number;
};

export function calculateResolvedOrderPricing({
  profile,
  product,
  sizes,
  color,
  printSelections,
  decorationMethod,
  designOptimizationRequested,
  selectedAddOnIds
}: {
  profile: ShopPricingProfile;
  product: CatalogProduct;
  sizes: SizeQuantity[];
  color: ShirtColor;
  printSelections: Partial<Record<DesignSide, PricingPrintSelection>>;
  decorationMethod: string;
  designOptimizationRequested: boolean;
  selectedAddOnIds: string[];
}): ResolvedOrderPricing {
  const quantity = sizes.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
  const markupMultiplier = 1 + profile.garmentMarkupPercent / 100;
  const garmentLines: GarmentPricingLine[] = sizes
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const cost = supplierUnitCost(product, color, item.size);
      const customerUnitPrice = money(cost * markupMultiplier);
      return {
        size: item.size,
        quantity: item.quantity,
        supplierUnitCost: cost,
        customerUnitPrice,
        subtotal: money(customerUnitPrice * item.quantity)
      };
    });
  const supplierGarmentCost = money(garmentLines.reduce((sum, line) => sum + line.supplierUnitCost * line.quantity, 0));
  const garmentSubtotal = money(garmentLines.reduce((sum, line) => sum + line.subtotal, 0));
  const garmentMarkupAmount = money(garmentSubtotal - supplierGarmentCost);

  const method = normalizeMethod(decorationMethod);
  const activeSelections = (Object.entries(printSelections) as [DesignSide, PricingPrintSelection][]).filter(([, value]) => Boolean(value?.printSize));
  const printLines: PrintPricingLine[] = [];
  let methodSetup = 0;
  let tierLabel = `${quantity}+`;

  if (method === "screen-print") {
    const config = profile.screenPrinting;
    const tier = discountForQuantity(config.quantityDiscounts, quantity);
    tierLabel = `${tier.minQuantity}+ · ${tier.discountPercent}% print discount`;
    const totalScreens = activeSelections.reduce((sum, [, selection]) => {
      const colors = Math.min(config.maximumColors, Math.max(1, integer(selection.inkColors || 1, 1)));
      return sum + colors + (config.countWhiteUnderbase && isDarkColor(color) ? 1 : 0);
    }, 0);
    methodSetup = money(totalScreens * config.setupPerScreen);
    activeSelections.forEach(([side, selection], index) => {
      const inkColors = Math.min(config.maximumColors, Math.max(1, integer(selection.inkColors || 1, 1)));
      const base = selection.printSize === "heart" ? config.heartBasePerItem : config.fullBasePerItem;
      const raw = base + Math.max(0, inkColors - 1) * config.additionalColorPerItem;
      const locationDiscount = index > 0 ? config.additionalLocationDiscountPercent : 0;
      const combinedDiscount = 1 - (1 - tier.discountPercent / 100) * (1 - locationDiscount / 100);
      const unitPrice = money(raw * (1 - combinedDiscount));
      const dims = actualDimensions(product, side, selection.printSize, selection.placement);
      printLines.push({
        side,
        printSize: selection.printSize,
        method,
        quantity,
        inkColors,
        ...dims,
        baseUnitPrice: money(raw),
        discountPercent: Number((combinedDiscount * 100).toFixed(2)),
        unitPrice,
        subtotal: money(unitPrice * quantity)
      });
    });
  } else if (method === "dtf") {
    const config = profile.dtf;
    const tier = discountForQuantity(config.quantityDiscounts, quantity);
    tierLabel = `${tier.minQuantity}+ · ${tier.discountPercent}% print discount`;
    methodSetup = config.setupFee;
    activeSelections.forEach(([side, selection]) => {
      const dims = actualDimensions(product, side, selection.printSize, selection.placement);
      const raw = Math.max(config.minimumPerLocation, dims.squareInches * config.ratePerSquareInch + config.pressFeePerLocation);
      const unitPrice = money(raw * (1 - tier.discountPercent / 100));
      printLines.push({
        side,
        printSize: selection.printSize,
        method,
        quantity,
        ...dims,
        baseUnitPrice: money(raw),
        discountPercent: tier.discountPercent,
        unitPrice,
        subtotal: money(unitPrice * quantity)
      });
    });
  } else {
    const config = profile.embroidery;
    const tier = discountForQuantity(config.quantityDiscounts, quantity);
    tierLabel = `${tier.minQuantity}+ · ${tier.discountPercent}% embroidery discount`;
    methodSetup = money(config.setupPerLocation * activeSelections.length + config.digitizingFee);
    activeSelections.forEach(([side, selection]) => {
      const estimatedStitches = selection.printSize === "heart" ? config.heartEstimatedStitches : config.fullEstimatedStitches;
      const raw = Math.max(config.minimumPerLocation, (estimatedStitches / 1000) * config.ratePerThousandStitches);
      const unitPrice = money(raw * (1 - tier.discountPercent / 100));
      const dims = actualDimensions(product, side, selection.printSize, selection.placement);
      printLines.push({
        side,
        printSize: selection.printSize,
        method,
        quantity,
        estimatedStitches,
        ...dims,
        baseUnitPrice: money(raw),
        discountPercent: tier.discountPercent,
        unitPrice,
        subtotal: money(unitPrice * quantity)
      });
    });
  }

  const printSubtotal = money(printLines.reduce((sum, item) => sum + item.subtotal, 0));
  const setupFee = profile.orderSetupFee.enabled ? money(Math.max(profile.orderSetupFee.amount, methodSetup)) : money(methodSetup);
  const designOptimizationFee = designOptimizationRequested && profile.designOptimizationFee.enabled ? money(profile.designOptimizationFee.amount) : 0;
  const addOns: SelectedPricingAddOn[] = profile.addOns
    .filter((item) => item.active && (selectedAddOnIds.includes(item.id) || (!item.customerSelectable && item.selectedByDefault)))
    .map((item) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      pricingMode: item.pricingMode,
      total: money(item.pricingMode === "per_item" ? item.amount * quantity : item.amount)
    }));
  const addOnTotal = money(addOns.reduce((sum, item) => sum + item.total, 0));
  const merchandiseSubtotal = money(garmentSubtotal + printSubtotal);
  const totalPrice = money(merchandiseSubtotal + setupFee + designOptimizationFee + addOnTotal);
  const averageUnitPrice = quantity > 0 ? money(merchandiseSubtotal / quantity) : 0;
  const frontLine = printLines.find((item) => item.side === "front");
  const backLine = printLines.find((item) => item.side === "back");
  const averageGarment = quantity > 0 ? money(garmentSubtotal / quantity) : 0;

  return {
    tierId: `${method}-${discountForQuantity(method === "screen-print" ? profile.screenPrinting.quantityDiscounts : method === "dtf" ? profile.dtf.quantityDiscounts : profile.embroidery.quantityDiscounts, quantity).minQuantity}`,
    quantity,
    currency: profile.currency,
    garmentMarkupPercent: profile.garmentMarkupPercent,
    garmentLines,
    supplierGarmentCost,
    garmentMarkupAmount,
    garmentSubtotal,
    decorationMethod,
    discountTierLabel: tierLabel,
    printLines,
    printSubtotal,
    setupFee,
    designOptimizationRequested,
    designOptimizationFee,
    addOns,
    addOnTotal,
    averageUnitPrice,
    merchandiseSubtotal,
    totalPrice,
    garmentUnitPrice: averageGarment,
    baseFrontPrintUnitPrice: frontLine?.baseUnitPrice || 0,
    baseBackPrintUnitPrice: backLine?.baseUnitPrice || 0,
    decorationPercentage: 0,
    frontPrintUnitPrice: frontLine?.unitPrice || 0,
    backPrintUnitPrice: backLine?.unitPrice || 0,
    unitPrice: averageUnitPrice
  };
}
