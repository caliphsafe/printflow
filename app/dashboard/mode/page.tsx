import { getAdminContext } from "@/lib/admin-data";
import StoreModeManager from "@/components/StoreModeManager";
import { brandStorefrontMode, shopAccountMode } from "@/lib/shop-mode";

export default async function StoreModePage() {
  const { shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;

  return (
    <StoreModeManager
      shopName={shop.name}
      initialAccountMode={shopAccountMode(shop.settings)}
      initialStorefrontMode={brandStorefrontMode(shop.settings)}
    />
  );
}
