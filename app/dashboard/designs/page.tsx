import { redirect } from "next/navigation";
import BrandDesignManager from "@/components/BrandDesignManager";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { applyBrandGarmentConfiguration } from "@/lib/brand-commerce";
import { platformShopAccess } from "@/lib/shop-mode";
import type { BrandDesign } from "@/lib/brand-types";
import type { CatalogProduct } from "@/lib/types";

export const dynamic="force-dynamic";

export default async function DesignsPage(){
  const {supabase,shop}=await getAdminContext();
  if(!shop)return null;
  if(!platformShopAccess(shop.settings).brandMerch)redirect("/dashboard/mode");

  const [{data:designRows},{data:variants},{data:rules},{data:categories},{data:garmentRows},{data:sourceRows}]=await Promise.all([
    supabase.from("brand_designs").select("*").eq("shop_id",shop.id).order("sort_order").order("created_at"),
    supabase.from("brand_design_variants").select("*").eq("shop_id",shop.id),
    supabase.from("brand_design_product_rules").select("brand_design_id,catalog_product_id,configuration,active").eq("shop_id",shop.id),
    supabase.from("brand_design_categories").select("id,name").eq("shop_id",shop.id).eq("active",true).order("name"),
    supabase.from("brand_garments").select("id,source_catalog_product_id,active,configuration").eq("shop_id",shop.id).eq("active",true),
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id",shop.id)
  ]);

  const bySource=new Map((garmentRows||[]).map((r:any)=>[r.source_catalog_product_id,r]));
  const products:CatalogProduct[]=(sourceRows||[]).map((r:any)=>({...r,configuration:normalizeConfiguration(r.configuration)} as CatalogProduct)).map((source)=>{const row:any=bySource.get(source.id);if(!row)return null;return applyBrandGarmentConfiguration(source,row.configuration)}).filter((x):x is CatalogProduct=>Boolean(x));

  const designs:BrandDesign[]=(designRows||[]).map((d:any)=>({...d,variants:(variants||[]).filter((v:any)=>v.brand_design_id===d.id),productIds:(rules||[]).filter((r:any)=>r.brand_design_id===d.id&&r.active!==false).map((r:any)=>r.catalog_product_id),productRules:(rules||[]).filter((r:any)=>r.brand_design_id===d.id&&r.active!==false).map((r:any)=>({productId:r.catalog_product_id,placements:r.configuration?.placements||{}}))}));

  return <><BrandWorkflowRail active="designs"/><header className="admin-header"><div><p className="eyebrow">BRAND BUILDER · STEP 02</p><h1>Designs & pricing</h1><p>Upload the artwork customers can choose, set its add-on price, classify it as Front Heart, Front Full, or Back Full, and approve its placement on compatible garments.</p></div></header>{products.length?<BrandDesignManager initialDesigns={designs} categories={(categories||[]) as any} products={products}/>:<section className="admin-card"><h2>Add a Brand garment first</h2><p>Designs need a garment for visual placement approval.</p><a href="/dashboard/brand-garments">Garments & Pricing</a></section>}</>;
}
