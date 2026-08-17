import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-data";
import { platformShopAccess, shopAccountMode } from "@/lib/shop-mode";

export const dynamic = "force-dynamic";

export default async function DashboardEntryPage() {
  const { shop } = await getAdminContext();
  if (!shop) return null;

  const mode = shopAccountMode(shop.settings);
  const access = platformShopAccess(shop.settings);

  if (mode === "brand" || (!access.customPrint && access.brandMerch)) {
    redirect("/dashboard/brand");
  }

  if (mode === "custom" || (access.customPrint && !access.brandMerch)) {
    redirect("/dashboard/print");
  }

  const jar = await cookies();
  const requested = jar.get("printflow_workspace")?.value;

  if (requested === "brand" && access.brandMerch) redirect("/dashboard/brand");
  redirect("/dashboard/print");
}
