import PageBackLink from "@/components/PageBackLink";
import SupplierCartManager from "@/components/SupplierCartManager";
import { getAdminContext } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

function productImage(configuration: any, colorName?: string) {
  const colors = Array.isArray(configuration?.colors) ? configuration.colors : [];
  const color = colors.find((item: any) => item.name === colorName) || colors.find((item: any) => item.active !== false) || colors[0];
  return color?.frontImageUrl || configuration?.mockupImageUrl || "";
}

export default async function SupplierCartPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;

  const [{ data: drafts }, { data: ssConnection }] = await Promise.all([
    supabase.from("supplier_order_drafts").select("id,design_id,provider,status,items,estimated_total,created_at,updated_at").eq("shop_id", shop.id).in("status", ["cart", "ready", "submitted"]).order("updated_at", { ascending: false }),
    supabase.from("supplier_connections").select("provider,status,settings").eq("shop_id", shop.id).eq("provider", "ss-activewear").maybeSingle()
  ]);

  const designIds = Array.from(new Set((drafts || []).map((draft: any) => draft.design_id)));
  const [{ data: designs }, { data: orders }] = designIds.length ? await Promise.all([
    supabase.from("designs").select("id,display_id,customer_name,product_name,payment_status,status,created_at,catalog_product_id,shirt_color_name,design_sides").in("id", designIds),
    supabase.from("supplier_orders").select("design_id,provider,external_order_numbers,status").in("design_id", designIds)
  ]) : [{ data: [] }, { data: [] }] as any;

  const productIds = Array.from(new Set((designs || []).map((design: any) => design.catalog_product_id).filter(Boolean)));
  const { data: products } = productIds.length
    ? await supabase.from("catalog_products").select("id,configuration").in("id", productIds)
    : { data: [] as any[] };

  const designMap = new Map((designs || []).map((design: any) => [design.id, design]));
  const productMap = new Map((products || []).map((product: any) => [product.id, product]));
  const orderMap = new Map((orders || []).map((order: any) => [`${order.design_id}:${order.provider}`, order]));
  const jobs = (drafts || []).map((draft: any) => {
    const design: any = designMap.get(draft.design_id) || {};
    const supplierOrder: any = orderMap.get(`${draft.design_id}:${draft.provider}`);
    const items = Array.isArray(draft.items) ? draft.items : [];
    const firstItem = items[0] || {};
    const designImage = design.design_sides?.front?.garmentImageUrl || design.design_sides?.back?.garmentImageUrl || "";
    const product: any = productMap.get(design.catalog_product_id);
    const imageUrl = firstItem.imageUrl || designImage || productImage(product?.configuration, design.shirt_color_name);
    return {
      id: draft.id,
      designId: draft.design_id,
      provider: draft.provider,
      status: draft.status,
      estimatedTotal: Number(draft.estimated_total || 0),
      items,
      imageUrl,
      displayId: design.display_id || "Order",
      customerName: design.customer_name || "Customer",
      productName: design.product_name || "Garment order",
      paymentStatus: design.payment_status || (design.status === "paid" ? "paid" : "pending"),
      createdAt: design.created_at || draft.created_at,
      ordered: Boolean(supplierOrder) || draft.status === "submitted",
      orderNumbers: supplierOrder?.external_order_numbers || []
    };
  });

  return (
    <>
      <PageBackLink href="/dashboard/suppliers" label="Back to suppliers" />
      <header className="admin-header supplier-cart-header">
        <div><p className="eyebrow">SUPPLIER CART</p><h1>Purchase the exact blanks.</h1><p>Jobs are grouped by supplier so every wholesale account receives only the products and SKUs assigned to it.</p></div>
      </header>
      <SupplierCartManager
        initialJobs={jobs}
        providerStates={{
          "ss-activewear": { connected: ssConnection?.status === "connected", testMode: ssConnection?.settings?.testMode !== false }
        }}
      />
    </>
  );
}
