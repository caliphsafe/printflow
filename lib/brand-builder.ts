import { garmentContrast } from "@/lib/brand-designs";
import type { BrandDesign, BrandLockedPlacement, BrandStoreProduct } from "@/lib/brand-types";
import type { DesignSide, PrintSize, ShirtColor } from "@/lib/types";

export type BrandDesignOffer = {
  retailPrice: number;
  side: DesignSide;
  printSize: PrintSize;
};

export function garmentRetailPrice(garment?: BrandStoreProduct) {
  return Math.max(0, Number((garment?.configuration as any)?.brandRetailPrice || 0));
}

export function designOffer(design?: BrandDesign): BrandDesignOffer {
  const metadata = design?.metadata && typeof design.metadata === "object" ? design.metadata as Record<string, any> : {};
  const offer = metadata.customerOffer && typeof metadata.customerOffer === "object" ? metadata.customerOffer : {};
  return {
    retailPrice: Math.max(0, Number(offer.retailPrice || 0)),
    side: offer.side === "back" ? "back" : "front",
    printSize: offer.printSize === "heart" ? "heart" : "full"
  };
}



export function garmentSupportsOffer(garment: { configuration: any }, offer: BrandDesignOffer) {
  const customization = garment.configuration?.customization || {};
  if (offer.side === "front" && customization.frontEnabled === false) return false;
  if (offer.side === "back" && customization.backEnabled !== true) return false;
  if (offer.side === "back" && offer.printSize !== "full") return false;
  const printSizes = Array.isArray(customization.printSizes) ? customization.printSizes : ["heart", "full"];
  return printSizes.includes(offer.printSize);
}

export function offerKey(offer: BrandDesignOffer) {
  return `${offer.side}-${offer.printSize}`;
}

export function lockedPlacementFor(design: BrandDesign, garment: BrandStoreProduct): BrandLockedPlacement | undefined {
  const offer = designOffer(design);
  const rule = design.productRules.find((item) => item.productId === garment.id);
  return rule?.placements?.[offerKey(offer)];
}

export function compatibleDesign(design: BrandDesign, garment: BrandStoreProduct) {
  return Boolean(design.active && lockedPlacementFor(design, garment)?.enabled);
}

export function designArtworkVariant(design: BrandDesign, color?: ShirtColor) {
  const contrast = color ? garmentContrast(color as any) : "light";
  return design.variants.find((item) => item.active && item.variant_type === contrast && item.artwork_path)
    || design.variants.find((item) => item.active && item.variant_type === "universal" && item.artwork_path)
    || design.variants.find((item) => item.active && item.artwork_path);
}

export function builderUnitPrice(garment: BrandStoreProduct, front?: BrandDesign, back?: BrandDesign) {
  return garmentRetailPrice(garment)
    + (front ? designOffer(front).retailPrice : 0)
    + (back ? designOffer(back).retailPrice : 0);
}

export function designPlacementLabel(design: BrandDesign) {
  const offer = designOffer(design);
  if (offer.side === "back") return "Back · Full";
  return offer.printSize === "heart" ? "Front · Heart" : "Front · Full";
}
