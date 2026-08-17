import BrandStorefront from "@/components/BrandStorefront";
import { getPublicBrandShop } from "@/lib/brand-storefront-data";

export const dynamic = "force-dynamic";

export default async function BrandPage({ params }: { params: Promise<{ shop: string }> }) {
  const { shop } = await params;
  return <BrandStorefront shop={await getPublicBrandShop(shop, "full")} />;
}
