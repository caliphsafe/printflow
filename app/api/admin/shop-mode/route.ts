import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { platformShopAccess, shopAccountMode } from "@/lib/shop-mode";

export async function GET() {
  const { shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  return NextResponse.json({
    accountMode: shopAccountMode(shop.settings),
    platformAccess: platformShopAccess(shop.settings)
  });
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: "Business access is controlled by Platform Admin. Print and Brand storefront settings are now managed inside their own workspaces."
    },
    { status: 410 }
  );
}
