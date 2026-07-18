import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { makeDesignDisplayId } from "@/lib/design-id";
import { normalizeConfiguration } from "@/lib/catalog";
import { DEFAULT_PRICING_PROFILE, calculateResolvedOrderPricing, normalizePricingProfile } from "@/lib/pricing-settings";
import { normalizeShopSettings } from "@/lib/shop-settings";
import type { CatalogProduct, DesignMode, DesignSide, PrintSize, SizeQuantity } from "@/lib/types";

type ArtPayload = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  placement: unknown;
  printSize?: PrintSize;
};

type Payload = {
  shopSlug: string;
  customer: { name: string; email: string; phone?: string };
  configuration: {
    productId: string;
    packageId: string;
    colorId: string;
    designMode: DesignMode;
    decorationMethod: string;
    printSizes: Partial<Record<DesignSide, PrintSize>>;
    inkColors?: Partial<Record<DesignSide, number>>;
    sizes: SizeQuantity[];
    notes?: string;
    totalPrice: number;
    quantity?: number;
    designOptimizationRequested?: boolean;
    selectedAddOnIds?: string[];
  };
  artworks: Partial<Record<DesignSide, ArtPayload>>;
};

const jsonError = (error: string, status = 400) => NextResponse.json({ error }, { status });
const extension = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
};
const validPrintSize = (value: unknown): value is PrintSize => value === "heart" || value === "full";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Payload;
    const supabase = createSupabaseAdmin();
    const { data: shop } = await supabase.from("shops").select("*").eq("slug", payload.shopSlug).eq("active", true).single();
    if (!shop) return jsonError("Shop not found.", 404);

    const settings = normalizeShopSettings(shop.settings);
    const [{ data: rows }, { data: pricingRow }] = await Promise.all([
      supabase
        .from("catalog_products")
        .select("id,slug,name,description,active,configuration")
        .eq("shop_id", shop.id)
        .eq("active", true),
      supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle()
    ]);
    const profile = normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE);
    const products: CatalogProduct[] = (rows || []).map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) })).filter((item) => item.configuration.supplier?.sourceMode !== "demo");

    const product = products.find((item) => item.id === payload.configuration.productId);
    if (!product) return jsonError("Product is unavailable.");
    const color = product.configuration.colors.find((item) => item.id === payload.configuration.colorId && item.active !== false);
    if (!color) return jsonError("Selected product option is unavailable.");
    if (!product.configuration.customization.designModes.includes(payload.configuration.designMode)) return jsonError("That design placement is unavailable.");
    if (!product.configuration.customization.decorationMethods.includes(payload.configuration.decorationMethod)) return jsonError("That decoration method is unavailable.");

    const required: DesignSide[] = payload.configuration.designMode === "front-back" ? ["front", "back"] : [payload.configuration.designMode];
    const printSizes: Partial<Record<DesignSide, PrintSize>> = {};
    for (const side of required) {
      const art = payload.artworks?.[side];
      const printSize = payload.configuration.printSizes?.[side];
      if (!art) return jsonError(`Upload ${side} artwork.`);
      if (!validPrintSize(printSize)) return jsonError(`Choose Heart Size or Full Size for the ${side}.`);
      printSizes[side] = printSize;
      if (art.sizeBytes <= 0 || art.sizeBytes > settings.upload.maxBytes) return jsonError(`${side} artwork is too large.`);
      if (!settings.upload.acceptedTypes.includes(art.mimeType)) return jsonError(`${side} artwork type is not accepted.`);
    }

    const sizes = Array.isArray(payload.configuration.sizes) ? payload.configuration.sizes : [];
    const total = sizes.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
    const minimumQuantity = Math.max(12, product.configuration.customization.minimumQuantity);
    if (total < minimumQuantity) return jsonError(`Order quantity must be at least ${minimumQuantity}.`);

    const selectedAddOnIds = Array.from(new Set((payload.configuration.selectedAddOnIds || []).map(String)));
    const pricing = calculateResolvedOrderPricing({
      profile,
      product,
      sizes,
      color,
      printSelections: Object.fromEntries(required.map((side) => [side, {
        printSize: printSizes[side]!,
        placement: payload.artworks[side]?.placement as any,
        inkColors: Math.max(1, Number(payload.configuration.inkColors?.[side] || 1))
      }])),
      decorationMethod: payload.configuration.decorationMethod,
      designOptimizationRequested: payload.configuration.designOptimizationRequested === true,
      selectedAddOnIds
    });
    if (!pricing.tierId) return jsonError("Product pricing is unavailable.");
    if (!payload.customer?.name?.trim() || !payload.customer?.email?.trim()) return jsonError("Customer name and email are required.");

    const supplierItems: any[] = [];
    const supplier = product.configuration.supplier;
    if (supplier) {
      for (const size of sizes.filter((item) => item.quantity > 0)) {
        const variant = supplier.variants.find(
          (item) => item.colorName === color.name && item.sizeName === size.size && item.active !== false
        );
        if (!variant) return jsonError(`${color.name} / ${size.size} is unavailable from ${supplier.supplierName || supplier.provider}.`);
        supplierItems.push({
          provider: supplier.provider,
          supplierName: supplier.supplierName || supplier.provider,
          sourceMode: supplier.sourceMode || "live",
          sku: variant.sku,
          skuId: variant.skuId,
          gtin: variant.gtin,
          brandName: supplier.brandName,
          styleName: supplier.styleName,
          colorName: variant.colorName,
          sizeName: variant.sizeName,
          quantity: Number(size.quantity),
          unitCost: variant.customerPrice,
          inventorySnapshot: variant.quantity
        });
      }
    }

    const displayId = makeDesignDisplayId();
    const sideData: Record<string, any> = {};
    const uploads: Record<string, any> = {};
    for (const side of required) {
      const art = payload.artworks[side]!;
      const originalPath = `${shop.id}/${displayId}/${side}-original.${extension(art.filename)}`;
      const previewPath = `${shop.id}/${displayId}/${side}-preview.png`;
      sideData[side] = {
        originalPath,
        previewPath,
        filename: art.filename,
        mimeType: art.mimeType,
        placement: art.placement,
        printSize: printSizes[side],
        garmentImageUrl: side === "front" ? color.frontImageUrl : color.backImageUrl
      };
    }

    const primary = sideData[required[0]];
    const { data: design, error } = await supabase
      .from("designs")
      .insert({
        organization_id: shop.organization_id,
        shop_id: shop.id,
        display_id: displayId,
        status: "draft",
        customer_name: payload.customer.name.trim(),
        customer_email: payload.customer.email.trim().toLowerCase(),
        customer_phone: payload.customer.phone?.trim() || null,
        catalog_product_id: product.id === "legacy-product" ? null : product.id,
        product_name: product.name,
        package_id: pricing.tierId,
        package_label: `${total} items · $${pricing.unitPrice.toFixed(2)} merchandise each`,
        package_quantity: total,
        package_price: pricing.totalPrice,
        shirt_color_id: color.id,
        shirt_color_name: color.name,
        print_location: payload.configuration.designMode,
        size_breakdown: sizes,
        supplier_items: supplierItems,
        customer_notes: payload.configuration.notes?.trim() || null,
        original_artwork_path: primary.originalPath,
        preview_path: primary.previewPath,
        original_filename: primary.filename,
        original_mime_type: primary.mimeType,
        checkout_url: `${new URL(request.url).origin}/order/${displayId}/success`,
        design_sides: sideData,
        design_configuration: {
          designMode: payload.configuration.designMode,
          decorationMethod: pricing.decorationMethod,
          decorationPercentage: pricing.decorationPercentage,
          printSizes,
          quantity: total,
          pricingTierId: pricing.tierId,
          garmentUnitPrice: pricing.garmentUnitPrice,
          garmentMarkupPercent: pricing.garmentMarkupPercent,
          supplierGarmentCost: pricing.supplierGarmentCost,
          garmentMarkupAmount: pricing.garmentMarkupAmount,
          garmentSubtotal: pricing.garmentSubtotal,
          garmentLines: pricing.garmentLines,
          printLines: pricing.printLines,
          printSubtotal: pricing.printSubtotal,
          discountTierLabel: pricing.discountTierLabel,
          inkColors: payload.configuration.inkColors || {},
          baseFrontPrintUnitPrice: pricing.baseFrontPrintUnitPrice,
          baseBackPrintUnitPrice: pricing.baseBackPrintUnitPrice,
          frontPrintUnitPrice: pricing.frontPrintUnitPrice,
          backPrintUnitPrice: pricing.backPrintUnitPrice,
          unitPrice: pricing.unitPrice,
          merchandiseSubtotal: pricing.merchandiseSubtotal,
          setupFee: pricing.setupFee,
          setupFeeLabel: profile.orderSetupFee.label,
          designOptimizationRequested: pricing.designOptimizationRequested,
          designOptimizationFee: pricing.designOptimizationFee,
          designOptimizationLabel: profile.designOptimizationFee.label,
          addOns: pricing.addOns,
          addOnTotal: pricing.addOnTotal,
          totalPrice: pricing.totalPrice,
          productId: product.id,
          colorId: color.id
        }
      })
      .select("id,display_id")
      .single();
    if (error || !design) return jsonError(error?.message || "Unable to create design session.", 500);

    for (const side of required) {
      const data = sideData[side];
      const original = await supabase.storage.from("artwork").createSignedUploadUrl(data.originalPath);
      const preview = await supabase.storage.from("previews").createSignedUploadUrl(data.previewPath);
      if (original.error || preview.error) return jsonError("Unable to prepare secure uploads.", 500);
      uploads[side] = {
        original: { bucket: "artwork", path: data.originalPath, token: original.data.token },
        preview: { bucket: "previews", path: data.previewPath, token: preview.data.token }
      };
    }

    return NextResponse.json({ designId: design.id, displayId: design.display_id, uploads, verifiedTotal: pricing.totalPrice });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unexpected error.", 500);
  }
}
