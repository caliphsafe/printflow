import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const MAX_PRODUCT_IMAGE_BYTES = 25 * 1024 * 1024;
const EXTENSION_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml"
};

function cleanExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

export async function POST(request: Request) {
  try {
    const { shop } = await getAdminContext();
    if (!shop) return NextResponse.json({ error: "No shop is configured for this account." }, { status: 403 });

    const body = await request.json() as { filename?: string; mimeType?: string; sizeBytes?: number };
    const filename = String(body.filename || "").trim();
    const sizeBytes = Number(body.sizeBytes || 0);
    const ext = cleanExtension(filename);
    const contentType = EXTENSION_MIME[ext] || (body.mimeType === "image/jpg" ? "image/jpeg" : String(body.mimeType || ""));

    if (!filename || !EXTENSION_MIME[ext]) {
      return NextResponse.json({ error: "Use a PNG, JPG, JPEG, WEBP, or SVG garment image." }, { status: 400 });
    }
    if (sizeBytes <= 0) return NextResponse.json({ error: "The selected image is empty." }, { status: 400 });
    if (sizeBytes > MAX_PRODUCT_IMAGE_BYTES) {
      return NextResponse.json({ error: "Garment images must be 25 MB or smaller." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const path = `${shop.id}/${crypto.randomUUID()}.${ext === "jpg" ? "jpeg" : ext}`;
    const signed = await supabase.storage.from("product-images").createSignedUploadUrl(path, { upsert: false });
    if (signed.error || !signed.data) {
      return NextResponse.json({ error: signed.error?.message || "Unable to prepare the image upload." }, { status: 500 });
    }

    const { data: publicData } = supabase.storage.from("product-images").getPublicUrl(path);
    return NextResponse.json({
      bucket: "product-images",
      path,
      token: signed.data.token,
      publicUrl: publicData.publicUrl,
      contentType
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare the image upload." }, { status: 500 });
  }
}
