import type { CatalogProduct, DesignSide, PrintSize, ShirtColor } from "@/lib/types";
import type { BrandBusinessProfile, BrandMerchProduct, BrandRetailProfile } from "@/lib/brand-retail";

export type BrandContrastMode = "light" | "dark";
export type BrandPlacementKey = "front-heart" | "front-full" | "back-full";

export type BrandDesignCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  sort_order: number;
};

export type BrandDesignVariant = {
  id: string;
  brand_design_id: string;
  variant_type: "light" | "dark" | "universal";
  artwork_path: string;
  preview_url?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  active: boolean;
};

export type BrandDesignPlacement = {
  id: string;
  brand_design_id: string;
  side: DesignSide;
  placement_type: PrintSize;
  label?: string | null;
  decoration_method?: string | null;
  width_inches?: number | null;
  height_inches?: number | null;
  surcharge: number;
  active: boolean;
  configuration?: Record<string, unknown>;
};

export type BrandLockedPlacement = {
  enabled: boolean;
  side: DesignSide;
  printSize: PrintSize;
  decorationMethod: string;
  widthInches: number;
  heightInches: number;
  surcharge: number;
  placement: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  };
};

export type BrandDesignProductRule = {
  productId: string;
  placements: Record<string, BrandLockedPlacement>;
};

export type BrandDesignCustomerOffer = {
  enabled: boolean;
  retailPrice: number;
  side: DesignSide;
  printSize: PrintSize;
};

export type BrandDesign = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category_id?: string | null;
  thumbnail_url?: string | null;
  active: boolean;
  featured: boolean;
  sort_order: number;
  metadata?: Record<string, unknown>;
  variants: BrandDesignVariant[];
  productIds: string[];
  productRules: BrandDesignProductRule[];
};

export type BrandStoreProduct = CatalogProduct & {
  brandGarmentId: string;
  configuration: CatalogProduct["configuration"] & {
    colors: Array<ShirtColor & { contrastMode?: BrandContrastMode }>;
    brandRetailPrice?: number;
  };
};

export type BrandCollection = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  featured: boolean;
  sort_order: number;
  merchProductIds: string[];
};

export type PublicBrandShop = {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  active: boolean;
  business: BrandBusinessProfile;
  retailProfile: BrandRetailProfile;
  garments: BrandStoreProduct[];
  brandDesigns: BrandDesign[];
  merchProducts: BrandMerchProduct[];
  categories: BrandDesignCategory[];
  collections: BrandCollection[];
  paymentReady: boolean;
  presentation: "full" | "embed" | "preview";
};
