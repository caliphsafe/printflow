export type SupplierProvider = "ss-activewear" | "sanmar" | "alphabroder" | "demo" | string;
export type DesignSide = "front" | "back";
export type DesignMode = "front" | "back" | "front-back";
export type PrintSize = "heart" | "full";

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
 * ProductPackage remains the persisted quantity-tier shape for backwards compatibility.
 * price is retained as the garment subtotal at the tier threshold.
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
 * x/y/width/height define the outer customer movement zone on the 800 × 800 canvas.
 * artworkWidth/artworkHeight define the largest visual print inside that movement zone.
 * defaultX/defaultY define where newly uploaded art begins.
 * widthInches/heightInches are the physical production dimensions shown to the customer.
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

export type ProductCustomization = {
  category: string;
  decorationMethods: string[];
  designModes: DesignMode[];
  frontEnabled: boolean;
  backEnabled: boolean;
  /** Legacy order-level fields retained only so existing products normalize safely. */
  frontSurcharge: number;
  backSurcharge: number;
  twoSideSurcharge: number;
  minimumQuantity: number;
  /** Legacy full-print areas retained for backwards compatibility. */
  frontPrintArea: PrintArea;
  backPrintArea: PrintArea;
  frontHeartArea: PrintArea;
  frontFullArea: PrintArea;
  backHeartArea: PrintArea;
  backFullArea: PrintArea;
  customerInstructions?: string;
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

export type ShopSettings = {
  brand: { primaryColor: string; textColor: string; logoUrl?: string };
  business?: { contactEmail?: string; phone?: string; address?: string };
  customerExperience?: {
    headline?: string;
    introduction?: string;
    uploadInstructions?: string;
    turnaroundTime?: string;
    artworkDisclaimer?: string;
    confirmationMessage?: string;
  };
  product: { name: string; description?: string };
  sizes: string[];
  colors: ShirtColor[];
  printLocations: string[];
  packages: ProductPackage[];
  upload: { acceptedTypes: string[]; maxBytes: number };
};

export type PublicShop = { id: string; slug: string; name: string; settings: ShopSettings; products: CatalogProduct[] };
export type SizeQuantity = { size: string; quantity: number };
export type ArtworkPlacement = { x: number; y: number; width: number; height: number; rotation?: number };
