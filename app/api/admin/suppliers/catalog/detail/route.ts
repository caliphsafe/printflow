import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { sanmarNormalizedStyle } from "@/lib/sanmar";
import { asNumber, field, safeImageUrl, ssRequest } from "@/lib/ss-activewear";

function supplierFrom(value: string) {
  if (value === "ss" || value === "ss-activewear") return "ss" as const;
  if (value === "sanmar") return "sanmar" as const;
  return null;
}

function warehouseQuantity(value: unknown) {
  if (!Array.isArray(value)) return 0;

  return value.reduce((sum, row) => {
    if (!row || typeof row !== "object") return sum;
    return sum + asNumber(field(row as Record<string, unknown>, "qty", "quantity"));
  }, 0);
}

export async function GET(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const url = new URL(request.url);
  const supplier = supplierFrom(url.searchParams.get("supplier") || "");
  const styleId = (url.searchParams.get("style") || "").trim();

  if (!supplier || !styleId) {
    return NextResponse.json({ error: "Supplier and style are required." }, { status: 400 });
  }

  const provider = supplier === "ss" ? "ss-activewear" : "sanmar";

  const { data: connection } = await supabase
    .from("supplier_connections")
    .select("encrypted_account_number,encrypted_api_key,settings,status")
    .eq("shop_id", shop.id)
    .eq("provider", provider)
    .maybeSingle();

  if (!connection || connection.status !== "connected") {
    return NextResponse.json(
      { error: `Connect ${supplier === "ss" ? "S&S Activewear" : "SanMar"} first.` },
      { status: 409 }
    );
  }

  try {
    if (supplier === "ss") {
      const rows = await ssRequest<Record<string, unknown>[]>(
        connection,
        `/products/?styleid=${encodeURIComponent(styleId)}&mediatype=json`
      );

      const products = (Array.isArray(rows) ? rows : [])
        .map((row) => {
          const warehouseTotal = warehouseQuantity(field(row, "warehouses"));
          const combinedQuantity = asNumber(field(row, "qty", "quantity"));

          return {
            sku: String(field(row, "sku") || ""),
            skuId: String(field(row, "skuID", "skuID_Master", "skuId") || ""),
            gtin: String(field(row, "gtin") || ""),
            styleId: String(field(row, "styleID", "styleId") || styleId),
            brandName: String(field(row, "brandName") || ""),
            styleName: String(field(row, "styleName") || ""),
            colorName: String(field(row, "colorName") || "Unspecified"),
            sizeName: String(field(row, "sizeName") || "One Size"),
            customerPrice: asNumber(field(row, "customerPrice")),
            quantity: combinedQuantity || warehouseTotal,
            colorHex: String(field(row, "color1") || "#777777"),
            swatchImageUrl: safeImageUrl(field(row, "colorSwatchImage"), "large"),
            frontImageUrl: safeImageUrl(field(row, "colorFrontImage"), "large"),
            backImageUrl: safeImageUrl(field(row, "colorBackImage"), "large"),
            sideImageUrl: safeImageUrl(field(row, "colorSideImage"), "large"),
            supplier: "ss"
          };
        })
        .filter((row) => row.sku);

      return NextResponse.json({ products, supplier });
    }

    const style = await sanmarNormalizedStyle(connection as any, styleId);

    const products = style.variants.map((variant) => {
      const media = style.media[variant.colorName] || {};

      return {
        sku: variant.sku,
        skuId: variant.skuId,
        styleId: style.styleId,
        brandName: style.brandName,
        styleName: style.name || style.styleId,
        colorName: variant.colorName,
        sizeName: variant.sizeName,
        customerPrice: Number(variant.customerPrice || 0),
        quantity: Number(variant.quantity || 0),
        colorHex: "#777777",
        swatchImageUrl: media.swatchImageUrl || "",
        frontImageUrl: media.frontImageUrl || "",
        backImageUrl: media.backImageUrl || "",
        sideImageUrl: "",
        supplier: "sanmar"
      };
    });

    return NextResponse.json({
      products,
      supplier,
      style: {
        styleId: style.styleId,
        brandName: style.brandName,
        styleName: style.name || style.styleId,
        title: style.name || style.styleId,
        description: style.description,
        category: "Apparel"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : `Unable to load this ${supplier === "ss" ? "S&S Activewear" : "SanMar"} style.`
      },
      { status: 502 }
    );
  }
}
