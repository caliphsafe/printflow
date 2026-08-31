import { redirect } from "next/navigation";
import SupplierCatalogBrowser from "@/components/SupplierCatalogBrowser";
import { getAdminContext } from "@/lib/admin-data";
import { platformShopAccess } from "@/lib/shop-mode";

export const dynamic = "force-dynamic";

export default async function BrandSourcingPage() {
  const { supabase, shop } = await getAdminContext();

  if (!shop) return null;

  if (!platformShopAccess(shop.settings).brandMerch) {
    redirect("/dashboard/mode");
  }

  const { data: connections } = await supabase
    .from("supplier_connections")
    .select("provider,status,account_hint,last_tested_at")
    .eq("shop_id", shop.id)
    .in("provider", ["ss-activewear", "sanmar"]);

  const byProvider = new Map(
    (connections || []).map((connection) => [connection.provider, connection])
  );

  const suppliers = {
    ss: {
      connected: byProvider.get("ss-activewear")?.status === "connected",
      accountHint: byProvider.get("ss-activewear")?.account_hint || null,
      lastTestedAt: byProvider.get("ss-activewear")?.last_tested_at || null
    },
    sanmar: {
      connected: byProvider.get("sanmar")?.status === "connected",
      accountHint: byProvider.get("sanmar")?.account_hint || null,
      lastTestedAt: byProvider.get("sanmar")?.last_tested_at || null
    }
  };

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND SOURCING</p>
          <h1>Source Brand garments</h1>
          <p>
            Browse connected supplier catalogs specifically for the Brand
            business. Adding a garment here does not publish it to Print Shop
            Products.
          </p>
        </div>

        <a className="secondary-button" href="/dashboard/brand-garments">
          Brand Garments
        </a>
      </header>

      <SupplierCatalogBrowser
        suppliers={suppliers}
        targetBusiness="brand"
      />
    </>
  );
}
