export type ShopAccountMode = "custom" | "brand" | "hybrid";
export type BrandStorefrontMode = "full" | "embed" | "both";

export type PlatformShopAccess = {
  customPrint: boolean;
  brandMerch: boolean;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function shopAccountMode(settings: unknown): ShopAccountMode {
  const source = objectValue(settings);
  const value = String(source.accountMode || "custom");
  return value === "brand" || value === "hybrid" ? value : "custom";
}

export function brandStorefrontMode(settings: unknown): BrandStorefrontMode {
  const source = objectValue(settings);
  const value = String(source.brandStorefrontMode || "both");
  return value === "full" || value === "embed" ? value : "both";
}

export function platformShopAccess(settings: unknown): PlatformShopAccess {
  const source = objectValue(settings);
  const stored = objectValue(source.platformAccess);

  if (typeof stored.customPrint === "boolean" || typeof stored.brandMerch === "boolean") {
    return {
      customPrint: stored.customPrint !== false,
      brandMerch: stored.brandMerch === true
    };
  }

  // Backward-compatible fallback for shops created before platformAccess existed.
  const mode = shopAccountMode(settings);
  if (mode === "brand") return { customPrint: false, brandMerch: true };
  if (mode === "hybrid") return { customPrint: true, brandMerch: true };
  return { customPrint: true, brandMerch: false };
}

export function modeFromAccess(access: PlatformShopAccess): ShopAccountMode {
  if (access.customPrint && access.brandMerch) return "hybrid";
  if (access.brandMerch) return "brand";
  return "custom";
}

export function isModeAllowed(mode: ShopAccountMode, access: PlatformShopAccess) {
  if (mode === "custom") return access.customPrint;
  if (mode === "brand") return access.brandMerch;
  return access.customPrint && access.brandMerch;
}

export function isBrandMode(mode: ShopAccountMode) {
  return mode === "brand" || mode === "hybrid";
}

export function modeLabel(mode: ShopAccountMode) {
  if (mode === "brand") return "Brand / merch";
  if (mode === "hybrid") return "Custom Print + Brand";
  return "Custom print shop";
}
