import { redirect } from "next/navigation";
import SupplierCatalogBrowser from "@/components/SupplierCatalogBrowser";
import { getAdminContext } from "@/lib/admin-data";
import { platformShopAccess } from "@/lib/shop-mode";

export const dynamic = "force-dynamic";

export default async function BrandSourcingPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const { data: connection } = await supabase
    .from("supplier_connections")
    .select("status,account_hint,last_tested_at")
    .eq("shop_id", shop.id)
    .eq("provider", "ss-activewear")
    .maybeSingle();

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND SOURCING</p>
          <h1>Source Brand garments</h1>
          <p>Browse the supplier catalog specifically for the Brand business. Adding a garment here does not publish it to Print Shop Products.</p>
        </div>
        <a className="secondary-button" href="/dashboard/brand-garments">Brand Garments</a>
      </header>
      <SupplierCatalogBrowser connected={connection?.status === "connected"} accountHint={connection?.account_hint || null} targetBusiness="brand" />
    </>
  );
}
