import { printAreaFor } from "@/lib/catalog";
import type { ArtworkPlacement, CatalogProduct, PrintArea, ShirtColor } from "@/lib/types";
import type { BrandDesignPlacement, BrandDesignVariant } from "@/lib/brand-types";

export function slugifyBrand(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "design";
}

export function hexIsDark(hex?: string) {
  const clean = String(hex || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.52;
}

export function garmentContrast(color?: ShirtColor & { contrastMode?: "light" | "dark" }) {
  if (color?.contrastMode === "light" || color?.contrastMode === "dark") return color.contrastMode;
  return hexIsDark(color?.hex) ? "dark" : "light";
}

export function chooseBrandVariant(variants: BrandDesignVariant[], color?: ShirtColor & { contrastMode?: "light" | "dark" }) {
  const contrast = garmentContrast(color);
  return variants.find((item) => item.active && item.variant_type === contrast)
    || variants.find((item) => item.active && item.variant_type === "universal")
    || variants.find((item) => item.active)
    || null;
}

export function placementSupported(product: CatalogProduct, placement: BrandDesignPlacement) {
  const printSizes = product.configuration.customization.printSizes || ["heart", "full"];
  if (!printSizes.includes(placement.placement_type)) return false;
  const modes = product.configuration.customization.designModes || [];
  return modes.some((mode) => mode === placement.side || mode === "front-back");
}

export function compatiblePlacements(product: CatalogProduct, placements: BrandDesignPlacement[]) {
  return placements.filter((item) => item.active && placementSupported(product, item));
}

export function resolveLockedPlacement(product: CatalogProduct, placement: BrandDesignPlacement): { area: PrintArea; placement: ArtworkPlacement } {
  const area = printAreaFor(product.configuration, placement.side, placement.placement_type);
  const config = placement.configuration || {};
  const scale = Math.max(0.2, Math.min(1, Number(config.scalePercent || 90) / 100));

  let width = Math.min(area.artworkWidth || area.width, area.width) * scale;
  let height = Math.min(area.artworkHeight || area.height, area.height) * scale;

  if (placement.width_inches && area.widthInches) width = Math.min(area.width, area.width * (Number(placement.width_inches) / Number(area.widthInches)));
  if (placement.height_inches && area.heightInches) height = Math.min(area.height, area.height * (Number(placement.height_inches) / Number(area.heightInches)));

  const x = config.alignX === "left" ? area.x : config.alignX === "right" ? area.x + area.width - width : area.x + (area.width - width) / 2;
  const y = config.alignY === "top" ? area.y : config.alignY === "bottom" ? area.y + area.height - height : area.y + (area.height - height) / 2;

  return { area, placement: { x, y, width, height, rotation: 0 } };
}

export function brandArtworkUrl(variantId?: string) {
  return variantId ? `/api/public/brand-artwork?variant=${encodeURIComponent(variantId)}` : "";
}


export function applyBrandContrast<T extends CatalogProduct>(product: T, settings: unknown): T {
  const source = settings && typeof settings === "object" ? settings as Record<string, any> : {};
  const map = source.brandColorContrast && typeof source.brandColorContrast === "object" ? source.brandColorContrast : {};
  const productMap = map[product.id] && typeof map[product.id] === "object" ? map[product.id] : {};

  return {
    ...product,
    configuration: {
      ...product.configuration,
      colors: product.configuration.colors.map((color) => ({
        ...color,
        ...(productMap[color.id] === "light" || productMap[color.id] === "dark"
          ? { contrastMode: productMap[color.id] }
          : {})
      }))
    }
  } as T;
}
