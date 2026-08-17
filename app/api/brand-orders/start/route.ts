import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { makeDesignDisplayId } from "@/lib/design-id";
import { normalizeConfiguration } from "@/lib/catalog";
import { calculateResolvedOrderPricing, DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import { applyBrandContrast, chooseBrandVariant, compatiblePlacements, resolveLockedPlacement } from "@/lib/brand-designs";
import { platformShopAccess } from "@/lib/shop-mode";
import type { CatalogProduct, SizeQuantity } from "@/lib/types";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const admin = createSupabaseAdmin();

    const { data: shop } = await admin
      .from("shops")
      .select("*")
      .eq("slug", String(body.shopSlug || ""))
      .eq("active", true)
      .maybeSingle();

    if (!shop) return fail("Shop not found.", 404);
    if (!platformShopAccess(shop.settings).brandMerch) return fail("Brand ordering is not enabled.", 403);

    const { data: subscription } = await admin
      .from("subscription_accounts")
      .select("plan_code,status,current_period_end")
      .eq("organization_id", shop.organization_id)
      .maybeSingle();

    if (subscription) {
      const status = String(subscription.status || "trialing");
      const trialValid =
        status === "trialing" &&
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
          return fail("This storefront has reached its monthly order capacity.", 403);
        }
      }
    }

    const [
      { data: productRow },
      { data: designRow },
      { data: variants },
      { data: placementRow },
      { data: rule },
      { data: pricingRow }
    ] = await Promise.all([
      admin.from("catalog_products").select("id,slug,name,description,active,configuration").eq("id", body.productId).eq("shop_id", shop.id).eq("active", true).maybeSingle(),
      admin.from("brand_designs").select("*").eq("id", body.designId).eq("shop_id", shop.id).eq("active", true).maybeSingle(),
      admin.from("brand_design_variants").select("*").eq("brand_design_id", body.designId).eq("shop_id", shop.id).eq("active", true),
      admin.from("brand_design_placements").select("*").eq("id", body.placementId).eq("brand_design_id", body.designId).eq("shop_id", shop.id).eq("active", true).maybeSingle(),
      admin.from("brand_design_product_rules").select("id").eq("brand_design_id", body.designId).eq("catalog_product_id", body.productId).eq("active", true).maybeSingle(),
      admin.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle()
    ]);

    if (!productRow || !designRow || !placementRow || !rule) {
      return fail("That Brand combination is unavailable.");
    }

    const product: CatalogProduct = applyBrandContrast({
      ...productRow,
      configuration: normalizeConfiguration(productRow.configuration)
    } as CatalogProduct, shop.settings);

    const color = product.configuration.colors.find((item) => item.id === body.colorId && item.active !== false);
    if (!color) return fail("Selected garment color is unavailable.");

    const expectedVariant = chooseBrandVariant((variants || []) as any, color as any);
    if (!expectedVariant || expectedVariant.id !== body.variantId) {
      return fail("The selected artwork variant does not match this garment color.");
    }

    if (!compatiblePlacements(product, [placementRow] as any).length) {
      return fail("That placement is not supported by this garment.");
    }

    const sizes: SizeQuantity[] = Array.isArray(body.sizes)
      ? body.sizes.map((item: any) => ({
          size: String(item.size),
          quantity: Math.max(0, Math.floor(Number(item.quantity || 0)))
        }))
      : [];

    const total = sizes.reduce((sum, item) => sum + item.quantity, 0);
    const minimum = Math.max(1, Number((designRow.metadata || {}).minimumQuantity || 1));

    if (total < minimum) return fail(`Order at least ${minimum} item${minimum === 1 ? "" : "s"}.`);
    if (!body.customer?.name?.trim() || !body.customer?.email?.trim()) {
      return fail("Customer name and email are required.");
    }

    const resolved = resolveLockedPlacement(product, placementRow as any);
    const method =
      placementRow.decoration_method ||
      product.configuration.customization.decorationMethods[0] ||
      "Screen Print";

    if (!product.configuration.customization.decorationMethods.includes(method)) {
      return fail("That production method is unavailable.");
    }

    const profile = normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE);
    const pricing = calculateResolvedOrderPricing({
      profile,
      product,
      sizes,
      color,
      printSelections: {
        [placementRow.side]: {
          printSize: placementRow.placement_type,
          placement: resolved.placement,
          inkColors: 1
        }
      },
      decorationMethod: method,
      designOptimizationRequested: false,
      selectedAddOnIds: []
    });

    const designSurcharge = Math.max(0, Number(placementRow.surcharge || 0)) * total;
    const totalPrice = Number((pricing.totalPrice + designSurcharge).toFixed(2));

    const supplierItems: any[] = [];
    const supplier = product.configuration.supplier;

    if (supplier) {
      for (const size of sizes.filter((item) => item.quantity > 0)) {
        const variant = supplier.variants.find(
          (item) => item.colorName === color.name && item.sizeName === size.size && item.active !== false
        );

        if (!variant) {
          return fail(`${color.name} / ${size.size} is unavailable from ${supplier.supplierName || supplier.provider}.`);
        }

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
          quantity: size.quantity,
          unitCost: variant.customerPrice,
          inventorySnapshot: variant.quantity,
          imageUrl: color.frontImageUrl || product.configuration.mockupImageUrl || "",
          productId: product.id
        });
      }
    }

    const displayId = makeDesignDisplayId();
    const previewPath = `${shop.id}/${displayId}/${placementRow.side}-preview.png`;

    const filename = String(expectedVariant.original_filename || `${designRow.slug}.png`);
    const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const productionCopyPath = `${shop.id}/${displayId}/${placementRow.side}-brand-original.${ext}`;

    const sourceFile = await admin.storage.from("brand-artwork").download(expectedVariant.artwork_path);
    if (sourceFile.error || !sourceFile.data) {
      return fail("Unable to prepare Brand production artwork.", 500);
    }

    const copied = await admin.storage
      .from("artwork")
      .upload(productionCopyPath, sourceFile.data, {
        contentType: expectedVariant.mime_type || "image/png",
        upsert: false
      });

    if (copied.error) return fail("Unable to prepare Brand production artwork.", 500);

    const sideData: Record<string, any> = {
      [placementRow.side]: {
        originalPath: productionCopyPath,
        previewPath,
        filename,
        mimeType: expectedVariant.mime_type || "image/png",
        placement: resolved.placement,
        printSize: placementRow.placement_type,
        garmentImageUrl: placementRow.side === "back" ? color.backImageUrl : color.frontImageUrl,
        locked: true,
        brandDesignId: designRow.id,
        brandDesignVariantId: expectedVariant.id
      }
    };

    const snapshot = {
      design: { id: designRow.id, name: designRow.name, slug: designRow.slug },
      variant: {
        id: expectedVariant.id,
        type: expectedVariant.variant_type,
        sourceArtworkPath: expectedVariant.artwork_path,
        productionCopyPath,
        filename,
        mimeType: expectedVariant.mime_type
      },
      placement: {
        id: placementRow.id,
        side: placementRow.side,
        printSize: placementRow.placement_type,
        decorationMethod: method,
        widthInches: placementRow.width_inches,
        heightInches: placementRow.height_inches,
        placement: resolved.placement,
        surcharge: placementRow.surcharge
      },
      product: { id: product.id, name: product.name },
      color: { id: color.id, name: color.name }
    };

    const { data: order, error } = await admin
      .from("designs")
      .insert({
        organization_id: shop.organization_id,
        shop_id: shop.id,
        display_id: displayId,
        status: "draft",
        order_source: "brand",
        brand_design_id: designRow.id,
        brand_design_variant_id: expectedVariant.id,
        brand_design_snapshot: snapshot,
        customer_name: body.customer.name.trim(),
        customer_email: body.customer.email.trim().toLowerCase(),
        customer_phone: body.customer.phone?.trim() || null,
        catalog_product_id: product.id,
        product_name: product.name,
        package_id: pricing.tierId || "brand-retail",
        package_label: `${total} items · Brand / Merch`,
        package_quantity: total,
        package_price: totalPrice,
        shirt_color_id: color.id,
        shirt_color_name: color.name,
        print_location: placementRow.side,
        size_breakdown: sizes,
        supplier_items: supplierItems,
        customer_notes: String(body.notes || "").trim() || null,
        original_artwork_path: productionCopyPath,
        preview_path: previewPath,
        original_filename: filename,
        original_mime_type: expectedVariant.mime_type || "image/png",
        checkout_url: `${new URL(request.url).origin}/order/${displayId}/success`,
        design_sides: sideData,
        design_configuration: {
          orderSource: "brand",
          brandDesignName: designRow.name,
          designMode: placementRow.side,
          decorationMethod: method,
          printSizes: { [placementRow.side]: placementRow.placement_type },
          quantity: total,
          pricingTierId: pricing.tierId || "brand-retail",
          garmentUnitPrice: pricing.garmentUnitPrice,
          garmentMarkupPercent: pricing.garmentMarkupPercent,
          supplierGarmentCost: pricing.supplierGarmentCost,
          garmentMarkupAmount: pricing.garmentMarkupAmount,
          garmentSubtotal: pricing.garmentSubtotal,
          garmentLines: pricing.garmentLines,
          printLines: pricing.printLines,
          printSubtotal: pricing.printSubtotal,
          discountTierLabel: pricing.discountTierLabel,
          unitPrice: pricing.unitPrice,
          merchandiseSubtotal: pricing.merchandiseSubtotal,
          setupFee: pricing.setupFee,
          designSurcharge,
          addOns: [],
          addOnTotal: 0,
          totalPrice,
          productId: product.id,
          colorId: color.id,
          lockedPlacement: true
        }
      })
      .select("id,display_id")
      .single();

    if (error || !order) {
      await admin.storage.from("artwork").remove([productionCopyPath]);
      return fail(error?.message || "Unable to create Brand order.", 500);
    }

    const preview = await admin.storage.from("previews").createSignedUploadUrl(previewPath);
    if (preview.error) return fail("Unable to prepare mockup upload.", 500);

    return NextResponse.json({
      designId: order.id,
      displayId: order.display_id,
      verifiedTotal: totalPrice,
      previewUpload: {
        bucket: "previews",
        path: previewPath,
        token: preview.data.token
      }
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unexpected error.", 500);
  }
}
