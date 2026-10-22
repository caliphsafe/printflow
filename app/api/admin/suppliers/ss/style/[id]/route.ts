import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { loadSSStyle } from "@/lib/ss-catalog";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const { data: connection } = await supabase
    .from("supplier_connections")
    .select("encrypted_account_number,encrypted_api_key,settings,status")
    .eq("shop_id", shop.id)
    .eq("provider", "ss-activewear")
    .maybeSingle();
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "Connect S&S Activewear before loading product details." }, { status: 409 });
  }
  try {
    return NextResponse.json(await loadSSStyle(connection, id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load this S&S style." }, { status: 502 });
  }
}
