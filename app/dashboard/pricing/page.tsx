import Link from "next/link";
import PricingSettingsManager from "@/components/PricingSettingsManager";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ returnTo?: string }> };

export default async function PricingPage({ searchParams }: Props) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/dashboard/products") ? query.returnTo : "/dashboard/products";
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const { data } = await supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle();
  return <>
    <header className="admin-header"><div><p className="eyebrow">PRODUCTION PRICING</p><h1>One engine for every product</h1><p>Start with live supplier cost, protect garment margin, and price screen printing, DTF, and embroidery using real production variables.</p></div><div className="admin-header-actions"><Link className="ghost-button" href={returnTo}>← Back to product</Link></div></header>
    <PricingSettingsManager initialPricing={normalizePricingProfile(data?.configuration || DEFAULT_PRICING_PROFILE)} returnTo={returnTo} />
  </>;
}
