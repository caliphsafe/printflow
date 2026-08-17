import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminContext } from "@/lib/admin-data";
import { platformShopAccess } from "@/lib/shop-mode";

export async function POST(request: Request) {
  const { shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const workspace = body.workspace === "brand" ? "brand" : body.workspace === "print" ? "print" : "";
  if (!workspace) return NextResponse.json({ error: "Choose a valid workspace." }, { status: 400 });

  const access = platformShopAccess(shop.settings);
  if (workspace === "brand" && !access.brandMerch) return NextResponse.json({ error: "Brand access is not enabled." }, { status: 403 });
  if (workspace === "print" && !access.customPrint) return NextResponse.json({ error: "Custom Print access is not enabled." }, { status: 403 });

  const jar = await cookies();
  jar.set("printflow_workspace", workspace, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  return NextResponse.json({ ok: true, workspace });
}
