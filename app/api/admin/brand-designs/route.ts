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
    const result = await supabase.from("brand_design_categories").upsert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      name: newCategory,
      slug: slugifyBrand(newCategory),
      active: true
    }, { onConflict: "shop_id,slug" }).select("id").single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
    categoryId = result.data.id;
  }

  const offer = input.customerOffer && typeof input.customerOffer === "object" ? input.customerOffer : {};
  const side = offer.side === "back" ? "back" : "front";
  const printSize = side === "back" ? "full" : offer.printSize === "heart" ? "heart" : "full";
  const retailPrice = Math.max(0, Number(offer.retailPrice || 0));

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
    metadata: {
      customerOffer: { retailPrice, side, printSize }
    }
  };

  const result = input.id
    ? await supabase.from("brand_designs").update(record).eq("id", input.id).eq("shop_id", shop.id).select("*").single()
    : await supabase.from("brand_designs").insert(record).select("*").single();

  if (result.error || !result.data) return NextResponse.json({ error: result.error?.message || "Unable to save design." }, { status: 400 });
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
    const existing = await supabase.from("brand_design_variants").select("id").eq("brand_design_id", designId).eq("variant_type", variant.variant_type).maybeSingle();
    if (existing.data?.id) {
      const updated = await supabase.from("brand_design_variants").update(payload).eq("id", existing.data.id);
      if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 400 });
    } else {
      const inserted = await supabase.from("brand_design_variants").insert(payload);
      if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });
    }
  }

  // Legacy placement table remains synchronized so existing admin tooling never sees contradictory data.
  await supabase.from("brand_design_placements").delete().eq("brand_design_id", designId);
  const firstRulePlacement = (Array.isArray(input.productRules) ? input.productRules : [])
    .flatMap((rule: any) => Object.values(rule?.placements || {}))
    .find((placement: any) => placement?.enabled) as any;

  if (firstRulePlacement) {
    const placementResult = await supabase.from("brand_design_placements").insert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      brand_design_id: designId,
      side,
      placement_type: printSize,
      label: side === "back" ? "Back Full" : printSize === "heart" ? "Front Heart" : "Front Full",
      decoration_method: firstRulePlacement.decorationMethod || null,
      width_inches: Number(firstRulePlacement.widthInches || 0) || null,
      height_inches: Number(firstRulePlacement.heightInches || 0) || null,
      surcharge: retailPrice,
      active: true,
      configuration: {}
    });
    if (placementResult.error) return NextResponse.json({ error: placementResult.error.message }, { status: 400 });
  }

  await supabase.from("brand_design_product_rules").delete().eq("brand_design_id", designId);
  const productRules = Array.isArray(input.productRules) ? input.productRules : [];
  const rows = productRules.filter((rule: any) => rule?.productId).map((rule: any) => {
    const placement = rule.placements?.[`${side}-${printSize}`];
    return {
      organization_id: membership.organization_id,
      shop_id: shop.id,
      brand_design_id: designId,
      catalog_product_id: String(rule.productId),
      active: Boolean(placement?.enabled),
      configuration: { placements: placement?.enabled ? { [`${side}-${printSize}`]: placement } : {} }
    };
  });
  if (rows.length) {
    const rules = await supabase.from("brand_design_product_rules").insert(rows);
    if (rules.error) return NextResponse.json({ error: rules.error.message }, { status: 400 });
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
