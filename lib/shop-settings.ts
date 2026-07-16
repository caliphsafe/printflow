import type { ShopSettings } from "@/lib/types";

const DEFAULT_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml"
];

export function normalizeShopSettings(input: unknown): ShopSettings {
  const source = input && typeof input === "object" ? input as Record<string, any> : {};
  const brand = source.brand && typeof source.brand === "object" ? source.brand : {};
  const business = source.business && typeof source.business === "object" ? source.business : {};
  const experience = source.customerExperience && typeof source.customerExperience === "object" ? source.customerExperience : {};
  const upload = source.upload && typeof source.upload === "object" ? source.upload : {};

  return {
    ...source,
    brand: {
      primaryColor: validHex(brand.primaryColor) ? brand.primaryColor : "#111111",
      textColor: validHex(brand.textColor) ? brand.textColor : "#ffffff",
      logoUrl: cleanOptional(brand.logoUrl)
    },
    business: {
      contactEmail: cleanOptional(business.contactEmail),
      phone: cleanOptional(business.phone),
      address: cleanOptional(business.address)
    },
    customerExperience: {
      headline: cleanOptional(experience.headline) || "Design your custom shirts",
      introduction: cleanOptional(experience.introduction) || "Upload your artwork, position it on the shirt, assign the sizes, then continue to secure checkout.",
      uploadInstructions: cleanOptional(experience.uploadInstructions) || "Upload a high-resolution PNG, JPG, WEBP or SVG for the best print quality.",
      turnaroundTime: cleanOptional(experience.turnaroundTime) || "Standard turnaround is confirmed by the print shop after artwork review.",
      artworkDisclaimer: cleanOptional(experience.artworkDisclaimer) || "Your preview is a placement guide. Final print size and color may be adjusted for production quality.",
      confirmationMessage: cleanOptional(experience.confirmationMessage) || "Your design is attached and ready for checkout."
    },
    product: source.product && typeof source.product === "object" ? source.product : { name: "Custom T-Shirt" },
    sizes: Array.isArray(source.sizes) ? source.sizes : [],
    colors: Array.isArray(source.colors) ? source.colors : [],
    printLocations: Array.isArray(source.printLocations) ? source.printLocations : [],
    packages: Array.isArray(source.packages) ? source.packages : [],
    upload: {
      acceptedTypes: Array.isArray(upload.acceptedTypes) && upload.acceptedTypes.length ? upload.acceptedTypes : DEFAULT_ACCEPTED_TYPES,
      maxBytes: Number.isFinite(Number(upload.maxBytes)) ? Math.min(Math.max(Number(upload.maxBytes), 1024 * 1024), 25 * 1024 * 1024) : 10 * 1024 * 1024
    }
  } as ShopSettings;
}

export function mergeEditableShopSettings(current: unknown, body: Record<string, any>): ShopSettings {
  const normalized = normalizeShopSettings(current);
  return normalizeShopSettings({
    ...normalized,
    brand: { ...normalized.brand, ...(body.brand || {}) },
    business: { ...normalized.business, ...(body.business || {}) },
    customerExperience: { ...normalized.customerExperience, ...(body.customerExperience || {}) },
    upload: { ...normalized.upload, ...(body.upload || {}) }
  });
}

function cleanOptional(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function validHex(value: unknown) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
