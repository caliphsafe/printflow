import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { asNumber, field, safeImageUrl, ssRequest } from "@/lib/ss-activewear";

type Props = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const { data: connection } = await supabase.from("supplier_connections").select("encrypted_account_number,encrypted_api_key,settings").eq("shop_id", shop.id).eq("provider", "ss-activewear").single();
  if (!connection) return NextResponse.json({ error: "Connect S&S first." }, { status: 409 });
  try {
    const rows = await ssRequest<Record<string, unknown>[]>(connection, `/products/?styleid=${encodeURIComponent(id)}&mediatype=json`);
    const products = (Array.isArray(rows) ? rows : []).map((row) => ({
      sku: String(field(row, "sku") || ""), skuId: String(field(row, "skuID", "skuId") || ""), gtin: String(field(row, "gtin") || ""),
      styleId: String(field(row, "styleID", "styleId") || id), brandName: String(field(row, "brandName") || ""), styleName: String(field(row, "styleName") || ""), title: String(field(row, "title") || ""), partNumber: String(field(row, "partNumber") || ""),
      colorName: String(field(row, "colorName") || "Unspecified"), sizeName: String(field(row, "sizeName") || "One Size"), customerPrice: asNumber(field(row, "customerPrice")), quantity: asNumber(field(row, "qty", "quantity")),
      colorHex: String(field(row, "color1") || "#777777"), swatchImageUrl: safeImageUrl(field(row, "colorSwatchImage")), frontImageUrl: safeImageUrl(field(row, "colorFrontImage")), backImageUrl: safeImageUrl(field(row, "colorBackImage"))
    })).filter((row) => row.sku);
    return NextResponse.json({ products });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load style." }, { status: 502 }); }
}
