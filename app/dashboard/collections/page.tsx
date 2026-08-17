import { redirect } from "next/navigation";
import BrandCollectionsManager from "@/components/BrandCollectionsManager";
import { getAdminContext } from "@/lib/admin-data";
import { platformShopAccess } from "@/lib/shop-mode";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const [{ data: collections }, { data: links }, { data: products }] = await Promise.all([
    supabase.from("brand_collections").select("id,name,slug,description,active,featured,sort_order").eq("shop_id", shop.id).order("featured", { ascending: false }).order("sort_order").order("created_at"),
    supabase.from("brand_collection_merch_products").select("collection_id,brand_product_id,sort_order").order("sort_order"),
    supabase.from("brand_products").select("id,name,retail_price,active").eq("shop_id", shop.id).order("name")
  ]);

  const rows = (collections || []).map((item: any) => ({
    ...item,
    merchProductIds: (links || []).filter((link: any) => link.collection_id === item.id).map((link: any) => link.brand_product_id)
  }));

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND MERCHANDISING</p>
          <h1>Collections</h1>
          <p>Group finished Brand Products into drops, seasons, campaigns, and permanent collections.</p>
        </div>
      </header>
      <BrandCollectionsManager initial={rows as any} products={(products || []) as any} />
    </>
  );
}
