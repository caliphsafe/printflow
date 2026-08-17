import { redirect } from "next/navigation";
import BrandGarmentManager from "@/components/BrandGarmentManager";
import BrandGarmentSourcePicker from "@/components/BrandGarmentSourcePicker";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { platformShopAccess } from "@/lib/shop-mode";
import type { CatalogProduct } from "@/lib/types";
import type { BrandGarmentSetup } from "@/lib/brand-commerce";

export const dynamic="force-dynamic";

export default async function BrandGarmentsPage(){
  const {supabase,shop}=await getAdminContext();
  if(!shop)return null;
  if(!platformShopAccess(shop.settings).brandMerch)redirect("/dashboard/mode");

  const [{data:productRows},{data:brandRows}]=await Promise.all([
    supabase.from("catalog_products").select("id,slug,name,description,active,configuration").eq("shop_id",shop.id).order("created_at"),
    supabase.from("brand_garments").select("id,source_catalog_product_id,active,configuration").eq("shop_id",shop.id).order("created_at")
  ]);
  const sourceProducts:CatalogProduct[]=(productRows||[]).map((r:any)=>({...r,configuration:normalizeConfiguration(r.configuration)})).filter((item)=>item.configuration.supplier?.sourceMode!=="demo");
  const ids=new Set((brandRows||[]).map((r:any)=>r.source_catalog_product_id));
  const brandProducts=sourceProducts.filter(x=>ids.has(x.id));
  const available=sourceProducts.filter(x=>!ids.has(x.id));
  const initialGarments=Object.fromEntries((brandRows||[]).map((r:any)=>[r.source_catalog_product_id,{...(r.configuration||{}),active:r.active===true} as BrandGarmentSetup]));

  return <><BrandWorkflowRail active="garments"/><header className="admin-header"><div><p className="eyebrow">BRAND BUILDER · STEP 01</p><h1>Garments & pricing</h1><p>Choose the blanks customers can start with, set the base garment selling price, choose colors/sizes, and define Brand-only print areas.</p></div><BrandGarmentSourcePicker products={available}/></header>
  {brandProducts.length?<BrandGarmentManager products={brandProducts} initialGarments={initialGarments}/>:<section className="admin-card brand-first-garment"><span>01</span><h2>Add your first garment</h2><p>Customers always begin by choosing a garment. Source one from the connected catalog, then set its Brand price and options.</p><BrandGarmentSourcePicker products={available}/><style>{`.brand-first-garment{display:grid;justify-items:center;max-width:700px;margin:40px auto;padding:38px;text-align:center}.brand-first-garment>span{display:grid;place-items:center;width:38px;height:38px;border-radius:99px;background:#1f2947;color:#fff;font-size:8px}.brand-first-garment h2{margin:12px 0 4px}.brand-first-garment p{max-width:530px;margin:0 0 16px;color:#777}`}</style></section>}</>;
}
