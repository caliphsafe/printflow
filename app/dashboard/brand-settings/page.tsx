import { redirect } from "next/navigation";
import BrandBusinessManager from "@/components/BrandBusinessManager";
import BrandWorkflowRail from "@/components/BrandWorkflowRail";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeBrandBusinessProfile } from "@/lib/brand-retail";
import { platformShopAccess } from "@/lib/shop-mode";

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
      <BrandWorkflowRail active="store" />
      <header className="admin-header">
        <div>
          <p className="eyebrow">BRAND WEBSTORE</p>
          <h1>Store design & publishing</h1>
          <p>Control the Brand identity, storefront presentation, shopping message, theme colors, and public Draft / Live status.</p>
        </div>
        <a className="secondary-button" href="/preview/brand" target="_blank" rel="noreferrer">Preview Store ↗</a>
      </header>
      <BrandBusinessManager initial={normalizeBrandBusinessProfile(data, shop.name)} shopSlug={shop.slug} />
    </>
  );
}
