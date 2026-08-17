import type { CatalogProduct, DesignSide, PrintSize, PublicShop, ShirtColor } from "@/lib/types";

export type BrandContrastMode = "light" | "dark";

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

export type BrandPlacementConfiguration = {
  alignX?: "left" | "center" | "right";
  alignY?: "top" | "center" | "bottom";
  scalePercent?: number;
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
  configuration?: BrandPlacementConfiguration;
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
  placements: BrandDesignPlacement[];
  productIds: string[];
};

export type BrandStoreProduct = CatalogProduct & {
  configuration: CatalogProduct["configuration"] & {
    colors: Array<ShirtColor & { contrastMode?: BrandContrastMode }>;
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
  designIds: string[];
  productIds: string[];
};

export type PublicBrandShop = PublicShop & {
  products: BrandStoreProduct[];
  brandDesigns: BrandDesign[];
  categories: BrandDesignCategory[];
  collections: BrandCollection[];
  presentation: "full" | "embed";
};
