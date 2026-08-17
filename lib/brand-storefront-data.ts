import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandContrast } from "@/lib/brand-designs";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import { normalizeShopSettings } from "@/lib/shop-settings";
import { platformShopAccess } from "@/lib/shop-mode";
import type { BrandDesign, PublicBrandShop } from "@/lib/brand-types";

export async function getPublicBrandShop(slug: string, presentation: "full" | "embed"): Promise<PublicBrandShop> {
  const admin = createSupabaseAdmin();

  const { data: shop } = await admin
    .from("shops")
    .select("id,organization_id,slug,name,settings,active")
    .eq("slug", slug)
    .maybeSingle();

  if (!shop) notFound();
  if (!platformShopAccess(shop.settings).brandMerch) notFound();

  const settings = normalizeShopSettings(shop.settings);

  if (!shop.active) {
    return {
      ...shop,
      settings,
      pricing: normalizePricingProfile(DEFAULT_PRICING_PROFILE),
      products: [],
      brandDesigns: [],
      categories: [],
      collections: [],
      paymentReady: false,
      presentation
    } as PublicBrandShop;
  }

  const [
    { data: productRows },
    { data: pricingRow },
    { count: paymentCount },
    { data: designRows },
    { data: variants },
    { data: placements },
    { data: rules },
    { data: categories },
    { data: collectionRows },
    { data: collectionDesigns },
    { data: collectionProducts }
  ] = await Promise.all([
    admin.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id).eq("active", true).order("created_at"),
    admin.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    admin.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected"),
    admin.from("brand_designs").select("*").eq("shop_id", shop.id).eq("active", true).order("featured", { ascending: false }).order("sort_order"),
    admin.from("brand_design_variants").select("*").eq("shop_id", shop.id).eq("active", true),
    admin.from("brand_design_placements").select("*").eq("shop_id", shop.id).eq("active", true),
    admin.from("brand_design_product_rules").select("*").eq("shop_id", shop.id).eq("active", true),
    admin.from("brand_design_categories").select("*").eq("shop_id", shop.id).eq("active", true).order("sort_order").order("name"),
    admin.from("brand_collections").select("id,name,slug,description,active,featured,sort_order").eq("shop_id", shop.id).eq("active", true).order("featured", { ascending: false }).order("sort_order"),
    admin.from("brand_collection_designs").select("collection_id,brand_design_id"),
    admin.from("brand_collection_products").select("collection_id,catalog_product_id")
  ]);

  const products = (productRows || [])
    .map((product: any) => applyBrandContrast({ ...product, configuration: normalizeConfiguration(product.configuration) } as any, shop.settings))
    .filter((product: any) => product.configuration.supplier?.sourceMode !== "demo");

  const brandDesigns: BrandDesign[] = (designRows || [])
    .map((design: any) => ({
      ...design,
      variants: (variants || []).filter((variant: any) => variant.brand_design_id === design.id),
      placements: (placements || []).filter((placement: any) => placement.brand_design_id === design.id),
      productIds: (rules || []).filter((rule: any) => rule.brand_design_id === design.id).map((rule: any) => rule.catalog_product_id)
    }))
    .filter((design) => design.variants.length && design.placements.length && design.productIds.length);

  const collections = (collectionRows || []).map((collection: any) => ({
    ...collection,
    designIds: (collectionDesigns || [])
      .filter((link: any) => link.collection_id === collection.id)
      .map((link: any) => link.brand_design_id),
    productIds: (collectionProducts || [])
      .filter((link: any) => link.collection_id === collection.id)
      .map((link: any) => link.catalog_product_id)
  }));

  return {
    ...shop,
    settings,
    pricing: normalizePricingProfile(pricingRow?.configuration || DEFAULT_PRICING_PROFILE),
    products,
    brandDesigns,
    categories: (categories || []) as any,
    collections: collections as any,
    paymentReady: Number(paymentCount || 0) > 0,
    presentation
  } as PublicBrandShop;
}
