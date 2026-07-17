import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { field, ssRequest } from "@/lib/ss-activewear";

export async function GET(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const { data: connection } = await supabase.from("supplier_connections").select("encrypted_account_number,encrypted_api_key,settings").eq("shop_id", shop.id).eq("provider", "ss-activewear").single();
  if (!connection) return NextResponse.json({ error: "Connect S&S first." }, { status: 409 });
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() || "";
  if (q.length < 2) return NextResponse.json({ styles: [] });
  try {
    const rows = await ssRequest<Record<string, unknown>[]>(connection, `/styles/?search=${encodeURIComponent(q)}&mediatype=json`);
    const styles = (Array.isArray(rows) ? rows : []).map((row) => ({
      styleId: String(field(row, "styleID", "styleId") || ""), brandName: String(field(row, "brandName") || ""), styleName: String(field(row, "styleName", "name") || ""),
      title: String(field(row, "title") || ""), description: String(field(row, "description") || ""), partNumber: String(field(row, "partNumber") || ""), imageUrl: String(field(row, "styleImage") || "")
    })).filter((style) => `${style.brandName} ${style.styleName} ${style.title} ${style.partNumber}`.toLowerCase().includes(q)).slice(0, 30);
    return NextResponse.json({ styles });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to search S&S." }, { status: 502 }); }
}
