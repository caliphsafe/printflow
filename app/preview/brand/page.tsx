import { redirect } from "next/navigation";
import BrandStorefront from "@/components/BrandStorefront";
import { getAdminContext } from "@/lib/admin-data";
import { getPublicBrandShop } from "@/lib/brand-storefront-data";
import { platformShopAccess } from "@/lib/shop-mode";

export const dynamic = "force-dynamic";

export default async function BrandPreviewPage() {
  const { shop } = await getAdminContext();
  if (!shop) redirect("/onboarding");
  if (!platformShopAccess(shop.settings).brandMerch) redirect("/dashboard/mode");

  return <BrandStorefront shop={await getPublicBrandShop(shop.slug, "preview", { preview: true })} />;
}
