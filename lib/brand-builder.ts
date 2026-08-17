import { garmentContrast } from "@/lib/brand-designs";
import type {
  BrandDesign,
  BrandDesignCustomerOffer,
  BrandLockedPlacement,
  BrandPlacementKey,
  BrandStoreProduct
} from "@/lib/brand-types";
import type { DesignSide, PrintSize, ShirtColor } from "@/lib/types";

const OFFER_DEFS: Record<BrandPlacementKey, { side: DesignSide; printSize: PrintSize; label: string }> = {
  "front-heart": { side: "front", printSize: "heart", label: "Front · Heart Size" },
  "front-full": { side: "front", printSize: "full", label: "Front · Full Size" },
  "back-full": { side: "back", printSize: "full", label: "Back · Full Size" }
};

export function placementDefinition(key: BrandPlacementKey) {
  return OFFER_DEFS[key];
}

export function garmentRetailPrice(garment?: BrandStoreProduct) {
  return Math.max(0, Number((garment?.configuration as any)?.brandRetailPrice || 0));
}

export function designOffers(design?: BrandDesign): Record<BrandPlacementKey, BrandDesignCustomerOffer> {
  const metadata = design?.metadata && typeof design.metadata === "object" ? design.metadata as Record<string, any> : {};
  const source = metadata.customerOffers && typeof metadata.customerOffers === "object" ? metadata.customerOffers : {};
  const legacy = metadata.customerOffer && typeof metadata.customerOffer === "object" ? metadata.customerOffer : null;

  const result = {} as Record<BrandPlacementKey, BrandDesignCustomerOffer>;
  (Object.keys(OFFER_DEFS) as BrandPlacementKey[]).forEach((key) => {
    const def = OFFER_DEFS[key];
    const row = source[key] && typeof source[key] === "object" ? source[key] : {};
    const legacyMatches = legacy && legacy.side === def.side && legacy.printSize === def.printSize;
    result[key] = {
      enabled: row.enabled === true || Boolean(legacyMatches),
      retailPrice: Math.max(0, Number(row.retailPrice ?? (legacyMatches ? legacy.retailPrice : 0) ?? 0)),
      side: def.side,
      printSize: def.printSize
    };
  });
  return result;
}

export function enabledDesignOffers(design: BrandDesign) {
  const offers = designOffers(design);
  return (Object.keys(offers) as BrandPlacementKey[])
    .filter((key) => offers[key].enabled)
    .map((key) => ({ key, ...offers[key], label: OFFER_DEFS[key].label }));
}

export function lockedPlacementFor(design: BrandDesign, garment: BrandStoreProduct, placementKey?: BrandPlacementKey) {
  const rule = design.productRules.find((item) => item.productId === garment.id);
  if (!rule) return undefined;
  if (placementKey) return rule.placements?.[placementKey];

  const fallback = enabledDesignOffers(design).find((offer) => rule.placements?.[offer.key]?.enabled);
  return fallback ? rule.placements?.[fallback.key] : undefined;
}

export function garmentSupportsPlacement(garment: { configuration: any }, placementKey: BrandPlacementKey) {
  const def = OFFER_DEFS[placementKey];
  const customization = garment.configuration?.customization || {};
  if (def.side === "front" && customization.frontEnabled === false) return false;
  if (def.side === "back" && customization.backEnabled !== true) return false;
  const printSizes = Array.isArray(customization.printSizes) ? customization.printSizes : ["heart", "full"];
  return printSizes.includes(def.printSize);
}

export function compatibleOffer(design: BrandDesign, garment: BrandStoreProduct, placementKey: BrandPlacementKey) {
  const offer = designOffers(design)[placementKey];
  return Boolean(design.active && offer.enabled && garmentSupportsPlacement(garment, placementKey) && lockedPlacementFor(design, garment, placementKey)?.enabled);
}

export function compatibleDesignsForPlacement(designs: BrandDesign[], garment: BrandStoreProduct, placementKey: BrandPlacementKey) {
  return designs.filter((design) => compatibleOffer(design, garment, placementKey));
}

export function designArtworkVariant(design: BrandDesign, color?: ShirtColor) {
  const contrast = color ? garmentContrast(color as any) : "light";
  return design.variants.find((item) => item.active && item.variant_type === contrast && item.artwork_path)
    || design.variants.find((item) => item.active && item.variant_type === "universal" && item.artwork_path)
    || design.variants.find((item) => item.active && item.artwork_path);
}

export function placementPrice(design: BrandDesign | undefined, placementKey: BrandPlacementKey | undefined) {
  if (!design || !placementKey) return 0;
  return designOffers(design)[placementKey]?.enabled ? designOffers(design)[placementKey].retailPrice : 0;
}

export function builderUnitPrice({
  garment,
  frontDesign,
  frontPlacement,
  backDesign
}: {
  garment: BrandStoreProduct;
  frontDesign?: BrandDesign;
  frontPlacement?: Extract<BrandPlacementKey, "front-heart" | "front-full">;
  backDesign?: BrandDesign;
}) {
  return garmentRetailPrice(garment)
    + placementPrice(frontDesign, frontPlacement)
    + placementPrice(backDesign, backDesign ? "back-full" : undefined);
}

export function defaultDecoratedSelection(garment: BrandStoreProduct, designs: BrandDesign[]) {
  const configuredDesignId = String((garment.configuration as any)?.brandDefaultDesignId || "");
  const configuredPlacement = String((garment.configuration as any)?.brandDefaultPlacementKey || "") as BrandPlacementKey;

  if (configuredDesignId && configuredPlacement) {
    const design = designs.find((item) => item.id === configuredDesignId);
    if (design && compatibleOffer(design, garment, configuredPlacement)) return { design, placementKey: configuredPlacement };
  }

  const priority: BrandPlacementKey[] = ["front-full", "front-heart", "back-full"];
  for (const placementKey of priority) {
    const design = designs.find((item) => compatibleOffer(item, garment, placementKey));
    if (design) return { design, placementKey };
  }
  return null;
}

export function placementLabel(key: BrandPlacementKey) {
  return OFFER_DEFS[key].label;
}


// Compatibility helpers retained for older dashboard code while Brand Builder v4 uses multi-placement offers.
export function designOffer(design?: BrandDesign) {
  const offers = design ? enabledDesignOffers(design) : [];
  const first = offers.find((item) => item.key === "front-full")
    || offers.find((item) => item.key === "front-heart")
    || offers.find((item) => item.key === "back-full");
  return first
    ? { retailPrice: first.retailPrice, side: first.side, printSize: first.printSize }
    : { retailPrice: 0, side: "front" as DesignSide, printSize: "full" as PrintSize };
}

export function offerKey(offer: { side: DesignSide; printSize: PrintSize }) {
  if (offer.side === "back") return "back-full" as BrandPlacementKey;
  return offer.printSize === "heart" ? "front-heart" as BrandPlacementKey : "front-full" as BrandPlacementKey;
}

export function compatibleDesign(design: BrandDesign, garment: BrandStoreProduct) {
  return (["front-heart", "front-full", "back-full"] as BrandPlacementKey[]).some((key) => compatibleOffer(design, garment, key));
}

export function garmentSupportsOffer(
  garment: { configuration: any },
  offer: { side: DesignSide; printSize: PrintSize }
) {
  return garmentSupportsPlacement(garment, offerKey(offer));
}

export function designPlacementLabel(design: BrandDesign) {
  return placementLabel(offerKey(designOffer(design)));
}
