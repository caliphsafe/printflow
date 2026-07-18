export type SupplierProvider = "ss-activewear" | "sanmar" | "demo" | string;
export type DesignSide = "front" | "back";
export type DesignMode = "front" | "back" | "front-back";
export type PrintSize = "heart" | "full";
export type PricingMode = "order" | "per_item";
export type OverrideMode = "inherit" | "custom" | "disabled";
export type PaymentProvider = "stripe" | "square";
export type DecorationMethodId = "screen-print" | "dtf" | "embroidery" | string;

export type SupplierVariant = {
  sku: string;
  skuId?: string;
  gtin?: string;
  colorName: string;
  sizeName: string;
  customerPrice: number;
  quantity: number;
  active?: boolean;
};

export type ShirtColor = {
  id: string;
  name: string;
  hex: string;
  swatchImageUrl?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  active?: boolean;
};

/**
 * Legacy quantity-tier shape retained so older product JSON keeps loading.
 * Release v8 does not use product packages for customer pricing.
 */
export type ProductPackage = {
  id: string;
  label: string;
  quantity: number;
  price: number;
  checkoutUrl: string;
  garmentUnitPrice?: number;
  heartPrintUnitPrice?: number;
  fullPrintUnitPrice?: number;
};

/**
 * x/y/width/height define the customer movement zone on the 800 × 800 canvas.
 * artworkWidth/artworkHeight define the largest visual print inside that zone.
 * widthInches/heightInches are the maximum physical production dimensions.
 */
export type PrintArea = {
  x: number;
  y: number;
  width: number;
  height: number;
  widthInches?: number;
  heightInches?: number;
  topInches?: number;
  artworkWidth?: number;
  artworkHeight?: number;
  defaultX?: number;
  defaultY?: number;
};

/** Deprecated product overrides retained only for backwards-compatible JSON. */
export type FeeOverride = { mode: OverrideMode; amount?: number };
export type ProductPricingOverrides = {
  setupFee: FeeOverride;
  designOptimizationFee: FeeOverride;
  decorationAdjustments: Record<string, number | null>;
  addOnModes: Record<string, "inherit" | "enabled" | "disabled">;
};

export type ProductCustomization = {
  category: string;
  decorationMethods: string[];
  designModes: DesignMode[];
  frontEnabled: boolean;
  backEnabled: boolean;
  frontSurcharge: number;
  backSurcharge: number;
  twoSideSurcharge: number;
  minimumQuantity: number;
  frontPrintArea: PrintArea;
  backPrintArea: PrintArea;
  frontHeartArea: PrintArea;
  frontFullArea: PrintArea;
  backHeartArea: PrintArea;
  backFullArea: PrintArea;
  customerInstructions?: string;
  pricingOverrides: ProductPricingOverrides;
};

export type SupplierProductConfiguration = {
  provider: SupplierProvider;
  supplierName?: string;
  styleId: string;
  brandName: string;
  styleName: string;
  partNumber?: string;
  importedAt: string;
  sourceMode?: "live" | "demo" | "manual";
  variants: SupplierVariant[];
};

export type ProductConfiguration = {
  sizes: string[];
  colors: ShirtColor[];
  printLocations: string[];
  packages: ProductPackage[];
  mockupImageUrl?: string;
  /** Cost basis for a manually created product. Supplier imports use variant customerPrice. */
  manualUnitCost?: number;
  supplier?: SupplierProductConfiguration;
  customization: ProductCustomization;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  active: boolean;
  configuration: ProductConfiguration;
};

export type CorePricingFee = {
  enabled: boolean;
  label: string;
  description: string;
  amount: number;
};

export type QuantityDiscountTier = {
  id: string;
  minQuantity: number;
  discountPercent: number;
};

export type ScreenPrintingPricing = {
  active: boolean;
  label: string;
  minimumQuantity: number;
  maximumColors: number;
  heartBasePerItem: number;
  fullBasePerItem: number;
  additionalColorPerItem: number;
  setupPerScreen: number;
  countWhiteUnderbase: boolean;
  additionalLocationDiscountPercent: number;
  quantityDiscounts: QuantityDiscountTier[];
};

export type DtfPricing = {
  active: boolean;
  label: string;
  minimumQuantity: number;
  ratePerSquareInch: number;
  pressFeePerLocation: number;
  minimumPerLocation: number;
  setupFee: number;
  quantityDiscounts: QuantityDiscountTier[];
};

export type EmbroideryPricing = {
  active: boolean;
  label: string;
  minimumQuantity: number;
  ratePerThousandStitches: number;
  minimumPerLocation: number;
  setupPerLocation: number;
  digitizingFee: number;
  heartEstimatedStitches: number;
  fullEstimatedStitches: number;
  quantityDiscounts: QuantityDiscountTier[];
};

export type PricingAddOn = {
  id: string;
  name: string;
  description: string;
  amount: number;
  pricingMode: PricingMode;
  active: boolean;
  customerSelectable: boolean;
  selectedByDefault: boolean;
};

/** Deprecated v6 rule retained for old imports; no longer used by the engine. */
export type DecorationPricingRule = {
  id: string;
  name: string;
  percentageAdjustment: number;
  active: boolean;
};

export type ShopPricingProfile = {
  currency: string;
  garmentMarkupPercent: number;
  orderSetupFee: CorePricingFee;
  designOptimizationFee: CorePricingFee;
  screenPrinting: ScreenPrintingPricing;
  dtf: DtfPricing;
  embroidery: EmbroideryPricing;
  addOns: PricingAddOn[];
};

export type ShopSettings = {
  brand: {
    primaryColor: string;
    textColor: string;
    logoUrl?: string;
    accentColor?: string;
    surfaceColor?: string;
  };
  business?: { contactEmail?: string; phone?: string; address?: string };
  payment?: { provider?: PaymentProvider };
  customerExperience?: {
    headline?: string;
    introduction?: string;
    uploadInstructions?: string;
    turnaroundTime?: string;
    artworkDisclaimer?: string;
    confirmationMessage?: string;
    trustMessage?: string;
    heroBadge?: string;
  };
  product: { name: string; description?: string };
  sizes: string[];
  colors: ShirtColor[];
  printLocations: string[];
  packages: ProductPackage[];
  upload: { acceptedTypes: string[]; maxBytes: number };
};

export type PublicShop = {
  id: string;
  slug: string;
  name: string;
  settings: ShopSettings;
  pricing: ShopPricingProfile;
  products: CatalogProduct[];
  paymentReady?: boolean;
  /** True when an authenticated shop owner is reviewing an unpublished storefront. */
  previewMode?: boolean;
};

export type SizeQuantity = { size: string; quantity: number };
export type ArtworkPlacement = { x: number; y: number; width: number; height: number; rotation?: number };

export type SelectedPricingAddOn = {
  id: string;
  name: string;
  amount: number;
  pricingMode: PricingMode;
  total: number;
};

export type GarmentPricingLine = {
  size: string;
  quantity: number;
  supplierUnitCost: number;
  customerUnitPrice: number;
  subtotal: number;
};

export type PrintPricingLine = {
  side: DesignSide;
  printSize: PrintSize;
  method: DecorationMethodId;
  quantity: number;
  inkColors?: number;
  widthInches?: number;
  heightInches?: number;
  squareInches?: number;
  estimatedStitches?: number;
  baseUnitPrice: number;
  discountPercent: number;
  unitPrice: number;
  subtotal: number;
};

export type ResolvedOrderPricing = {
  tierId?: string;
  quantity: number;
  currency: string;
  garmentMarkupPercent: number;
  garmentLines: GarmentPricingLine[];
  supplierGarmentCost: number;
  garmentMarkupAmount: number;
  garmentSubtotal: number;
  decorationMethod: string;
  discountTierLabel: string;
  printLines: PrintPricingLine[];
  printSubtotal: number;
  setupFee: number;
  designOptimizationRequested: boolean;
  designOptimizationFee: number;
  addOns: SelectedPricingAddOn[];
  addOnTotal: number;
  averageUnitPrice: number;
  merchandiseSubtotal: number;
  totalPrice: number;
  /** Legacy fields retained for existing order-detail rendering. */
  garmentUnitPrice: number;
  baseFrontPrintUnitPrice: number;
  baseBackPrintUnitPrice: number;
  decorationPercentage: number;
  frontPrintUnitPrice: number;
  backPrintUnitPrice: number;
  unitPrice: number;
};
