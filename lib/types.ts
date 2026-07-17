export type SupplierProvider = "ss-activewear" | "sanmar" | "alphabroder" | "demo" | string;

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

export type ProductPackage = { id: string; label: string; quantity: number; price: number; checkoutUrl: string };

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
};

export type CatalogProduct = { id: string; slug: string; name: string; description?: string | null; active: boolean; configuration: ProductConfiguration };

export type ShopSettings = {
  brand: { primaryColor: string; textColor: string; logoUrl?: string };
  business?: { contactEmail?: string; phone?: string; address?: string };
  customerExperience?: { headline?: string; introduction?: string; uploadInstructions?: string; turnaroundTime?: string; artworkDisclaimer?: string; confirmationMessage?: string };
  product: { name: string; description?: string };
  sizes: string[];
  colors: ShirtColor[];
  printLocations: string[];
  packages: ProductPackage[];
  upload: { acceptedTypes: string[]; maxBytes: number };
};

export type PublicShop = { id: string; slug: string; name: string; settings: ShopSettings; products: CatalogProduct[] };
export type SizeQuantity = { size: string; quantity: number };
