import { DEFAULT_CONFIGURATION, normalizePrintArea } from "@/lib/catalog";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import type {
  CatalogProduct,
  DesignSide,
  PrintArea,
  PrintSize,
  ProductConfiguration,
  ShirtColor,
  ShopPricingProfile
} from "@/lib/types";

export type BrandGarmentSetup = {
  active: boolean;
  defaultColorId?: string;
  activeColorIds: string[];
  sizes: string[];
  decorationMethods: string[];
  printSizes: PrintSize[];
  frontEnabled: boolean;
  backEnabled: boolean;
  colorContrast: Record<string, "light" | "dark">;
  zones: {
    frontHeartArea: PrintArea;
    frontFullArea: PrintArea;
    backHeartArea: PrintArea;
    backFullArea: PrintArea;
  };
};

export type BrandStorefrontSettings = {
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

export type BrandCommerceSettings = {
  pricing: ShopPricingProfile;
  garments: Record<string, BrandGarmentSetup>;
  colorContrast: Record<string, Record<string, "light" | "dark">>;
  storefront: BrandStorefrontSettings;
};

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? value as Record<string, any> : {};
}

function defaultZones() {
  return {
    frontHeartArea: normalizePrintArea(DEFAULT_CONFIGURATION.customization.frontHeartArea, DEFAULT_CONFIGURATION.customization.frontHeartArea),
    frontFullArea: normalizePrintArea(DEFAULT_CONFIGURATION.customization.frontFullArea, DEFAULT_CONFIGURATION.customization.frontFullArea),
    backHeartArea: normalizePrintArea(DEFAULT_CONFIGURATION.customization.backHeartArea, DEFAULT_CONFIGURATION.customization.backHeartArea),
    backFullArea: normalizePrintArea(DEFAULT_CONFIGURATION.customization.backFullArea, DEFAULT_CONFIGURATION.customization.backFullArea)
  };
}

export function defaultBrandGarmentSetup(product: CatalogProduct): BrandGarmentSetup {
  const activeColors = product.configuration.colors.filter((item) => item.active !== false);
  const defaultColorId =
    product.configuration.defaultColorId && activeColors.some((item) => item.id === product.configuration.defaultColorId)
      ? product.configuration.defaultColorId
      : activeColors[0]?.id;

  const descriptor = `${product.name} ${product.configuration.customization.category}`.toLowerCase();
  const headwear = /hat|cap|beanie|headwear|visor/.test(descriptor);

  return {
    active: false,
    defaultColorId,
    activeColorIds: activeColors.map((item) => item.id),
    sizes: [...product.configuration.sizes],
    decorationMethods: headwear ? ["Embroidery"] : ["Screen Print", "DTF", "Embroidery"],
    printSizes: headwear ? ["full"] : ["heart", "full"],
    frontEnabled: true,
    backEnabled: false,
    colorContrast: {},
    zones: defaultZones()
  };
}

export function normalizeBrandGarmentSetup(value: unknown, product: CatalogProduct): BrandGarmentSetup {
  const source = object(value);
  const fallback = defaultBrandGarmentSetup(product);
  const colors = product.configuration.colors.map((item) => item.id);
  const sizes = product.configuration.sizes;

  const activeColorIds = Array.isArray(source.activeColorIds)
    ? source.activeColorIds.map(String).filter((id: string) => colors.includes(id))
    : fallback.activeColorIds;

  const activeSizes = Array.isArray(source.sizes)
    ? source.sizes.map(String).filter((size: string) => sizes.includes(size))
    : fallback.sizes;

  const printSizes = Array.isArray(source.printSizes)
    ? source.printSizes.filter((item: unknown): item is PrintSize => item === "heart" || item === "full")
    : fallback.printSizes;

  const zones = object(source.zones);

  return {
    active: source.active === true,
    defaultColorId:
      typeof source.defaultColorId === "string" && activeColorIds.includes(source.defaultColorId)
        ? source.defaultColorId
        : activeColorIds[0],
    activeColorIds,
    sizes: activeSizes.length ? activeSizes : fallback.sizes,
    decorationMethods:
      Array.isArray(source.decorationMethods) && source.decorationMethods.length
        ? source.decorationMethods.map(String)
        : fallback.decorationMethods,
    printSizes: printSizes.length ? printSizes : fallback.printSizes,
    frontEnabled: source.frontEnabled !== false,
    backEnabled: source.backEnabled === true,
    colorContrast: Object.fromEntries(
      Object.entries(object(source.colorContrast))
        .filter(([, value]) => value === "light" || value === "dark")
        .map(([key, value]) => [key, value as "light" | "dark"])
    ),
    zones: {
      frontHeartArea: normalizePrintArea(zones.frontHeartArea, fallback.zones.frontHeartArea),
      frontFullArea: normalizePrintArea(zones.frontFullArea, fallback.zones.frontFullArea),
      backHeartArea: normalizePrintArea(zones.backHeartArea, fallback.zones.backHeartArea),
      backFullArea: normalizePrintArea(zones.backFullArea, fallback.zones.backFullArea)
    }
  };
}

export function normalizeBrandCommerceSettings(settings: unknown): BrandCommerceSettings {
  const root = object(settings);
  const brandCommerce = object(root.brandCommerce);

  const sharedBrand = object(root.brand);
  const sharedExperience = object(root.customerExperience);
  const storefront = object(brandCommerce.storefront);

  return {
    pricing: normalizePricingProfile(brandCommerce.pricing || DEFAULT_PRICING_PROFILE),
    garments: object(brandCommerce.garments),
    colorContrast: object(brandCommerce.colorContrast),
    storefront: {
      logoUrl: typeof storefront.logoUrl === "string" ? storefront.logoUrl : typeof sharedBrand.logoUrl === "string" ? sharedBrand.logoUrl : undefined,
      primaryColor: String(storefront.primaryColor || sharedBrand.primaryColor || "#171717"),
      textColor: String(storefront.textColor || sharedBrand.textColor || "#ffffff"),
      accentColor: String(storefront.accentColor || sharedBrand.accentColor || "#d8ff5f"),
      surfaceColor: String(storefront.surfaceColor || sharedBrand.surfaceColor || "#f4f4ef"),
      heroBadge: String(storefront.heroBadge || "BRAND / MERCH"),
      headline: String(storefront.headline || "Shop the brand."),
      introduction: String(storefront.introduction || "Choose a garment, color, and approved design."),
      trustMessage: String(storefront.trustMessage || sharedExperience.trustMessage || "Secure checkout · Production approved · Order updates")
    }
  };
}

export function applyBrandGarmentConfiguration(
  product: CatalogProduct,
  configuration: unknown
): CatalogProduct | null {
  const setup = normalizeBrandGarmentSetup(configuration, product);
  if (!setup.active) return null;

  const colors = product.configuration.colors
    .filter((item) => setup.activeColorIds.includes(item.id))
    .map((item) => {
      const contrast = setup.colorContrast[item.id];
      return {
        ...item,
        ...(contrast === "light" || contrast === "dark" ? { contrastMode: contrast } : {})
      } as ShirtColor & { contrastMode?: "light" | "dark" };
    });

  const frontEnabled = setup.frontEnabled;
  const backEnabled = setup.backEnabled;

  const designModes = [
    ...(frontEnabled ? ["front"] as const : []),
    ...(backEnabled ? ["back"] as const : []),
    ...(frontEnabled && backEnabled ? ["front-back"] as const : [])
  ];

  const configurationNext: ProductConfiguration = {
    ...product.configuration,
    sizes: setup.sizes,
    colors,
    defaultColorId: setup.defaultColorId,
    customization: {
      ...product.configuration.customization,
      decorationMethods: setup.decorationMethods,
      printSizes: setup.printSizes,
      frontEnabled,
      backEnabled,
      designModes: [...designModes],
      frontPrintArea: setup.zones.frontFullArea,
      backPrintArea: setup.zones.backFullArea,
      frontHeartArea: setup.zones.frontHeartArea,
      frontFullArea: setup.zones.frontFullArea,
      backHeartArea: setup.zones.backHeartArea,
      backFullArea: setup.zones.backFullArea
    }
  };

  return { ...product, configuration: configurationNext };
}

/**
 * Legacy compatibility helper for the immediately previous Brand build.
 * New code should read Brand garment configuration from brand_garments
 * and call applyBrandGarmentConfiguration instead.
 */
export function applyBrandGarmentSetup(
  product: CatalogProduct,
  settings: unknown
): CatalogProduct | null {
  const commerce = normalizeBrandCommerceSettings(settings);
  const raw = commerce.garments[product.id];
  if (!raw) return null;

  const merged = {
    ...object(raw),
    colorContrast: commerce.colorContrast[product.id] || object(raw).colorContrast || {}
  };
  return applyBrandGarmentConfiguration(product, merged);
}



export function brandZoneKey(side: DesignSide, size: PrintSize): keyof BrandGarmentSetup["zones"] {
  return `${side}${size === "heart" ? "Heart" : "Full"}Area` as keyof BrandGarmentSetup["zones"];
}
