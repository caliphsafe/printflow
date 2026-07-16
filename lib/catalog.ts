import type { CatalogProduct, ProductConfiguration, ShopSettings } from "@/lib/types";

export const DEFAULT_CONFIGURATION: ProductConfiguration = {
  sizes: ["S", "M", "L", "XL", "2XL"],
  colors: [
    { id: "black", name: "Black", hex: "#171717" },
    { id: "white", name: "White", hex: "#f7f7f2" }
  ],
  printLocations: ["Front Center"],
  packages: [
    {
      id: "12-shirts",
      label: "12 shirts",
      quantity: 12,
      price: 179,
      checkoutUrl: ""
    }
  ]
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "product";
}

export function normalizeConfiguration(value: unknown): ProductConfiguration {
  const raw = (value ?? {}) as Partial<ProductConfiguration>;
  return {
    sizes: Array.isArray(raw.sizes) && raw.sizes.length ? raw.sizes.map(String) : DEFAULT_CONFIGURATION.sizes,
    colors: Array.isArray(raw.colors) && raw.colors.length ? raw.colors.map((item, index) => ({
      id: String(item?.id || `color-${index + 1}`),
      name: String(item?.name || `Color ${index + 1}`),
      hex: String(item?.hex || "#111111")
    })) : DEFAULT_CONFIGURATION.colors,
    printLocations: Array.isArray(raw.printLocations) && raw.printLocations.length
      ? raw.printLocations.map(String)
      : DEFAULT_CONFIGURATION.printLocations,
    packages: Array.isArray(raw.packages) && raw.packages.length ? raw.packages.map((item, index) => ({
      id: String(item?.id || `package-${index + 1}`),
      label: String(item?.label || `${item?.quantity || 1} shirts`),
      quantity: Math.max(1, Number(item?.quantity || 1)),
      price: Math.max(0, Number(item?.price || 0)),
      checkoutUrl: String(item?.checkoutUrl || "")
    })) : DEFAULT_CONFIGURATION.packages,
    mockupImageUrl: raw.mockupImageUrl ? String(raw.mockupImageUrl) : undefined
  };
}

export function legacyProductFromSettings(settings: ShopSettings): CatalogProduct {
  return {
    id: "legacy-product",
    slug: "custom-shirts",
    name: settings.product.name,
    description: settings.product.description ?? null,
    active: true,
    configuration: normalizeConfiguration({
      sizes: settings.sizes,
      colors: settings.colors,
      printLocations: settings.printLocations,
      packages: settings.packages
    })
  };
}
