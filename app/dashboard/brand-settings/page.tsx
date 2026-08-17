import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeBrandBusinessProfile } from "@/lib/brand-retail";
import { platformShopAccess } from "@/lib/shop-mode";
import BrandBusinessManager from "@/components/BrandBusinessManager";

export const dynamic = "force-dynamic";

export default async function BrandSettingsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return null;
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  const { data } = await supabase
    .from("brand_business_profiles")
    .select("id,name,settings")
    .eq("shop_id", shop.id)
    .maybeSingle();

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND BUSINESS</p>
          <h1>Brand settings</h1>
          <p>Manage the identity and storefront presentation of the retail brand. These settings are separate from the Print Shop.</p>
        </div>
      </header>
      <BrandBusinessManager initial={normalizeBrandBusinessProfile(data, shop.name)} shopSlug={shop.slug} />
    </>
  );
}
