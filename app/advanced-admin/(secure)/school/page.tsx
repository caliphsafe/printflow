import AdvancedAdminSchoolProduct from "@/components/AdvancedAdminSchoolProduct";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

export const dynamic = "force-dynamic";

export default async function SchoolUniformsAdmin() {
  const { db, shop } = await getAdvancedAdminContext();
  const { data: store } = await db.from("storefronts").select("*").eq("shop_id", shop.id).eq("slug", "espirito-santo").maybeSingle();
  let products: any[] = [];
  if (store) {
    const { data } = await db.from("storefront_products").select("*,catalog_products(id,name,slug,configuration)").eq("storefront_id", store.id).order("sort_order");
    products = data || [];
  }

  return <>
    <header className="ae-page-head">
      <div className="copy"><p className="ae-kicker">SCHOOL UNIFORMS</p><h1>Espirito Santo, without editing the website.</h1><p>Change prices, names and visibility here. The parent-facing uniform form reads these values from PrintFlow.</p></div>
      <div className="ae-page-actions"><a className="ae-button" href="https://adv-emb-sp.vercel.app/espirito-santo/" target="_blank" rel="noreferrer">View parent form ↗</a></div>
    </header>

    {!store ? <section className="ae-card ae-empty"><span>!</span><h3>Storefront seed not installed</h3><p>Run the included Espirito Santo seed SQL in Supabase once, then this page will manage the uniform products.</p></section>
    : products.length ? <section className="ae-product-grid">{products.map((item:any)=><AdvancedAdminSchoolProduct key={item.id} item={item}/>)}</section>
    : <section className="ae-card ae-empty"><span>00</span><h3>No school products yet</h3><p>The storefront exists but has no products.</p></section>}
  </>;
}
