import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { asNumber, field, safeImageUrl, ssRequest } from "@/lib/ss-activewear";

type Props = { params: Promise<{ id: string }> };

function warehouseQuantity(value: unknown) {
  if (!Array.isArray(value)) return 0;
  return value.reduce((sum, row) => {
    if (!row || typeof row !== "object") return sum;
    return sum + asNumber(field(row as Record<string, unknown>, "qty", "quantity"));
  }, 0);
}

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
    const rows = await ssRequest<Record<string, unknown>[]>(connection, `/products/?styleid=${encodeURIComponent(id)}&mediatype=json`);
    const products = (Array.isArray(rows) ? rows : []).map((row) => {
      const warehouseTotal = warehouseQuantity(field(row, "warehouses"));
      const combinedQuantity = asNumber(field(row, "qty", "quantity"));
      return {
        sku: String(field(row, "sku") || ""),
        skuId: String(field(row, "skuID", "skuID_Master", "skuId") || ""),
        gtin: String(field(row, "gtin") || ""),
        styleId: String(field(row, "styleID", "styleId") || id),
        brandName: String(field(row, "brandName") || ""),
        styleName: String(field(row, "styleName") || ""),
        colorName: String(field(row, "colorName") || "Unspecified"),
        sizeName: String(field(row, "sizeName") || "One Size"),
        sizeOrder: String(field(row, "sizeOrder") || ""),
        customerPrice: asNumber(field(row, "customerPrice")),
        quantity: combinedQuantity || warehouseTotal,
        colorHex: String(field(row, "color1") || "#777777"),
        swatchImageUrl: safeImageUrl(field(row, "colorSwatchImage"), "large"),
        frontImageUrl: safeImageUrl(field(row, "colorFrontImage"), "large"),
        backImageUrl: safeImageUrl(field(row, "colorBackImage"), "large"),
        sideImageUrl: safeImageUrl(field(row, "colorSideImage"), "large"),
        warehouses: Array.isArray(field(row, "warehouses")) ? field(row, "warehouses") : []
      };
    }).filter((row) => row.sku);
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load this S&S style." }, { status: 502 });
  }
}
