import { redirect } from "next/navigation";
import BrandCollectionsManager from "@/components/BrandCollectionsManager";
import { getAdminContext } from "@/lib/admin-data";
import { isBrandMode, shopAccountMode } from "@/lib/shop-mode";

export default async function CollectionsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  if (!isBrandMode(shopAccountMode(shop.settings))) redirect("/dashboard/mode");

  const [
    { data: collections },
    { data: designLinks },
    { data: productLinks },
    { data: designs },
    { data: products }
  ] = await Promise.all([
    supabase.from("brand_collections").select("id,name,slug,description,active,featured,sort_order").eq("shop_id", shop.id).order("sort_order").order("created_at"),
    supabase.from("brand_collection_designs").select("collection_id,brand_design_id"),
    supabase.from("brand_collection_products").select("collection_id,catalog_product_id"),
    supabase.from("brand_designs").select("id,name").eq("shop_id", shop.id).order("name"),
    supabase.from("catalog_products").select("id,name").eq("shop_id", shop.id).eq("active", true).order("name")
  ]);

  const rows = (collections || []).map((item: any) => ({
    ...item,
    designIds: (designLinks || []).filter((link: any) => link.collection_id === item.id).map((link: any) => link.brand_design_id),
    productIds: (productLinks || []).filter((link: any) => link.collection_id === item.id).map((link: any) => link.catalog_product_id)
  }));

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND STUDIO</p>
          <h1>Collections</h1>
          <p>Build customer-facing drops from the same approved garments and designs already in PrintFlow.</p>
        </div>
      </header>
      <BrandCollectionsManager initial={rows as any} designs={(designs || []) as any} products={(products || []) as any} />
    </>
  );
}
