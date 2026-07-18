import PricingSettingsManager from "@/components/PricingSettingsManager";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const { data } = await supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle();
  return <>
    <header className="admin-header"><div><p className="eyebrow">PRODUCTION PRICING</p><h1>One engine for every product</h1><p>Start with live supplier cost, protect garment margin, and price screen printing, DTF, and embroidery using real production variables.</p></div></header>
    <PricingSettingsManager initialPricing={normalizePricingProfile(data?.configuration || DEFAULT_PRICING_PROFILE)} />
  </>;
}
