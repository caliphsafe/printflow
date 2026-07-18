import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";

export async function GET(request: Request) {
  const { supabase, membership } = await getAdminContext();
  if (!membership) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  let query = supabase
    .from("supplier_catalog_styles")
    .select("*,supplier_catalog_variants(*)")
    .eq("active", true)
    .eq("source_mode", "demo")
    .order("brand_name");
  if (q) query = query.or(`brand_name.ilike.%${q}%,style_name.ilike.%${q}%,title.ilike.%${q}%,part_number.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ styles: data || [] });
}
