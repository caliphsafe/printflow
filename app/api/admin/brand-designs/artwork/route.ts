import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml"
};

function extension(filename: string) {
  return filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

export async function POST(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const filename = String(body.filename || "");
  const ext = extension(filename);
  const mimeType = MIME[ext];
  if (!mimeType) return NextResponse.json({ error: "Use PNG, JPG, WEBP, or SVG." }, { status: 400 });

  const sizeBytes = Number(body.sizeBytes || 0);
  if (sizeBytes <= 0 || sizeBytes > 500 * 1024 * 1024) {
    return NextResponse.json({ error: "Artwork must be 500 MB or smaller." }, { status: 400 });
  }

  const variant = ["light", "dark", "universal"].includes(String(body.variantType)) ? String(body.variantType) : "universal";
  const folder = String(body.designId || "draft").replace(/[^a-zA-Z0-9_-]/g, "");
  const path = `${shop.id}/${folder}/${variant}-${Date.now()}.${ext}`;

  const signed = await supabase.storage.from("brand-artwork").createSignedUploadUrl(path);
  if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 400 });

  return NextResponse.json({
    bucket: "brand-artwork",
    path,
    token: signed.data.token,
    contentType: mimeType
  });
}
