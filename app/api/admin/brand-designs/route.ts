import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { slugifyBrand } from "@/lib/brand-designs";

export async function POST(request: Request) {
  const { supabase, membership, shop } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const input = body.design || {};
  const name = String(input.name || "").trim();
  if (!name) return NextResponse.json({ error: "Design name is required." }, { status: 400 });

  let categoryId = input.categoryId ? String(input.categoryId) : null;
  const newCategory = String(input.newCategory || "").trim();
  if (newCategory) {
    const result = await supabase
      .from("brand_design_categories")
      .upsert({
        organization_id: membership.organization_id,
        shop_id: shop.id,
        name: newCategory,
        slug: slugifyBrand(newCategory),
        active: true
      }, { onConflict: "shop_id,slug" })
      .select("id")
      .single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    categoryId = result.data.id;
  }

  const record = {
    organization_id: membership.organization_id,
    shop_id: shop.id,
    category_id: categoryId,
    name,
    slug: slugifyBrand(name),
    description: String(input.description || "").trim() || null,
    active: input.active !== false,
    featured: input.featured === true,
    sort_order: Math.max(0, Number(input.sortOrder || 0)),
    metadata: {}
  };

  const result = input.id
    ? await supabase.from("brand_designs").update(record).eq("id", input.id).eq("shop_id", shop.id).select("*").single()
    : await supabase.from("brand_designs").insert(record).select("*").single();

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error?.message || "Unable to save design." }, { status: 400 });
  }

  const designId = result.data.id;

  for (const variant of Array.isArray(input.variants) ? input.variants : []) {
    if (!variant.artwork_path) continue;

    const payload = {
      organization_id: membership.organization_id,
      shop_id: shop.id,
      brand_design_id: designId,
      variant_type: variant.variant_type,
      artwork_path: variant.artwork_path,
      original_filename: variant.original_filename || null,
      mime_type: variant.mime_type || null,
      preview_url: null,
      active: variant.active !== false,
      metadata: {}
    };

    const existing = await supabase
      .from("brand_design_variants")
      .select("id")
      .eq("brand_design_id", designId)
      .eq("variant_type", variant.variant_type)
      .maybeSingle();

    if (existing.data?.id) {
      const updated = await supabase.from("brand_design_variants").update(payload).eq("id", existing.data.id);
      if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
    } else {
      const inserted = await supabase.from("brand_design_variants").insert(payload);
      if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });
    }
  }

  await supabase.from("brand_design_placements").delete().eq("brand_design_id", designId);
  const placements = (Array.isArray(input.placements) ? input.placements : [])
    .filter((item: any) => item.active)
    .map((item: any) => ({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      brand_design_id: designId,
      side: item.side,
      placement_type: item.placement_type,
      label: item.label || null,
      decoration_method: item.decoration_method || null,
      width_inches: Number(item.width_inches || 0) || null,
      height_inches: Number(item.height_inches || 0) || null,
      surcharge: Math.max(0, Number(item.surcharge || 0)),
      active: true,
      configuration: item.configuration || {}
    }));

  if (placements.length) {
    const placementResult = await supabase.from("brand_design_placements").insert(placements);
    if (placementResult.error) return NextResponse.json({ error: placementResult.error.message }, { status: 400 });
  }

  await supabase.from("brand_design_product_rules").delete().eq("brand_design_id", designId);

  const productRules = Array.isArray(input.productRules) ? input.productRules : [];
  if (productRules.length) {
    const rows = productRules
      .filter((rule: any) => rule?.productId)
      .map((rule: any) => ({
        organization_id: membership.organization_id,
        shop_id: shop.id,
        brand_design_id: designId,
        catalog_product_id: String(rule.productId),
        active: true,
        configuration: {
          placements: rule.placements && typeof rule.placements === "object" ? rule.placements : {}
        }
      }));

    if (rows.length) {
      const ruleResult = await supabase.from("brand_design_product_rules").insert(rows);
      if (ruleResult.error) {
        return NextResponse.json({ error: ruleResult.error.message }, { status: 400 });
      }
    }
  }

  const contrastUpdates = Array.isArray(input.contrastUpdates) ? input.contrastUpdates : [];
  for (const update of contrastUpdates) {
    const productId = String(update.productId || "");
    if (!productId) continue;

    const { data: garment } = await supabase
      .from("brand_garments")
      .select("id,configuration")
      .eq("shop_id", shop.id)
      .eq("source_catalog_product_id", productId)
      .maybeSingle();

    if (!garment) continue;

    const configuration = garment.configuration && typeof garment.configuration === "object"
      ? garment.configuration as Record<string, any>
      : {};
    const nextContrast = { ...(configuration.colorContrast || {}) };

    for (const color of Array.isArray(update.colors) ? update.colors : []) {
      const colorId = String(color.id || "");
      if (!colorId) continue;

      if (color.contrastMode === "light" || color.contrastMode === "dark") {
        nextContrast[colorId] = color.contrastMode;
      } else {
        delete nextContrast[colorId];
      }
    }

    const updated = await supabase
      .from("brand_garments")
      .update({
        configuration: { ...configuration, colorContrast: nextContrast }
      })
      .eq("id", garment.id);

    if (updated.error) {
      return NextResponse.json({ error: updated.error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, designId });
}

export async function DELETE(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Design id is required." }, { status: 400 });

  const result = await supabase.from("brand_designs").delete().eq("id", id).eq("shop_id", shop.id);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
