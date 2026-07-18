import { getAdminContext } from "@/lib/admin-data";
import ShopSettingsEditor from "@/components/ShopSettingsEditor";
import { normalizeShopSettings } from "@/lib/shop-settings";

export default async function SettingsPage() {
  const { shop, organization } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://YOUR-VERCEL-DOMAIN.com";
  return <ShopSettingsEditor
    initialShop={{ id: shop.id, name: shop.name, slug: shop.slug, active: shop.active, settings: normalizeShopSettings(shop.settings) }}
    organizationName={organization?.name || "PrintFlow organization"}
    appUrl={appUrl}
  />;
}
