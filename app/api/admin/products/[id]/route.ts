import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { normalizeConfiguration, slugify } from "@/lib/catalog";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  const { id } = await params;
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });
  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Product name is required." }, { status: 400 });

  const { data, error } = await supabase
    .from("catalog_products")
    .update({
      name,
      slug: slugify(String(body.slug || name)),
      description: String(body.description || "").trim() || null,
      active: body.active !== false,
      configuration: normalizeConfiguration(body.configuration),
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("shop_id", shop.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ product: data });
}

export async function DELETE(_request: Request, { params }: Props) {
  const { id } = await params;
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "No shop configured." }, { status: 403 });

  const { count } = await supabase.from("catalog_products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
  if ((count || 0) <= 1) return NextResponse.json({ error: "Keep at least one product in the catalog." }, { status: 400 });

  const { error } = await supabase.from("catalog_products").delete().eq("id", id).eq("shop_id", shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
