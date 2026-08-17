import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import { compatibleOffer } from "@/lib/brand-builder";
import { normalizeBrandBusinessProfile, normalizeBrandRetailProfile } from "@/lib/brand-retail";
import { platformShopAccess } from "@/lib/shop-mode";
import type { BrandDesign, BrandStoreProduct, PublicBrandShop } from "@/lib/brand-types";
import type { CatalogProduct } from "@/lib/types";

export async function getPublicBrandShop(
  slug: string,
  presentation: "full" | "embed" | "preview",
  options: { preview?: boolean } = {}
): Promise<PublicBrandShop> {
  const admin = createSupabaseAdmin();
  const preview = options.preview === true || presentation === "preview";

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
    { count: paymentCount }
  ] = await Promise.all([
    admin.from("brand_business_profiles").select("id,name,settings").eq("shop_id", shop.id).maybeSingle(),
    admin.from("brand_retail_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    admin.from("brand_garments").select("id,source_catalog_product_id,active,configuration").eq("shop_id", shop.id),
    admin.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id),
    admin.from("brand_designs").select("*").eq("shop_id", shop.id).order("featured", { ascending: false }).order("sort_order"),
    admin.from("brand_design_variants").select("*").eq("shop_id", shop.id),
    admin.from("brand_design_product_rules").select("brand_design_id,catalog_product_id,configuration,active").eq("shop_id", shop.id),
    admin.from("brand_design_categories").select("*").eq("shop_id", shop.id).order("sort_order").order("name"),
    admin.from("integration_connections").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("category", "payment").eq("status", "connected")
  ]);

  const business = normalizeBrandBusinessProfile(businessRow, shop.name);
  const retailProfile = normalizeBrandRetailProfile(retailRow?.configuration);
  const publiclyActive = business.settings.active === true;

  const garmentRowsBySource = new Map((garmentRows || []).map((row: any) => [row.source_catalog_product_id, row]));
  const garments: BrandStoreProduct[] = (sourceRows || [])
    .map((row: any) => ({ ...row, configuration: normalizeConfiguration(row.configuration) } as CatalogProduct))
    .map((source) => {
      const row: any = garmentRowsBySource.get(source.id);
      if (!row) return null;
      if (!preview && row.active !== true) return null;
      const configured = applyBrandGarmentConfiguration(source, { ...(row.configuration || {}), active: preview ? true : row.active === true });
      if (!configured) return null;
      if (!preview && Number((configured.configuration as any).brandRetailPrice || 0) <= 0) return null;
      return { ...configured, brandGarmentId: row.id, active: row.active === true } as BrandStoreProduct;
    })
    .filter((item): item is BrandStoreProduct => Boolean(item));

  const visibleDesignRows = preview ? (designRows || []) : (designRows || []).filter((row: any) => row.active === true);
  const visibleVariants = (variants || []).filter((row: any) => row.active === true);
  const visibleRules = (rules || []).filter((row: any) => row.active !== false);

  const brandDesigns: BrandDesign[] = visibleDesignRows.map((design: any) => ({
    ...design,
    variants: visibleVariants.filter((variant: any) => variant.brand_design_id === design.id),
    productIds: visibleRules.filter((rule: any) => rule.brand_design_id === design.id).map((rule: any) => rule.catalog_product_id),
    productRules: visibleRules.filter((rule: any) => rule.brand_design_id === design.id).map((rule: any) => ({
      productId: rule.catalog_product_id,
      placements: rule.configuration?.placements || {}
    }))
  }));

  const storefrontGarments = preview
    ? garments
    : garments.filter((garment) =>
        brandDesigns.some((design) =>
          (["front-heart", "front-full", "back-full"] as const).some((placementKey) =>
            compatibleOffer(design, garment, placementKey)
          )
        )
      );

  if (!preview && !publiclyActive) {
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

  return {
    id: shop.id,
    organization_id: shop.organization_id,
    slug: shop.slug,
    name: shop.name,
    active: preview ? true : publiclyActive,
    business,
    retailProfile,
    garments: storefrontGarments,
    brandDesigns,
    merchProducts: [],
    categories: (categories || []).filter((item: any) => preview || item.active === true) as any,
    collections: [],
    paymentReady: Number(paymentCount || 0) > 0,
    presentation
  };
}
