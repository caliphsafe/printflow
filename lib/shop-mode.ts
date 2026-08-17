export type ShopAccountMode = "custom" | "brand" | "hybrid";
export type BrandStorefrontMode = "full" | "embed" | "both";

export function shopAccountMode(settings: unknown): ShopAccountMode {
  const source = settings && typeof settings === "object" ? settings as Record<string, unknown> : {};
  const value = String(source.accountMode || "custom");
  return value === "brand" || value === "hybrid" ? value : "custom";
}

export function brandStorefrontMode(settings: unknown): BrandStorefrontMode {
  const source = settings && typeof settings === "object" ? settings as Record<string, unknown> : {};
  const value = String(source.brandStorefrontMode || "both");
  return value === "full" || value === "embed" ? value : "both";
}

export function isBrandMode(mode: ShopAccountMode) {
  return mode === "brand" || mode === "hybrid";
}

export function modeLabel(mode: ShopAccountMode) {
  if (mode === "brand") return "Brand / merch";
  if (mode === "hybrid") return "Print shop + brand";
  return "Custom print shop";
}
