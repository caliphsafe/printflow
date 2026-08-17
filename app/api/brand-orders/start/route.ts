import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { makeDesignDisplayId } from "@/lib/design-id";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import {
  builderUnitPrice,
  compatibleOffer,
  designArtworkVariant,
  designOffers,
  garmentRetailPrice,
  lockedPlacementFor
} from "@/lib/brand-builder";
import { platformShopAccess } from "@/lib/shop-mode";
import type { BrandDesign, BrandPlacementKey, BrandStoreProduct } from "@/lib/brand-types";
import type { CatalogProduct, DesignSide, SizeQuantity } from "@/lib/types";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const admin = createSupabaseAdmin();

    const { data: shopRow } = await admin
      .from("shops")
      .select("id,organization_id,slug,name,settings,active")
      .eq("slug", String(body.shopSlug || ""))
      .maybeSingle();

    if (!shopRow) return fail("Brand store not found.", 404);

    // Narrow once, then use the non-null alias everywhere below.
    const shop = shopRow;

    if (!platformShopAccess(shop.settings).brandMerch) {
      return fail("Brand commerce is not enabled.", 403);
    }

    const { data: business } = await admin
      .from("brand_business_profiles")
      .select("settings")
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (business?.settings?.active !== true) {
      return fail("This Brand storefront is not published.", 403);
    }

    const { data: subscription } = await admin
      .from("subscription_accounts")
      .select("plan_code,status,current_period_end")
      .eq("organization_id", shop.organization_id)
      .maybeSingle();

    if (subscription) {
      const status = String(subscription.status || "trialing");
      const trialValid =
        status === "trialing" &&
        (!subscription.current_period_end ||
          new Date(subscription.current_period_end).getTime() > Date.now());

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
        const monthStart = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
        ).toISOString();

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

    const garmentId = String(body.brandGarmentId || "");

    const { data: garmentRow } = await admin
      .from("brand_garments")
      .select("id,source_catalog_product_id,active,configuration")
      .eq("id", garmentId)
      .eq("shop_id", shop.id)
      .eq("active", true)
      .maybeSingle();

    if (!garmentRow) return fail("This garment is unavailable.", 404);

    const { data: sourceRow } = await admin
      .from("catalog_products")
      .select("id,slug,name,description,active,configuration")
      .eq("id", garmentRow.source_catalog_product_id)
      .eq("shop_id", shop.id)
      .maybeSingle();

    if (!sourceRow) return fail("The source garment is unavailable.");

    const source: CatalogProduct = {
      ...sourceRow,
      configuration: normalizeConfiguration(sourceRow.configuration)
    };

    const configured = applyBrandGarmentConfiguration(
      source,
      garmentRow.configuration
    );

    if (!configured) return fail("This Brand garment is unavailable.");

    const garment: BrandStoreProduct = {
      ...configured,
      brandGarmentId: garmentRow.id
    } as BrandStoreProduct;

    const color = garment.configuration.colors.find(
      (item) => item.id === String(body.colorId || "")
    );

    if (!color) return fail("Choose an available garment color.");

    const sizes: SizeQuantity[] = Array.isArray(body.sizes)
      ? body.sizes
          .map((item: any) => ({
            size: String(item.size),
            quantity: Math.max(
              0,
              Math.floor(Number(item.quantity || 0))
            )
          }))
          .filter((item: SizeQuantity) =>
            garment.configuration.sizes.includes(item.size)
          )
      : [];

    const quantity = sizes.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    if (quantity < 1) {
      return fail("Choose at least one item.");
    }

    if (
      !body.customer?.name?.trim() ||
      !body.customer?.email?.trim()
    ) {
      return fail("Customer name and email are required.");
    }

    const shopId = shop.id;

    async function loadDesign(
      id: unknown
    ): Promise<BrandDesign | undefined> {
      const designId = String(id || "");
      if (!designId) return undefined;

      const [
        { data: row },
        { data: variants },
        { data: rule }
      ] = await Promise.all([
        admin
          .from("brand_designs")
          .select("*")
          .eq("id", designId)
          .eq("shop_id", shopId)
          .eq("active", true)
          .maybeSingle(),
        admin
          .from("brand_design_variants")
          .select("*")
          .eq("brand_design_id", designId)
          .eq("shop_id", shopId)
          .eq("active", true),
        admin
          .from("brand_design_product_rules")
          .select("catalog_product_id,configuration,active")
          .eq("brand_design_id", designId)
          .eq("catalog_product_id", garment.id)
          .eq("active", true)
          .maybeSingle()
      ]);

      if (!row || !rule) return undefined;

      return {
        ...row,
        variants: variants || [],
        productIds: [garment.id],
        productRules: [
          {
            productId: garment.id,
            placements: rule.configuration?.placements || {}
          }
        ]
      } as BrandDesign;
    }

    const frontPlacementKey: BrandPlacementKey | undefined =
      body.frontSelection?.placementKey === "front-heart"
        ? "front-heart"
        : body.frontSelection?.placementKey === "front-full"
          ? "front-full"
          : undefined;

    const backPlacementKey: BrandPlacementKey | undefined =
      body.backSelection?.placementKey === "back-full"
        ? "back-full"
        : undefined;

    const [frontDesign, backDesign] = await Promise.all([
      loadDesign(body.frontSelection?.designId || body.frontDesignId),
      loadDesign(body.backSelection?.designId || body.backDesignId)
    ]);

    if (!frontDesign && !backDesign) {
      return fail("Choose at least one design.");
    }

    if (frontDesign) {
      if (!frontPlacementKey || !compatibleOffer(frontDesign, garment, frontPlacementKey)) {
        return fail("The selected front design and placement are not approved for this garment.");
      }

      if (!designArtworkVariant(frontDesign, color)) {
        return fail("The front design does not have artwork for this garment color.");
      }
    }

    if (backDesign) {
      if (!backPlacementKey || !compatibleOffer(backDesign, garment, backPlacementKey)) {
        return fail("The selected back design and placement are not approved for this garment.");
      }

      if (!designArtworkVariant(backDesign, color)) {
        return fail("The back design does not have artwork for this garment color.");
      }
    }

    const garmentPrice = garmentRetailPrice(garment);

    if (garmentPrice <= 0) {
      return fail("This garment does not have a customer price.");
    }

    const unitPrice = builderUnitPrice({
      garment,
      frontDesign,
      frontPlacement: frontPlacementKey as "front-heart" | "front-full" | undefined,
      backDesign
    });

    const totalPrice = Number((unitPrice * quantity).toFixed(2));

    if (totalPrice <= 0) {
      return fail("This order does not have a valid price.");
    }

    const supplierItems: any[] = [];
    let supplierGarmentCost = 0;
    const supplier = garment.configuration.supplier;

    if (supplier) {
      for (const size of sizes.filter((item) => item.quantity > 0)) {
        const variant = supplier.variants.find(
          (item) =>
            item.active !== false &&
            item.colorName === color.name &&
            item.sizeName === size.size
        );

        if (!variant) {
          return fail(
            `${color.name} / ${size.size} is currently unavailable from ${
              supplier.supplierName || supplier.provider
            }.`
          );
        }

        supplierGarmentCost +=
          Number(variant.customerPrice || 0) * size.quantity;

        supplierItems.push({
          provider: supplier.provider,
          supplierName:
            supplier.supplierName || supplier.provider,
          sourceMode: supplier.sourceMode || "live",
          sku: variant.sku,
          skuId: variant.skuId,
          gtin: variant.gtin,
          brandName: supplier.brandName,
          styleName: supplier.styleName,
          colorName: variant.colorName,
          sizeName: variant.sizeName,
          quantity: size.quantity,
          unitCost: Number(variant.customerPrice || 0),
          inventorySnapshot: variant.quantity,
          imageUrl:
            color.frontImageUrl ||
            garment.configuration.mockupImageUrl ||
            "",
          productId: garment.id
        });
      }
    }

    const displayId = makeDesignDisplayId();
    const sideData: Record<string, any> = {};
    const previewUploads: Record<string, any> = {};
    const copiedPaths: string[] = [];

    let primaryOriginalPath = "";
    let primaryPreviewPath = "";
    let primaryFilename = "";
    let primaryMime = "";

    for (const side of ["front", "back"] as DesignSide[]) {
      const design =
        side === "front" ? frontDesign : backDesign;

      const previewPath = `${shop.id}/${displayId}/${side}-brand-builder-mockup.png`;

      let originalPath = "";
      let filename = "";
      let mimeType = "image/svg+xml";
      let placement: any = null;
      let artworkId: string | null = null;

      if (design) {
        const placementKey: BrandPlacementKey = side === "front" ? frontPlacementKey! : "back-full";
        placement = lockedPlacementFor(design, garment, placementKey)!;

        const artwork = designArtworkVariant(
          design,
          color
        )!;

        filename = String(
          artwork.original_filename || `${design.slug}.png`
        );

        const ext =
          filename
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "png";

        originalPath = `${shop.id}/${displayId}/${side}-brand-original.${ext}`;
        mimeType = artwork.mime_type || "image/png";
        artworkId = artwork.id;

        const downloaded = await admin.storage
          .from("brand-artwork")
          .download(artwork.artwork_path);

        if (downloaded.error || !downloaded.data) {
          return fail(
            `Unable to prepare ${side} production artwork.`,
            500
          );
        }

        const uploaded = await admin.storage
          .from("artwork")
          .upload(originalPath, downloaded.data, {
            contentType: mimeType,
            upsert: false
          });

        if (uploaded.error) {
          return fail(
            `Unable to save ${side} production artwork.`,
            500
          );
        }
      } else {
        filename = "no-design-selected.svg";
        originalPath = `${shop.id}/${displayId}/${side}-no-design.svg`;

        const blankSvg = new Blob(
          [
            `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="100%" height="100%" fill="white"/><text x="300" y="100" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="24" fill="#222">No ${side} design selected</text></svg>`
          ],
          { type: "image/svg+xml" }
        );

        const uploaded = await admin.storage
          .from("artwork")
          .upload(originalPath, blankSvg, {
            contentType: "image/svg+xml",
            upsert: false
          });

        if (uploaded.error) {
          return fail(
            `Unable to save ${side} production note.`,
            500
          );
        }
      }

      copiedPaths.push(originalPath);

      const signed = await admin.storage
        .from("previews")
        .createSignedUploadUrl(previewPath);

      if (signed.error) {
        return fail(
          `Unable to prepare ${side} mockup.`,
          500
        );
      }

      previewUploads[side] = {
        bucket: "previews",
        path: previewPath,
        token: signed.data.token
      };

      sideData[side] = {
        originalPath,
        previewPath,
        filename,
        mimeType,
        placement: placement?.placement || null,
        printSize: placement?.printSize || null,
        garmentImageUrl:
          side === "back"
            ? color.backImageUrl
            : color.frontImageUrl,
        locked: Boolean(design),
        blankSide: !design,
        brandDesignId: design?.id || null,
        brandDesignVariantId: artworkId,
        designName:
          design?.name || "No design selected",
        designPrice: design
          ? designOffers(design)[side === "front" ? frontPlacementKey! : "back-full"].retailPrice
          : 0
      };

      if (!primaryOriginalPath && design) {
        primaryOriginalPath = originalPath;
        primaryPreviewPath = previewPath;
        primaryFilename = filename;
        primaryMime = mimeType;
      }
    }

    const selectedDesigns = [frontDesign, backDesign].filter(
      Boolean
    ) as BrandDesign[];

    const placementKeyForDesign = (design: BrandDesign): BrandPlacementKey =>
      frontDesign?.id === design.id && frontPlacementKey ? frontPlacementKey : "back-full";

    const selectedOfferForDesign = (design: BrandDesign) =>
      designOffers(design)[placementKeyForDesign(design)];

    const snapshot = {
      builderVersion: 4,
      garment: {
        brandGarmentId: garment.brandGarmentId,
        sourceCatalogProductId: garment.id,
        name: garment.name,
        colorId: color.id,
        colorName: color.name,
        retailPrice: garmentPrice
      },
      designs: selectedDesigns.map((design) => ({
        id: design.id,
        name: design.name,
        offer: selectedOfferForDesign(design),
        placementKey: placementKeyForDesign(design),
        placement: lockedPlacementFor(
          design,
          garment,
          placementKeyForDesign(design)
        )
      })),
      unitPrice,
      quantity,
      totalPrice
    };

    const designMode =
      frontDesign && backDesign
        ? "front-back"
        : frontDesign
          ? "front"
          : "back";

    const { data: order, error: orderError } = await admin
      .from("designs")
      .insert({
        organization_id: shop.organization_id,
        shop_id: shop.id,
        display_id: displayId,
        status: "draft",
        order_source: "brand",
        brand_design_id:
          frontDesign?.id || backDesign?.id || null,
        brand_design_variant_id: null,
        brand_design_snapshot: snapshot,
        customer_name: body.customer.name.trim(),
        customer_email: body.customer.email
          .trim()
          .toLowerCase(),
        customer_phone:
          body.customer.phone?.trim() || null,
        catalog_product_id: garment.id,
        product_name: garment.name,
        package_id: `brand-builder:${garment.brandGarmentId}`,
        package_label: `${garment.name} · Custom Brand Design`,
        package_quantity: quantity,
        package_price: totalPrice,
        shirt_color_id: color.id,
        shirt_color_name: color.name,
        print_location: designMode,
        size_breakdown: sizes,
        supplier_items: supplierItems,
        customer_notes:
          String(body.notes || "").trim() || null,
        original_artwork_path: primaryOriginalPath,
        preview_path: primaryPreviewPath,
        original_filename: primaryFilename,
        original_mime_type: primaryMime,
        checkout_url: `${new URL(request.url).origin}/order/${displayId}/success`,
        design_sides: sideData,
        design_configuration: {
          orderSource: "brand",
          brandBuilderVersion: 4,
          designMode,
          decorationMethod: selectedDesigns
            .map(
              (d) =>
                lockedPlacementFor(
                  d,
                  garment,
                  placementKeyForDesign(d)
                )?.decorationMethod
            )
            .filter(Boolean)
            .join(" + "),
          printSizes: {
            front: frontDesign && frontPlacementKey
              ? designOffers(frontDesign)[frontPlacementKey].printSize
              : undefined,
            back: backDesign ? "full" : undefined
          },
          quantity,
          unitPrice,
          garmentRetailPrice: garmentPrice,
          supplierGarmentCost,
          garmentSubtotal: Number(
            (garmentPrice * quantity).toFixed(2)
          ),
          garmentMarkupAmount: Number(
            (
              garmentPrice * quantity -
              supplierGarmentCost
            ).toFixed(2)
          ),
          garmentMarkupPercent:
            supplierGarmentCost > 0
              ? Number(
                  (
                    ((garmentPrice * quantity -
                      supplierGarmentCost) /
                      supplierGarmentCost) *
                    100
                  ).toFixed(2)
                )
              : 0,
          designSelections: selectedDesigns.map(
            (design) => ({
              id: design.id,
              name: design.name,
              side: selectedOfferForDesign(design).side,
              placementKey: placementKeyForDesign(design),
              printSize:
                selectedOfferForDesign(design).printSize,
              retailPrice:
                selectedOfferForDesign(design).retailPrice
            })
          ),
          designAddOnTotalPerItem:
            selectedDesigns.reduce(
              (sum, design) =>
                sum + selectedOfferForDesign(design).retailPrice,
              0
            ),
          printSubtotal: Number(
            (
              selectedDesigns.reduce(
                (sum, design) =>
                  sum +
                  selectedOfferForDesign(design).retailPrice,
                0
              ) * quantity
            ).toFixed(2)
          ),
          printLines: selectedDesigns.map(
            (design) => ({
              side: selectedOfferForDesign(design).side,
              placementKey: placementKeyForDesign(design),
              printSize:
                selectedOfferForDesign(design).printSize,
              unitPrice:
                selectedOfferForDesign(design).retailPrice,
              designName: design.name
            })
          ),
          merchandiseSubtotal: totalPrice,
          totalPrice,
          productId: garment.id,
          brandGarmentId: garment.brandGarmentId,
          colorId: color.id,
          lockedPlacement: true
        }
      })
      .select("id,display_id")
      .single();

    if (orderError || !order) {
      if (copiedPaths.length) {
        await admin.storage
          .from("artwork")
          .remove(copiedPaths);
      }

      return fail(
        orderError?.message ||
          "Unable to create Brand order.",
        500
      );
    }

    return NextResponse.json({
      designId: order.id,
      displayId: order.display_id,
      unitPrice,
      totalPrice,
      previewUploads
    });
  } catch (caught) {
    return fail(
      caught instanceof Error
        ? caught.message
        : "Unexpected Brand checkout error.",
      500
    );
  }
}
