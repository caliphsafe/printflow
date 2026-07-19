import Link from "next/link";
import PricingSettingsManager from "@/components/PricingSettingsManager";
import { getAdminContext } from "@/lib/admin-data";
import { DEFAULT_PRICING_PROFILE, normalizePricingProfile } from "@/lib/pricing-settings";
import { normalizeConfiguration } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ returnTo?: string }> };

export default async function PricingPage({ searchParams }: Props) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/dashboard/products") ? query.returnTo : "/dashboard/products";
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;

  const [{ data }, { data: products }] = await Promise.all([
    supabase.from("shop_pricing_profiles").select("configuration").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("catalog_products").select("name,configuration").eq("shop_id", shop.id).eq("active", true).limit(25)
  ]);

  let sampleBlankCost = 0;
  let sampleBlankLabel = "Add or import a product to preview garment cost";
  for (const row of products || []) {
    const configuration = normalizeConfiguration((row as any).configuration);
    const liveVariant = configuration.supplier?.variants.find((variant) => variant.active !== false && Number(variant.customerPrice) > 0);
    const cost = Number(liveVariant?.customerPrice || configuration.manualUnitCost || 0);
    if (cost > 0) {
      sampleBlankCost = cost;
      sampleBlankLabel = `${row.name} blank`;
      break;
    }
  }

  return <>
    <header className="admin-header"><div><p className="eyebrow">PRICING</p><h1>Production pricing</h1><p>Set garment margin, method rates, setup costs, and quantity discounts for every customer quote.</p></div><div className="admin-header-actions"><Link className="ghost-button" href={returnTo}>← Products</Link></div></header>
    <PricingSettingsManager
      initialPricing={normalizePricingProfile(data?.configuration || DEFAULT_PRICING_PROFILE)}
      sampleBlankCost={sampleBlankCost}
      sampleBlankLabel={sampleBlankLabel}
    />
  </>;
}
