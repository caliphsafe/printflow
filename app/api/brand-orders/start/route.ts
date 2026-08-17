import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { makeDesignDisplayId } from "@/lib/design-id";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import { chooseBrandVariant } from "@/lib/brand-designs";
import {
  calculateBrandEconomics,
  maxSupplierCostForOptions,
  normalizeBrandProductConfiguration,
  normalizeBrandRetailProfile,
  resolvedBrandRetailPrice
} from "@/lib/brand-retail";
import { platformShopAccess } from "@/lib/shop-mode";
import type { BrandDesignVariant, BrandLockedPlacement } from "@/lib/brand-types";
import type { CatalogProduct, SizeQuantity } from "@/lib/types";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const admin = createSupabaseAdmin();

    const { data: shop } = await admin
      .from("shops")
      .select("id,organization_id,slug,name,settings,active")
      .eq("slug", String(body.shopSlug || ""))
      .maybeSingle();

    if (!shop) return fail("Brand store not found.", 404);
    if (!platformShopAccess(shop.settings).brandMerch) return fail("Brand commerce is not enabled.", 403);

    const { data: brandBusiness } = await admin
      .from("brand_business_profiles")
      .select("settings")
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (brandBusiness?.settings?.active !== true) {
      return fail("This Brand storefront is not published.", 403);
    }

    const { data: subscription } = await admin
      .from("subscription_accounts")
      .select("plan_code,status,current_period_end")
      .eq("organization_id", shop.organization_id)
      .maybeSingle();

    if (subscription) {
      const status = String(subscription.status || "trialing");
      const trialValid = status === "trialing" &&
        (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now());

      if (!(["active", "pilot"].includes(status) || trialValid)) {
        return fail("This storefront is temporarily unavailable.", 403);
      }

      const { data: plan } = await admin
        .from("subscription_plans")
        .select("order_limit")
        .eq("code", subscription.plan_code)
        .eq("active", true)
        .maybeSingle();

      if (plan?.order_limit) {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        const { count } = await admin
          .from("designs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", shop.organization_id)
          .gte("created_at", monthStart);

        if (Number(count || 0) >= Number(plan.order_limit)) {
          return fail("This account has reached its monthly order capacity.", 403);
        }
      }
    }

    const brandProductId = String(body.brandProductId || "");
    const { data: merchRow } = await admin
      .from("brand_products")
      .select("*")
      .eq("id", brandProductId)
      .eq("shop_id", shop.id)
      .eq("active", true)
      .maybeSingle();

    if (!merchRow) return fail("This Brand product is unavailable.", 404);

    const [
      { data: garmentRow },
      { data: designRow },
      { data: variants },
      { data: retailRow }
    ] = await Promise.all([
      admin.from("brand_garments").select("id,source_catalog_product_id,active,configuration").eq("id", merchRow.brand_garment_id).eq("shop_id", shop.id).eq("active", true).maybeSingle(),
      admin.from("brand_designs").select("*").eq("id", merchRow.brand_design_id).eq("shop_id", shop.id).eq("active", true).maybeSingle(),
      admin.from("brand_design_variants").select("*").eq("brand_design_id", merchRow.brand_design_id).eq("shop_id", shop.id).eq("active", true),
      admin.from("brand_retail_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle()
    ]);

    if (!garmentRow || !designRow) return fail("This Brand product is not fully configured.");

    const { data: ruleRow } = await admin
      .from("brand_design_product_rules")
      .select("catalog_product_id,configuration")
      .eq("brand_design_id", merchRow.brand_design_id)
      .eq("catalog_product_id", garmentRow.source_catalog_product_id)
      .eq("active", true)
      .maybeSingle();

    if (!ruleRow) return fail("The approved design no longer matches this garment.");

    const { data: sourceRow } = await admin
      .from("catalog_products")
      .select("id,slug,name,description,active,configuration")
      .eq("id", garmentRow.source_catalog_product_id)
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (!sourceRow) return fail("The source garment is unavailable.");

    const source: CatalogProduct = { ...sourceRow, configuration: normalizeConfiguration(sourceRow.configuration) };
    const garment = applyBrandGarmentConfiguration(source, garmentRow.configuration);
    if (!garment) return fail("The Brand garment is unavailable.");

    const configuration = normalizeBrandProductConfiguration(merchRow.configuration, garment);
    const color = garment.configuration.colors.find((item) => item.id === body.colorId && configuration.colorIds.includes(item.id));
    if (!color) return fail("Choose an available product color.");

    const sizes: SizeQuantity[] = Array.isArray(body.sizes)
      ? body.sizes.map((item: any) => ({
          size: String(item.size),
          quantity: Math.max(0, Math.floor(Number(item.quantity || 0)))
        })).filter((item: SizeQuantity) => configuration.sizes.includes(item.size))
      : [];

    const totalQuantity = sizes.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity < 1) return fail("Choose at least one item.");
    if (!body.customer?.name?.trim() || !body.customer?.email?.trim()) return fail("Customer name and email are required.");

    const placements = ruleRow.configuration?.placements || {};
    const placement = placements[merchRow.placement_key] as BrandLockedPlacement | undefined;
    if (!placement?.enabled) return fail("The approved product placement is unavailable.");

    const variant = chooseBrandVariant((variants || []) as BrandDesignVariant[], color as any);
    if (!variant) return fail("Artwork is unavailable for this garment color.");

    const retailProfile = normalizeBrandRetailProfile(retailRow?.configuration);
    const maxBlankCost = maxSupplierCostForOptions(garment, configuration.colorIds, configuration.sizes);

    const unitPrice = resolvedBrandRetailPrice({
      profile: retailProfile,
      pricingMode: merchRow.pricing_mode === "target_margin" ? "target_margin" : "manual",
      manualRetailPrice: Number(merchRow.retail_price || 0),
      targetMarginPercent: merchRow.target_margin_percent ? Number(merchRow.target_margin_percent) : retailProfile.defaultTargetMarginPercent,
      supplierCost: maxBlankCost,
      placement,
      inkColors: configuration.inkColors,
      stitchEstimate: configuration.stitchEstimate,
      productionCostOverride: configuration.productionCostOverride
    });

    if (unitPrice <= 0) return fail("This product does not have a valid retail price.");
    const totalPrice = Number((unitPrice * totalQuantity).toFixed(2));

    const supplierItems: any[] = [];
    let actualBlankCostTotal = 0;
    const supplier = garment.configuration.supplier;

    if (supplier) {
      for (const size of sizes.filter((item) => item.quantity > 0)) {
        const supplierVariant = supplier.variants.find((item) =>
          item.active !== false &&
          item.colorName === color.name &&
          item.sizeName === size.size
        );

        if (!supplierVariant) {
          return fail(`${color.name} / ${size.size} is currently unavailable from ${supplier.supplierName || supplier.provider}.`);
        }

        const unitCost = Number(supplierVariant.customerPrice || 0);
        actualBlankCostTotal += unitCost * size.quantity;

        supplierItems.push({
          provider: supplier.provider,
          supplierName: supplier.supplierName || supplier.provider,
          sourceMode: supplier.sourceMode || "live",
          sku: supplierVariant.sku,
          skuId: supplierVariant.skuId,
          gtin: supplierVariant.gtin,
          brandName: supplier.brandName,
          styleName: supplier.styleName,
          colorName: supplierVariant.colorName,
          sizeName: supplierVariant.sizeName,
          quantity: size.quantity,
          unitCost,
          inventorySnapshot: supplierVariant.quantity,
          imageUrl: color.frontImageUrl || garment.configuration.mockupImageUrl || "",
          productId: garment.id
        });
      }
    } else {
      actualBlankCostTotal = Number(garment.configuration.manualUnitCost || 0) * totalQuantity;
    }

    const actualBlankCostPerItem = totalQuantity ? actualBlankCostTotal / totalQuantity : maxBlankCost;
    const economics = calculateBrandEconomics({
      profile: retailProfile,
      supplierCost: actualBlankCostPerItem,
      placement,
      retailPrice: unitPrice,
      inkColors: configuration.inkColors,
      stitchEstimate: configuration.stitchEstimate,
      productionCostOverride: configuration.productionCostOverride
    });

    const displayId = makeDesignDisplayId();
    const previewPath = `${shop.id}/${displayId}/${placement.side}-brand-product-preview.png`;
    const filename = String(variant.original_filename || `${designRow.slug}.png`);
    const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const productionCopyPath = `${shop.id}/${displayId}/${placement.side}-brand-original.${ext}`;

    const sourceArtwork = await admin.storage.from("brand-artwork").download(variant.artwork_path);
    if (sourceArtwork.error || !sourceArtwork.data) return fail("Unable to prepare Brand production artwork.", 500);

    const copied = await admin.storage
      .from("artwork")
      .upload(productionCopyPath, sourceArtwork.data, {
        contentType: variant.mime_type || "image/png",
        upsert: false
      });

    if (copied.error) return fail("Unable to prepare Brand production artwork.", 500);

    const brandSnapshot = {
      brandProduct: {
        id: merchRow.id,
        name: merchRow.name,
        slug: merchRow.slug,
        retailUnitPrice: unitPrice,
        pricingMode: merchRow.pricing_mode,
        compareAtPrice: merchRow.compare_at_price
      },
      garment: {
        brandGarmentId: garmentRow.id,
        sourceCatalogProductId: garment.id,
        name: garment.name,
        colorId: color.id,
        colorName: color.name
      },
      design: {
        id: designRow.id,
        name: designRow.name,
        variantId: variant.id,
        variantType: variant.variant_type
      },
      placement: {
        key: merchRow.placement_key,
        side: placement.side,
        printSize: placement.printSize,
        decorationMethod: placement.decorationMethod,
        widthInches: placement.widthInches,
        heightInches: placement.heightInches,
        placement: placement.placement
      },
      economics: {
        supplierCostPerItem: economics.supplierCost,
        productionCostPerItem: economics.productionCost,
        packagingCostPerItem: economics.packagingCost,
        fulfillmentCostPerItem: economics.fulfillmentCost,
        paymentReservePerItem: economics.paymentReserve,
        estimatedCostPerItem: economics.totalEstimatedCost,
        grossProfitPerItem: economics.grossProfit,
        estimatedMarginPercent: economics.marginPercent
      }
    };

    const sideData: Record<string, any> = {
      [placement.side]: {
        originalPath: productionCopyPath,
        previewPath,
        filename,
        mimeType: variant.mime_type || "image/png",
        placement: placement.placement,
        printSize: placement.printSize,
        garmentImageUrl: placement.side === "back" ? color.backImageUrl : color.frontImageUrl,
        locked: true,
        brandProductId: merchRow.id,
        brandDesignId: designRow.id,
        brandDesignVariantId: variant.id
      }
    };

    const { data: order, error: orderError } = await admin
      .from("designs")
      .insert({
        organization_id: shop.organization_id,
        shop_id: shop.id,
        display_id: displayId,
        status: "draft",
        order_source: "brand",
        brand_design_id: designRow.id,
        brand_design_variant_id: variant.id,
        brand_design_snapshot: brandSnapshot,
        customer_name: body.customer.name.trim(),
        customer_email: body.customer.email.trim().toLowerCase(),
        customer_phone: body.customer.phone?.trim() || null,
        catalog_product_id: garment.id,
        product_name: merchRow.name,
        package_id: `brand-product:${merchRow.id}`,
        package_label: merchRow.name,
        package_quantity: totalQuantity,
        package_price: totalPrice,
        shirt_color_id: color.id,
        shirt_color_name: color.name,
        print_location: placement.side,
        size_breakdown: sizes,
        supplier_items: supplierItems,
        customer_notes: String(body.notes || "").trim() || null,
        original_artwork_path: productionCopyPath,
        preview_path: previewPath,
        original_filename: filename,
        original_mime_type: variant.mime_type || "image/png",
        checkout_url: `${new URL(request.url).origin}/order/${displayId}/success`,
        design_sides: sideData,
        design_configuration: {
          orderSource: "brand",
          brandProductId: merchRow.id,
          brandProductName: merchRow.name,
          brandGarmentId: garmentRow.id,
          designMode: placement.side,
          decorationMethod: placement.decorationMethod,
          printSizes: { [placement.side]: placement.printSize },
          quantity: totalQuantity,
          unitPrice,
          merchandiseSubtotal: totalPrice,
          setupFee: 0,
          addOns: [],
          addOnTotal: 0,
          totalPrice,
          productId: garment.id,
          colorId: color.id,
          lockedPlacement: true,
          brandEconomics: {
            estimatedCostPerItem: economics.totalEstimatedCost,
            grossProfitPerItem: economics.grossProfit,
            marginPercent: economics.marginPercent,
            retailUnitPrice: unitPrice
          }
        }
      })
      .select("id,display_id")
      .single();

    if (orderError || !order) {
      await admin.storage.from("artwork").remove([productionCopyPath]);
      return fail(orderError?.message || "Unable to create Brand order.", 500);
    }

    const preview = await admin.storage.from("previews").createSignedUploadUrl(previewPath);
    if (preview.error) return fail("Unable to prepare Brand product preview.", 500);

    return NextResponse.json({
      designId: order.id,
      displayId: order.display_id,
      unitPrice,
      totalPrice,
      previewUpload: {
        bucket: "previews",
        path: previewPath,
        token: preview.data.token
      }
    });
  } catch (caught) {
    return fail(caught instanceof Error ? caught.message : "Unexpected Brand checkout error.", 500);
  }
}
