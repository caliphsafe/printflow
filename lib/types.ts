export type ShirtColor = {
  id: string;
  name: string;
  hex: string;
};

export type ProductPackage = {
  id: string;
  label: string;
  quantity: number;
  price: number;
  checkoutUrl: string;
};

export type ProductConfiguration = {
  sizes: string[];
  colors: ShirtColor[];
  printLocations: string[];
  packages: ProductPackage[];
  mockupImageUrl?: string;
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
  brand: {
    primaryColor: string;
    textColor: string;
    logoUrl?: string;
  };
  business?: {
    contactEmail?: string;
    phone?: string;
    address?: string;
  };
  customerExperience?: {
    headline?: string;
    introduction?: string;
    uploadInstructions?: string;
    turnaroundTime?: string;
    artworkDisclaimer?: string;
    confirmationMessage?: string;
  };
  product: {
    name: string;
    description?: string;
  };
  sizes: string[];
  colors: ShirtColor[];
  printLocations: string[];
  packages: ProductPackage[];
  upload: {
    acceptedTypes: string[];
    maxBytes: number;
  };
};

export type PublicShop = {
  id: string;
  slug: string;
  name: string;
  settings: ShopSettings;
  products: CatalogProduct[];
};

export type SizeQuantity = {
  size: string;
  quantity: number;
};
