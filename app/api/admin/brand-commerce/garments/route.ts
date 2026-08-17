import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration } from "@/lib/catalog";
import { normalizeBrandGarmentSetup } from "@/lib/brand-commerce";
import type { CatalogProduct } from "@/lib/types";

export async function POST(request: Request) {
  const { supabase, membership, shop, user } = await getAdminContext();
  if (!membership || !shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const body = await request.json();
  const productId = String(body.productId || "");
  if (!productId) return NextResponse.json({ error: "Choose a garment." }, { status: 400 });

  const { data: row } = await supabase
    .from("catalog_products")
    .select("id,slug,name,description,active,configuration")
    .eq("id", productId)
    .eq("shop_id", shop.id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Garment not found." }, { status: 404 });

  const product: CatalogProduct = {
    ...row,
    configuration: normalizeConfiguration(row.configuration)
  };

  const nextSetup = normalizeBrandGarmentSetup(body.configuration, product);

  const { data, error } = await supabase
    .from("brand_garments")
    .upsert({
      organization_id: membership.organization_id,
      shop_id: shop.id,
      source_catalog_product_id: productId,
      active: nextSetup.active,
      configuration: nextSetup
    }, { onConflict: "shop_id,source_catalog_product_id" })
    .select("id,source_catalog_product_id,active,configuration")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("audit_logs").insert({
    organization_id: membership.organization_id,
    user_id: user.id,
    action: "brand.garment.updated",
    entity_type: "brand_garment",
    entity_id: data.id,
    metadata: {
      sourceCatalogProductId: productId,
      active: nextSetup.active,
      colors: nextSetup.activeColorIds.length,
      sizes: nextSetup.sizes.length,
      printSizes: nextSetup.printSizes,
      frontEnabled: nextSetup.frontEnabled,
      backEnabled: nextSetup.backEnabled
    }
  });

  return NextResponse.json({ ok: true, brandGarmentId: data.id, configuration: nextSetup });
}
