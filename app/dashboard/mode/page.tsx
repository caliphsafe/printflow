import { getAdminContext } from "@/lib/admin-data";
import StoreModeManager from "@/components/StoreModeManager";
import { platformShopAccess, shopAccountMode } from "@/lib/shop-mode";

export default async function BusinessAccessPage() {
  const { shop } = await getAdminContext();
  if (!shop) return null;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">ACCOUNT STRUCTURE</p>
          <h1>Business access</h1>
          <p>Platform Admin controls which PrintFlow businesses this account can operate.</p>
        </div>
      </header>
      <StoreModeManager accountMode={shopAccountMode(shop.settings)} platformAccess={platformShopAccess(shop.settings)} />
    </>
  );
}
