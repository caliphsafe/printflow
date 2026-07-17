import PricingSettingsManager from "@/components/PricingSettingsManager";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const { data } = await supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle();
  return <>
    <header className="admin-header"><div><p className="eyebrow">GLOBAL PRICING</p><h1>Pricing rules & add-ons</h1><p>Set reusable order fees, design services, decoration multipliers, and future customer add-ons in one place.</p></div></header>
    <PricingSettingsManager initialPricing={normalizePricingProfile(data?.configuration || DEFAULT_PRICING_PROFILE)} />
  </>;
}
