import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import {
  maxSupplierCostForOptions,
  normalizeBrandProductConfiguration,
  normalizeBrandRetailProfile,
  resolvedBrandRetailPrice,
  safeBrandSlug
} from "@/lib/brand-retail";
import type { BrandDesignProductRule } from "@/lib/brand-types";
import type { CatalogProduct } from "@/lib/types";

async function resolveContext(supabase: any, shopId: string, body: any) {
  const brandGarmentId = String(body.brandGarmentId || "");
  const designId = String(body.brandDesignId || "");
  const placementKey = String(body.placementKey || "");

  const [{ data: garmentRow }, { data: designRow }, { data: retailRow }] = await Promise.all([
    supabase.from("brand_garments").select("id,source_catalog_product_id,active,configuration").eq("id", brandGarmentId).eq("shop_id", shopId).eq("active", true).maybeSingle(),
    supabase.from("brand_designs").select("id,name,active").eq("id", designId).eq("shop_id", shopId).eq("active", true).maybeSingle(),
    supabase.from("brand_retail_profiles").select("configuration").eq("shop_id", shopId).maybeSingle()
  ]);

  if (!garmentRow || !designRow) throw new Error("Choose a valid Brand garment and approved design.");

  const { data: ruleRow } = await supabase
    .from("brand_design_product_rules")
    .select("catalog_product_id,configuration")
    .eq("brand_design_id", designId)
    .eq("catalog_product_id", garmentRow.source_catalog_product_id)
    .eq("active", true)
    .maybeSingle();

  if (!ruleRow) throw new Error("This design is not approved for the selected Brand garment.");

  const { data: sourceRow } = await supabase
    .from("catalog_products")
    .select("id,slug,name,description,active,configuration")
    .eq("id", garmentRow.source_catalog_product_id)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (!sourceRow) throw new Error("The source garment is unavailable.");

  const source: CatalogProduct = { ...sourceRow, configuration: normalizeConfiguration(sourceRow.configuration) };
  const garment = applyBrandGarmentConfiguration(source, garmentRow.configuration);
  if (!garment) throw new Error("This Brand garment is hidden.");

  const placements = (ruleRow.configuration?.placements || {}) as BrandDesignProductRule["placements"];
  const placement = placements[placementKey];
  if (!placement?.enabled) throw new Error("Choose a valid locked Brand placement.");

  return {
    garmentRow,
    designRow,
    garment,
    placement,
    profile: normalizeBrandRetailProfile(retailRow?.configuration)
  };
}

export async function POST(request: Request) {
  const { supabase, membership, shop, user } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  try {
    const context = await resolveContext(supabase, shop.id, body);
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "Product name is required." }, { status: 400 });

    const configuration = normalizeBrandProductConfiguration(body.configuration, context.garment);
    if (!configuration.colorIds.length || !configuration.sizes.length) {
      return NextResponse.json({ error: "Choose at least one color and size." }, { status: 400 });
    }

    const supplierCost = maxSupplierCostForOptions(context.garment, configuration.colorIds, configuration.sizes);

    const pricingMode = body.pricingMode === "target_margin" ? "target_margin" : "manual";
    const targetMargin = Math.max(0, Math.min(95, Number(body.targetMarginPercent ?? context.profile.defaultTargetMarginPercent)));
    const retailPrice = resolvedBrandRetailPrice({
      profile: context.profile,
      pricingMode,
      manualRetailPrice: Number(body.retailPrice || 0),
      targetMarginPercent: targetMargin,
      supplierCost,
      placement: context.placement,
      inkColors: configuration.inkColors,
      stitchEstimate: configuration.stitchEstimate,
      productionCostOverride: configuration.productionCostOverride
    });

    if (retailPrice <= 0) return NextResponse.json({ error: "Set a retail price above $0." }, { status: 400 });

    const record = {
      organization_id: membership.organization_id,
      shop_id: shop.id,
      brand_garment_id: context.garmentRow.id,
      brand_design_id: context.designRow.id,
      name,
      slug: safeBrandSlug(String(body.slug || name)),
      description: String(body.description || "").trim() || null,
      active: body.active === true,
      featured: body.featured === true,
      pricing_mode: pricingMode,
      retail_price: retailPrice,
      compare_at_price: Number(body.compareAtPrice || 0) > retailPrice ? Number(body.compareAtPrice) : null,
      target_margin_percent: pricingMode === "target_margin" ? targetMargin : null,
      placement_key: String(body.placementKey),
      configuration,
      sort_order: Math.max(0, Math.floor(Number(body.sortOrder || 0)))
    };

    const id = typeof body.id === "string" && body.id ? body.id : null;
    const result = id
      ? await supabase.from("brand_products").update(record).eq("id", id).eq("shop_id", shop.id).select("*").single()
      : await supabase.from("brand_products").insert(record).select("*").single();

    if (result.error || !result.data) {
      return NextResponse.json({ error: result.error?.message || "Unable to save Brand product." }, { status: 400 });
    }

    await supabase.from("audit_logs").insert({
      organization_id: membership.organization_id,
      user_id: user.id,
      action: id ? "brand.product.updated" : "brand.product.created",
      entity_type: "brand_product",
      entity_id: result.data.id,
      metadata: {
        name,
        retailPrice,
        brandGarmentId: context.garmentRow.id,
        brandDesignId: context.designRow.id
      }
    });

    return NextResponse.json({ product: result.data });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Unable to save Brand product." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Product id is required." }, { status: 400 });

  const { error } = await supabase.from("brand_products").delete().eq("id", id).eq("shop_id", shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
