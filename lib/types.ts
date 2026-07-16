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

export type ShopSettings = {
  brand: {
    primaryColor: string;
    textColor: string;
    logoUrl?: string;
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
};

export type SizeQuantity = {
  size: string;
  quantity: number;
};
