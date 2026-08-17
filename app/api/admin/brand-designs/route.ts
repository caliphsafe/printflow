import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { slugifyBrand } from "@/lib/brand-designs";
import type { BrandPlacementKey } from "@/lib/brand-types";

const PLACEMENTS: BrandPlacementKey[] = ["front-heart", "front-full", "back-full"];

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

  const incomingOffers = input.customerOffers && typeof input.customerOffers === "object" ? input.customerOffers : {};
  const customerOffers = Object.fromEntries(
    PLACEMENTS.map((placementKey) => {
      const row = incomingOffers[placementKey] && typeof incomingOffers[placementKey] === "object" ? incomingOffers[placementKey] : {};
      return [placementKey, {
        enabled: row.enabled === true,
        retailPrice: Math.max(0, Number(row.retailPrice || 0))
      }];
    })
  );

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
    metadata: { customerOffers }
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

  // Keep the legacy placement table synchronized with every enabled customer placement.
  await supabase.from("brand_design_placements").delete().eq("brand_design_id", designId);

  const productRules = Array.isArray(input.productRules) ? input.productRules : [];
  const legacyPlacementRows: any[] = [];

  for (const placementKey of PLACEMENTS) {
    const offer = customerOffers[placementKey] as { enabled: boolean; retailPrice: number };
    if (!offer.enabled) continue;

    const firstPlacement = productRules
      .map((rule: any) => rule?.placements?.[placementKey])
      .find((placement: any) => placement?.enabled);

    if (!firstPlacement) continue;

    const side = placementKey === "back-full" ? "back" : "front";
    const placementType = placementKey === "front-heart" ? "heart" : "full";

    legacyPlacementRows.push({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      brand_design_id: designId,
      side,
      placement_type: placementType,
      label: placementKey === "front-heart" ? "Front Heart" : placementKey === "front-full" ? "Front Full" : "Back Full",
      decoration_method: firstPlacement.decorationMethod || null,
      width_inches: Number(firstPlacement.widthInches || 0) || null,
      height_inches: Number(firstPlacement.heightInches || 0) || null,
      surcharge: offer.retailPrice,
      active: true,
      configuration: { placementKey }
    });
  }

  if (legacyPlacementRows.length) {
    const legacyResult = await supabase.from("brand_design_placements").insert(legacyPlacementRows);
    if (legacyResult.error) return NextResponse.json({ error: legacyResult.error.message }, { status: 400 });
  }

  // Save every garment rule with ALL placement versions intact.
  await supabase.from("brand_design_product_rules").delete().eq("brand_design_id", designId);

  const ruleRows = productRules
    .filter((rule: any) => rule?.productId)
    .map((rule: any) => {
      const placements = Object.fromEntries(
        PLACEMENTS
          .filter((placementKey) => rule.placements?.[placementKey])
          .map((placementKey) => [placementKey, rule.placements[placementKey]])
      );

      // Keep garment approvals persisted even when a customer placement is temporarily turned off.
      // Public availability is controlled by customerOffers; the rule remains so re-enabling a
      // placement does not erase the Brand owner's garment setup.
      const active = Object.values(placements).some((placement: any) => Boolean(placement?.enabled));

      return {
        organization_id: membership.organization_id,
        shop_id: shop.id,
        brand_design_id: designId,
        catalog_product_id: String(rule.productId),
        active,
        configuration: { placements }
      };
    });

  if (ruleRows.length) {
    const rules = await supabase.from("brand_design_product_rules").insert(ruleRows);
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
