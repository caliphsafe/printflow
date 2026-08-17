import { garmentContrast } from "@/lib/brand-designs";
import type { BrandMerchProduct } from "@/lib/brand-retail";
import type { BrandDesign, BrandStoreProduct } from "@/lib/brand-types";

export type BrandProductIssueCode =
  | "NO_GARMENT"
  | "GARMENT_HIDDEN"
  | "NO_DESIGN"
  | "DESIGN_HIDDEN"
  | "NO_PLACEMENT"
  | "NO_COLORS"
  | "NO_SIZES"
  | "NO_PRICE"
  | "MISSING_LIGHT_ART"
  | "MISSING_DARK_ART"
  | "DRAFT";

export type BrandProductReadiness = {
  ready: boolean;
  publishable: boolean;
  label: string;
  issues: Array<{ code: BrandProductIssueCode; label: string; actionHref: string }>;
};

export function brandProductReadiness(
  product: BrandMerchProduct,
  garments: BrandStoreProduct[],
  designs: BrandDesign[]
): BrandProductReadiness {
  const issues: BrandProductReadiness["issues"] = [];
  const garment = garments.find((item) => item.brandGarmentId === product.brand_garment_id);
  const design = designs.find((item) => item.id === product.brand_design_id);

  if (!garment) {
    issues.push({ code: "NO_GARMENT", label: "Brand garment is missing", actionHref: "/dashboard/brand-garments" });
  } else if (garment.active === false) {
    issues.push({ code: "GARMENT_HIDDEN", label: "Brand garment is hidden", actionHref: "/dashboard/brand-garments" });
  }

  if (!design) {
    issues.push({ code: "NO_DESIGN", label: "Approved design is missing", actionHref: "/dashboard/designs" });
  } else if (!design.active) {
    issues.push({ code: "DESIGN_HIDDEN", label: "Design is hidden", actionHref: "/dashboard/designs" });
  }

  if (garment && design) {
    const rule = design.productRules.find((item) => item.productId === garment.id);
    const placement = rule?.placements?.[product.placement_key];
    if (!placement?.enabled) {
      issues.push({ code: "NO_PLACEMENT", label: "Locked placement is missing", actionHref: "/dashboard/designs" });
    }

    const offeredColors = garment.configuration.colors.filter((item) => product.configuration.colorIds.includes(item.id));
    const contrasts = new Set(offeredColors.map((item) => garmentContrast(item as any)));
    const variantTypes = new Set(design.variants.filter((item) => item.active && item.artwork_path).map((item) => item.variant_type));
    const universal = variantTypes.has("universal");

    if (contrasts.has("light") && !universal && !variantTypes.has("light")) {
      issues.push({ code: "MISSING_LIGHT_ART", label: "Light-garment artwork is missing", actionHref: "/dashboard/designs" });
    }
    if (contrasts.has("dark") && !universal && !variantTypes.has("dark")) {
      issues.push({ code: "MISSING_DARK_ART", label: "Dark-garment artwork is missing", actionHref: "/dashboard/designs" });
    }
  }

  if (!product.configuration.colorIds.length) {
    issues.push({ code: "NO_COLORS", label: "No customer colors selected", actionHref: "/dashboard/brand-products" });
  }
  if (!product.configuration.sizes.length) {
    issues.push({ code: "NO_SIZES", label: "No customer sizes selected", actionHref: "/dashboard/brand-products" });
  }
  if (Number(product.retail_price || 0) <= 0) {
    issues.push({ code: "NO_PRICE", label: "Retail price is missing", actionHref: "/dashboard/brand-products" });
  }
  if (!product.active) {
    issues.push({ code: "DRAFT", label: "Product is still Draft", actionHref: "/dashboard/brand-products" });
  }

  const blocking = issues.filter((item) => item.code !== "DRAFT");
  const publishable = blocking.length === 0;
  const ready = publishable && product.active;

  return {
    ready,
    publishable,
    label: ready ? "READY" : publishable ? "READY TO PUBLISH" : blocking.length === 1 ? "1 ISSUE" : `${blocking.length} ISSUES`,
    issues
  };
}

export function brandStoreReadiness({
  businessActive,
  paymentReady,
  products,
  garments,
  designs
}: {
  businessActive: boolean;
  paymentReady: boolean;
  products: BrandMerchProduct[];
  garments: BrandStoreProduct[];
  designs: BrandDesign[];
}) {
  const productStates = products.map((item) => ({ product: item, readiness: brandProductReadiness(item, garments, designs) }));
  const readyProducts = productStates.filter((item) => item.readiness.ready);
  const publishableProducts = productStates.filter((item) => item.readiness.publishable);

  const steps = [
    { key: "garments", label: "Brand garments", done: garments.length > 0, href: "/dashboard/brand-garments" },
    { key: "designs", label: "Approved designs", done: designs.length > 0, href: "/dashboard/designs" },
    { key: "products", label: "Retail products", done: publishableProducts.length > 0, href: "/dashboard/brand-products" },
    { key: "payments", label: "Payments", done: paymentReady, href: "/dashboard/integrations" },
    { key: "published", label: "Store published", done: businessActive, href: "/dashboard/brand-settings" }
  ];

  const completion = Math.round(steps.filter((item) => item.done).length / steps.length * 100);
  const next = steps.find((item) => !item.done) || null;

  return { productStates, readyProducts, publishableProducts, steps, completion, next };
}
