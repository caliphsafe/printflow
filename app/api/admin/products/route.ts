import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_CONFIGURATION, normalizeConfiguration, normalizeDecorationMethods, slugify } from "@/lib/catalog";
import { decodeHtmlEntities } from "@/lib/html-entities";

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const name = decodeHtmlEntities(String(body.name || "").trim());
  if (!name) return NextResponse.json({ error: "Product name is required." }, { status: 400 });
  const requestedMethods = body.configuration?.customization?.decorationMethods;
  if (Array.isArray(requestedMethods) && !normalizeDecorationMethods(requestedMethods).length) {
    return NextResponse.json({ error: "Choose at least one supported decoration method for this product." }, { status: 400 });
  }
  if (Array.isArray(requestedMethods)) {
    body.configuration.customization.decorationMethods = normalizeDecorationMethods(requestedMethods);
  }

  const baseSlug = slugify(String(body.slug || name));
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data: match } = await supabase.from("catalog_products").select("id").eq("shop_id", shop.id).eq("slug", slug).maybeSingle();
    if (!match) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const { data, error } = await supabase
    .from("catalog_products")
    .insert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      slug,
      name,
      description: String(body.description || "").trim() || null,
      active: body.active !== false,
      configuration: normalizeConfiguration(body.configuration || DEFAULT_CONFIGURATION)
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ product: data });
}
