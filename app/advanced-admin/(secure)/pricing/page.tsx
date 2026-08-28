import AdvancedAdminPricingManager from "@/components/AdvancedAdminPricingManager";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";

export const dynamic = "force-dynamic";

export default async function AdvancedPricing() {
  const { db, shop } = await getAdvancedAdminContext();
  const { data } = await db.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle();
  const pricing = normalizePricingProfile(data?.configuration || DEFAULT_PRICING_PROFILE);

  return <>
    <header className="ae-page-head">
      <div className="copy"><p className="ae-kicker">PRICING</p><h1>Change the numbers, not the system.</h1><p>Advanced controls its production pricing here. PrintFlow still calculates supplier cost, size runs, quantity discounts and checkout totals behind the scenes.</p></div>
    </header>
    <AdvancedAdminPricingManager initialPricing={pricing} />
  </>;
}
