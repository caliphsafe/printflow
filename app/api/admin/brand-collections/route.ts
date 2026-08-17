import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { slugifyBrand } from "@/lib/brand-designs";

async function replaceMemberships(
  supabase: any,
  collectionId: string,
  designIds: string[],
  productIds: string[]
) {
  await Promise.all([
    supabase.from("brand_collection_designs").delete().eq("collection_id", collectionId),
    supabase.from("brand_collection_products").delete().eq("collection_id", collectionId)
  ]);

  if (designIds.length) {
    const result = await supabase.from("brand_collection_designs").insert(
      designIds.map((brand_design_id, index) => ({
        collection_id: collectionId,
        brand_design_id,
        sort_order: index
      }))
    );
    if (result.error) throw result.error;
  }

  if (productIds.length) {
    const result = await supabase.from("brand_collection_products").insert(
      productIds.map((catalog_product_id, index) => ({
        collection_id: collectionId,
        catalog_product_id,
        sort_order: index
      }))
    );
    if (result.error) throw result.error;
  }
}

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Collection name is required." }, { status: 400 });

  const { data, error } = await supabase
    .from("brand_collections")
    .insert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      name,
      slug: slugifyBrand(name),
      description: String(body.description || "").trim() || null,
      active: body.active !== false,
      featured: body.featured === true,
      sort_order: Math.max(0, Number(body.sortOrder || 0)),
      metadata: {}
    })
    .select("*")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message || "Unable to create collection." }, { status: 400 });

  try {
    await replaceMemberships(
      supabase,
      data.id,
      Array.from(new Set((body.designIds || []).map(String))),
      Array.from(new Set((body.productIds || []).map(String)))
    );
  } catch (caught) {
    await supabase.from("brand_collections").delete().eq("id", data.id);
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Unable to assign collection items." }, { status: 400 });
  }

  return NextResponse.json({ collection: { ...data, designIds: body.designIds || [], productIds: body.productIds || [] } });
}

export async function PATCH(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Collection is required." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim();
    patch.slug = slugifyBrand(body.name);
  }
  if (typeof body.description === "string") patch.description = body.description.trim() || null;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.featured === "boolean") patch.featured = body.featured;

  if (Object.keys(patch).length) {
    const updated = await supabase.from("brand_collections").update(patch).eq("id", id).eq("shop_id", shop.id);
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
  }

  if (Array.isArray(body.designIds) || Array.isArray(body.productIds)) {
    try {
      await replaceMemberships(
        supabase,
        id,
        Array.from(new Set((body.designIds || []).map(String))),
        Array.from(new Set((body.productIds || []).map(String)))
      );
    } catch (caught) {
      return NextResponse.json({ error: caught instanceof Error ? caught.message : "Unable to save collection items." }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  const { error } = await supabase.from("brand_collections").delete().eq("id", id).eq("shop_id", shop.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
