import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { makeDesignDisplayId, safeExtension } from "@/lib/design-id";
import type { ShopSettings, SizeQuantity } from "@/lib/types";

type StartPayload = {
  shopSlug: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  configuration: {
    packageId: string;
    colorId: string;
    printLocation: string;
    sizes: SizeQuantity[];
    notes?: string;
  };
  artwork: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
  };
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as StartPayload;

    if (!payload.shopSlug || !payload.customer?.name || !payload.customer?.email) {
      return jsonError("Missing required customer or shop information.");
    }

    const supabase = createSupabaseAdmin();

    const { data: shop, error: shopError } = await supabase
      .from("shops")
      .select("id, organization_id, slug, name, settings")
      .eq("slug", payload.shopSlug)
      .eq("active", true)
      .single();

    if (shopError || !shop) {
      return jsonError("Shop not found.", 404);
    }

    const settings = shop.settings as ShopSettings;
    const selectedPackage = settings.packages.find(
      (item) => item.id === payload.configuration.packageId
    );
    const selectedColor = settings.colors.find(
      (item) => item.id === payload.configuration.colorId
    );

    if (!selectedPackage || !selectedColor) {
      return jsonError("Invalid product package or color.");
    }

    if (!settings.printLocations.includes(payload.configuration.printLocation)) {
      return jsonError("Invalid print location.");
    }

    const allowedSizes = new Set(settings.sizes);
    const sizeTotal = payload.configuration.sizes.reduce((sum, item) => {
      if (!allowedSizes.has(item.size) || !Number.isInteger(item.quantity) || item.quantity < 0) {
        throw new Error("Invalid size selection.");
      }
      return sum + item.quantity;
    }, 0);

    if (sizeTotal !== selectedPackage.quantity) {
      return jsonError(
        `Size quantities must total ${selectedPackage.quantity}.`
      );
    }

    if (
      payload.artwork.sizeBytes <= 0 ||
      payload.artwork.sizeBytes > settings.upload.maxBytes
    ) {
      return jsonError("Artwork file is larger than this shop allows.");
    }

    if (!settings.upload.acceptedTypes.includes(payload.artwork.mimeType)) {
      return jsonError("Artwork file type is not accepted.");
    }

    const displayId = makeDesignDisplayId();
    const originalExt = safeExtension(payload.artwork.filename);
    const originalPath = `${shop.id}/${displayId}/original.${originalExt}`;
    const previewPath = `${shop.id}/${displayId}/preview.png`;

    const { data: design, error: designError } = await supabase
      .from("designs")
      .insert({
        organization_id: shop.organization_id,
        shop_id: shop.id,
        display_id: displayId,
        status: "draft",
        customer_name: payload.customer.name.trim(),
        customer_email: payload.customer.email.trim().toLowerCase(),
        customer_phone: payload.customer.phone?.trim() || null,
        product_name: settings.product.name,
        package_id: selectedPackage.id,
        package_label: selectedPackage.label,
        package_quantity: selectedPackage.quantity,
        package_price: selectedPackage.price,
        shirt_color_id: selectedColor.id,
        shirt_color_name: selectedColor.name,
        print_location: payload.configuration.printLocation,
        size_breakdown: payload.configuration.sizes,
        customer_notes: payload.configuration.notes?.trim() || null,
        original_artwork_path: originalPath,
        preview_path: previewPath,
        original_filename: payload.artwork.filename,
        original_mime_type: payload.artwork.mimeType,
        checkout_url: selectedPackage.checkoutUrl
      })
      .select("id, display_id")
      .single();

    if (designError || !design) {
      console.error(designError);
      return jsonError("Unable to create design session.", 500);
    }

    const [originalUpload, previewUpload] = await Promise.all([
      supabase.storage.from("artwork").createSignedUploadUrl(originalPath),
      supabase.storage.from("previews").createSignedUploadUrl(previewPath)
    ]);

    if (originalUpload.error || previewUpload.error) {
      console.error(originalUpload.error, previewUpload.error);
      return jsonError("Unable to prepare secure uploads.", 500);
    }

    return NextResponse.json({
      designId: design.id,
      displayId: design.display_id,
      uploads: {
        original: {
          bucket: "artwork",
          path: originalPath,
          token: originalUpload.data.token
        },
        preview: {
          bucket: "previews",
          path: previewPath,
          token: previewUpload.data.token
        }
      }
    });
  } catch (error) {
    console.error(error);
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error.",
      500
    );
  }
}
