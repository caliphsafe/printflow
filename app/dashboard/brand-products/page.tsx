import { redirect } from "next/navigation";
import BrandProductsManager from "@/components/BrandProductsManager";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import { normalizeBrandProductConfiguration, normalizeBrandRetailProfile } from "@/lib/brand-retail";
import { platformShopAccess } from "@/lib/shop-mode";
import type { BrandDesign, BrandStoreProduct } from "@/lib/brand-types";
import type { BrandMerchProduct } from "@/lib/brand-retail";
import type { CatalogProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrandProductsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const [
    { data: brandProductRows },
    { data: garmentRows },
    { data: sourceRows },
    { data: designRows },
    { data: variants },
    { data: rules },
    { data: retailRow }
  ] = await Promise.all([
    supabase.from("brand_products").select("*").eq("shop_id", shop.id).order("featured", { ascending: false }).order("sort_order").order("created_at"),
    supabase.from("brand_garments").select("id,source_catalog_product_id,active,configuration").eq("shop_id", shop.id).eq("active", true),
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id),
    supabase.from("brand_designs").select("*").eq("shop_id", shop.id).order("sort_order").order("created_at"),
    supabase.from("brand_design_variants").select("*").eq("shop_id", shop.id).eq("active", true),
    supabase.from("brand_design_product_rules").select("brand_design_id,catalog_product_id,configuration").eq("shop_id", shop.id).eq("active", true),
    supabase.from("brand_retail_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle()
  ]);

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

  const designs: BrandDesign[] = (designRows || []).map((design: any) => ({
    ...design,
    variants: (variants || []).filter((variant: any) => variant.brand_design_id === design.id),
    productIds: (rules || []).filter((rule: any) => rule.brand_design_id === design.id).map((rule: any) => rule.catalog_product_id),
    productRules: (rules || []).filter((rule: any) => rule.brand_design_id === design.id).map((rule: any) => ({
      productId: rule.catalog_product_id,
      placements: rule.configuration?.placements || {}
    }))
  }));

  const sourceByGarmentId = new Map(garments.map((item) => [item.brandGarmentId, item]));
  const products: BrandMerchProduct[] = (brandProductRows || []).map((row: any) => ({
    ...row,
    retail_price: Number(row.retail_price || 0),
    compare_at_price: row.compare_at_price ? Number(row.compare_at_price) : null,
    target_margin_percent: row.target_margin_percent ? Number(row.target_margin_percent) : null,
    configuration: normalizeBrandProductConfiguration(row.configuration, sourceByGarmentId.get(row.brand_garment_id))
  }));

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND MERCHANDISE</p>
          <h1>Products</h1>
          <p>Create finished retail products from Brand garments and visually approved designs, then set the customer price and margin.</p>
        </div>
        <a className="secondary-button" href="/dashboard/brand-retail">Retail Economics</a>
      </header>

      <BrandProductsManager
        initialProducts={products}
        garments={garments}
        designs={designs}
        retailProfile={normalizeBrandRetailProfile(retailRow?.configuration)}
      />
    </>
  );
}
