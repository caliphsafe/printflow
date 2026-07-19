import SupplierCartManager from "@/components/SupplierCartManager";
import { getAdminContext } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function SupplierCartPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;

  const [{ data: drafts }, { data: ssConnection }] = await Promise.all([
    supabase.from("supplier_order_drafts").select("id,design_id,provider,status,items,estimated_total,created_at,updated_at").eq("shop_id", shop.id).in("status", ["cart", "ready", "submitted"]).order("updated_at", { ascending: false }),
    supabase.from("supplier_connections").select("provider,status,settings").eq("shop_id", shop.id).eq("provider", "ss-activewear").maybeSingle()
  ]);

  const designIds = Array.from(new Set((drafts || []).map((draft: any) => draft.design_id)));
  const [{ data: designs }, { data: orders }] = designIds.length ? await Promise.all([
    supabase.from("designs").select("id,display_id,customer_name,product_name,payment_status,status,created_at").in("id", designIds),
    supabase.from("supplier_orders").select("design_id,provider,external_order_numbers,status").in("design_id", designIds)
  ]) : [{ data: [] }, { data: [] }] as any;

  const designMap = new Map((designs || []).map((design: any) => [design.id, design]));
  const orderMap = new Map((orders || []).map((order: any) => [`${order.design_id}:${order.provider}`, order]));
  const jobs = (drafts || []).map((draft: any) => {
    const design: any = designMap.get(draft.design_id) || {};
    const supplierOrder: any = orderMap.get(`${draft.design_id}:${draft.provider}`);
    return {
      id: draft.id,
      designId: draft.design_id,
      provider: draft.provider,
      status: draft.status,
      estimatedTotal: Number(draft.estimated_total || 0),
      items: Array.isArray(draft.items) ? draft.items : [],
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
      <header className="admin-header supplier-cart-header">
        <div><p className="eyebrow">SUPPLIER CART</p><h1>Purchase the exact blanks.</h1><p>Jobs are grouped by their product supplier so each connected wholesale account receives only its own SKUs.</p></div>
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
