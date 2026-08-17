import { redirect } from "next/navigation";
import BrandDesignManager from "@/components/BrandDesignManager";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandContrast } from "@/lib/brand-designs";
import { isBrandMode, shopAccountMode } from "@/lib/shop-mode";
import type { BrandDesign } from "@/lib/brand-types";
import type { CatalogProduct } from "@/lib/types";

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
    { data: productRows }
  ] = await Promise.all([
    supabase.from("brand_designs").select("*").eq("shop_id", shop.id).order("sort_order").order("created_at"),
    supabase.from("brand_design_variants").select("*").eq("shop_id", shop.id),
    supabase.from("brand_design_placements").select("*").eq("shop_id", shop.id),
    supabase.from("brand_design_product_rules").select("*").eq("shop_id", shop.id).eq("active", true),
    supabase.from("brand_design_categories").select("*").eq("shop_id", shop.id).order("sort_order").order("name"),
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id", shop.id).eq("active", true).order("created_at")
  ]);

  const designs: BrandDesign[] = (rows || []).map((design: any) => ({
    ...design,
    variants: (variants || []).filter((variant: any) => variant.brand_design_id === design.id),
    placements: (placements || []).filter((placement: any) => placement.brand_design_id === design.id),
    productIds: (rules || []).filter((rule: any) => rule.brand_design_id === design.id).map((rule: any) => rule.catalog_product_id)
  }));

  const products: CatalogProduct[] = (productRows || [])
    .map((product: any) => applyBrandContrast({ ...product, configuration: normalizeConfiguration(product.configuration) } as CatalogProduct, shop.settings))
    .filter((product) => product.configuration.supplier?.sourceMode !== "demo");

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND STUDIO</p>
          <h1>Design library</h1>
          <p>Upload predetermined artwork, control garment compatibility, and lock the production placement customers can purchase.</p>
        </div>
      </header>
      <BrandDesignManager initialDesigns={designs} categories={(categories || []) as any} products={products} />
    </>
  );
}
