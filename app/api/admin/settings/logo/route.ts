import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"]
]);

export async function POST(request: Request) {
  const { shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json();
  const mimeType = String(body.mimeType || "");
  const sizeBytes = Number(body.sizeBytes || 0);
  const extension = ALLOWED.get(mimeType);
  if (!extension) return NextResponse.json({ error: "Use PNG, JPG, WEBP or SVG for the logo." }, { status: 400 });
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Logo must be smaller than 5 MB." }, { status: 400 });
  }

  const path = `${shop.id}/logo-${Date.now()}.${extension}`;
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.storage.from("branding").createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || "Unable to prepare logo upload." }, { status: 500 });
  const { data: publicData } = admin.storage.from("branding").getPublicUrl(path);
  return NextResponse.json({ bucket: "branding", path, token: data.token, publicUrl: publicData.publicUrl });
}
