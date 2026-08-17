import { redirect } from "next/navigation";
import BrandDesignManager from "@/components/BrandDesignManager";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import { isBrandMode, shopAccountMode } from "@/lib/shop-mode";
import type { BrandDesign } from "@/lib/brand-types";
import type { CatalogProduct } from "@/lib/types";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";

export const dynamic = "force-dynamic";

export default async function BrandDesignsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  if (!isBrandMode(shopAccountMode(shop.settings))) redirect("/dashboard/mode");

  const [
    { data: rows },
    { data: variants },
    { data: placements },
    { data: rules },
    { data: categories },
    { data: productRows },
    { data: brandGarmentRows }
  ] = await Promise.all([
    supabase.from("brand_designs").select("*").eq("shop_id", shop.id).order("sort_order").order("created_at"),
    supabase.from("brand_design_variants").select("*").eq("shop_id", shop.id),
    supabase.from("brand_design_placements").select("*").eq("shop_id", shop.id),
    supabase.from("brand_design_product_rules").select("brand_design_id,catalog_product_id,configuration").eq("shop_id", shop.id).eq("active", true),
    supabase.from("brand_design_categories").select("*").eq("shop_id", shop.id).order("sort_order").order("name"),
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id).order("created_at"),
    supabase.from("brand_garments").select("source_catalog_product_id,active,configuration").eq("shop_id", shop.id).eq("active", true)
  ]);

  const designs: BrandDesign[] = (rows || []).map((design: any) => ({
    ...design,
    variants: (variants || []).filter((variant: any) => variant.brand_design_id === design.id),
    placements: (placements || []).filter((placement: any) => placement.brand_design_id === design.id),
    productIds: (rules || []).filter((rule: any) => rule.brand_design_id === design.id).map((rule: any) => rule.catalog_product_id),
    productRules: (rules || [])
      .filter((rule: any) => rule.brand_design_id === design.id)
      .map((rule: any) => ({
        productId: rule.catalog_product_id,
        placements: rule.configuration?.placements || {}
      }))
  }));

  const setups = new Map(
    (brandGarmentRows || []).map((row: any) => [row.source_catalog_product_id, row.configuration])
  );

  const products: CatalogProduct[] = (productRows || [])
    .map((product: any) => ({ ...product, configuration: normalizeConfiguration(product.configuration) } as CatalogProduct))
    .map((product) => {
      const configuration = setups.get(product.id);
      return configuration ? applyBrandGarmentConfiguration(product, configuration) : null;
    })
    .filter((product): product is CatalogProduct => Boolean(product))
    .filter((product) => product.configuration.supplier?.sourceMode !== "demo");

  return (
    <>
      <BrandWorkflowRail active="create" />
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND STUDIO</p>
          <h1>Visual design builder</h1>
          <p>Upload the approved artwork, choose a Brand garment, and position the design directly on the real garment before customers can buy it.</p>
        </div>
      </header>
      <BrandDesignManager initialDesigns={designs} categories={(categories || []) as any} products={products} />
    </>
  );
}
