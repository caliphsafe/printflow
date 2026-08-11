import type { CatalogProduct, DesignSide, ShirtColor } from "@/lib/types";

export function visibleProductColors(product?: CatalogProduct) {
  if (!product) return [];
  return product.configuration.colors.filter((color) => color.active !== false);
}

export function defaultProductColor(product?: CatalogProduct) {
  const visible = visibleProductColors(product);
  return visible[0];
}

export function productColorImage(color: ShirtColor | undefined, side: DesignSide) {
  if (!color) return "";
  return side === "front" ? color.frontImageUrl || "" : color.backImageUrl || "";
}

export function syncProductMockupToVisibleColor(product: CatalogProduct): CatalogProduct {
  const first = defaultProductColor(product);
  return {
    ...product,
    configuration: {
      ...product.configuration,
      mockupImageUrl: first?.frontImageUrl || undefined
    }
  };
}
