import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import {
  maxSupplierCostForOptions,
  normalizeBrandBusinessProfile,
  normalizeBrandProductConfiguration,
  normalizeBrandRetailProfile,
  resolvedBrandRetailPrice
} from "@/lib/brand-retail";
import { platformShopAccess } from "@/lib/shop-mode";
import type { BrandCollection, BrandDesign, BrandStoreProduct, PublicBrandShop } from "@/lib/brand-types";
import type { BrandMerchProduct } from "@/lib/brand-retail";
import type { CatalogProduct } from "@/lib/types";

export async function getPublicBrandShop(slug: string, presentation: "full" | "embed"): Promise<PublicBrandShop> {
  const admin = createSupabaseAdmin();

  const { data: shop } = await admin
    .from("shops")
    .select("id,organization_id,slug,name,settings,active")
    .eq("slug", slug)
    .maybeSingle();

  if (!shop) notFound();
  if (!platformShopAccess(shop.settings).brandMerch) notFound();

  const [
    { data: businessRow },
    { data: retailRow },
    { data: garmentRows },
    { data: sourceRows },
    { data: designRows },
    { data: variants },
    { data: rules },
    { data: categories },
    { data: merchRows },
    { data: collectionRows },
    { data: collectionMerchLinks },
    { count: paymentCount }
  ] = await Promise.all([
    admin.from("brand_business_profiles").select("id,name,settings").eq("shop_id", shop.id).maybeSingle(),
    admin.from("brand_retail_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    admin.from("brand_garments").select("id,source_catalog_product_id,active,configuration").eq("shop_id", shop.id).eq("active", true),
    admin.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id),
    admin.from("brand_designs").select("*").eq("shop_id", shop.id).eq("active", true).order("featured", { ascending: false }).order("sort_order"),
    admin.from("brand_design_variants").select("*").eq("shop_id", shop.id).eq("active", true),
    admin.from("brand_design_product_rules").select("brand_design_id,catalog_product_id,configuration").eq("shop_id", shop.id).eq("active", true),
    admin.from("brand_design_categories").select("*").eq("shop_id", shop.id).eq("active", true).order("sort_order").order("name"),
    admin.from("brand_products").select("*").eq("shop_id", shop.id).eq("active", true).order("featured", { ascending: false }).order("sort_order").order("created_at"),
    admin.from("brand_collections").select("id,name,slug,description,active,featured,sort_order").eq("shop_id", shop.id).eq("active", true).order("featured", { ascending: false }).order("sort_order"),
    admin.from("brand_collection_merch_products").select("collection_id,brand_product_id,sort_order").order("sort_order"),
    admin.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected")
  ]);

  const business = normalizeBrandBusinessProfile(businessRow, shop.name);
  const retailProfile = normalizeBrandRetailProfile(retailRow?.configuration);

  if (!business.settings.active) {
    return {
      id: shop.id,
      organization_id: shop.organization_id,
      slug: shop.slug,
      name: shop.name,
      active: false,
      business,
      retailProfile,
      garments: [],
      brandDesigns: [],
      merchProducts: [],
      categories: [],
      collections: [],
      paymentReady: false,
      presentation
    };
  }

  const garmentRowsBySource = new Map((garmentRows || []).map((row: any) => [row.source_catalog_product_id, row]));
  const garments: BrandStoreProduct[] = (sourceRows || [])
    .map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) } as CatalogProduct))
    .map((source) => {
      const row: any = garmentRowsBySource.get(source.id);
      if (!row) return null;
      const configured = applyBrandGarmentConfiguration(source, row.configuration);
      return configured ? { ...configured, brandGarmentId: row.id } as BrandStoreProduct : null;
    })
    .filter((item): item is BrandStoreProduct => Boolean(item));

  const brandDesigns: BrandDesign[] = (designRows || []).map((design: any) => ({
    ...design,
    variants: (variants || []).filter((variant: any) => variant.brand_design_id === design.id),
    productIds: (rules || []).filter((rule: any) => rule.brand_design_id === design.id).map((rule: any) => rule.catalog_product_id),
    productRules: (rules || []).filter((rule: any) => rule.brand_design_id === design.id).map((rule: any) => ({
      productId: rule.catalog_product_id,
      placements: rule.configuration?.placements || {}
    }))
  }));

  const garmentById = new Map(garments.map((item) => [item.brandGarmentId, item]));
  const designById = new Map(brandDesigns.map((item) => [item.id, item]));

  const merchProducts: BrandMerchProduct[] = (merchRows || [])
    .map((row: any) => {
      const garment = garmentById.get(row.brand_garment_id);
      const design = designById.get(row.brand_design_id);
      if (!garment || !design) return null;

      const configuration = normalizeBrandProductConfiguration(row.configuration, garment);
      const rule = design.productRules.find((item) => item.productId === garment.id);
      const placement = rule?.placements?.[row.placement_key];
      if (!placement?.enabled) return null;

      const supplierCost = maxSupplierCostForOptions(garment, configuration.colorIds, configuration.sizes);
      const retailPrice = resolvedBrandRetailPrice({
        profile: retailProfile,
        pricingMode: row.pricing_mode === "target_margin" ? "target_margin" : "manual",
        manualRetailPrice: Number(row.retail_price || 0),
        targetMarginPercent: row.target_margin_percent ? Number(row.target_margin_percent) : retailProfile.defaultTargetMarginPercent,
        supplierCost,
        placement,
        inkColors: configuration.inkColors,
        stitchEstimate: configuration.stitchEstimate,
        productionCostOverride: configuration.productionCostOverride
      });

      return {
        ...row,
        retail_price: retailPrice,
        compare_at_price: row.compare_at_price ? Number(row.compare_at_price) : null,
        target_margin_percent: row.target_margin_percent ? Number(row.target_margin_percent) : null,
        configuration
      } as BrandMerchProduct;
    })
    .filter((item): item is BrandMerchProduct => Boolean(item));

  const liveMerchIds = new Set(merchProducts.map((item) => item.id));
  const collections: BrandCollection[] = (collectionRows || []).map((collection: any) => ({
    ...collection,
    merchProductIds: (collectionMerchLinks || [])
      .filter((link: any) => link.collection_id === collection.id && liveMerchIds.has(link.brand_product_id))
      .map((link: any) => link.brand_product_id)
  }));

  return {
    id: shop.id,
    organization_id: shop.organization_id,
    slug: shop.slug,
    name: shop.name,
    active: business.settings.active,
    business,
    retailProfile,
    garments,
    brandDesigns,
    merchProducts,
    categories: (categories || []) as any,
    collections,
    paymentReady: Number(paymentCount || 0) > 0,
    presentation
  };
}
