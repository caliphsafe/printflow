import { notFound } from "next/navigation";
import DesignerApp from "@/components/DesignerApp";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { PublicShop } from "@/lib/types";

type Props = {
  params: Promise<{ shop: string }>;
};

export default async function ShopDesignerPage({ params }: Props) {
  const { shop: slug } = await params;
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("shops")
    .select("id, slug, name, settings")
    .eq("slug", slug)
    .eq("active", true)
    .single();

  if (error || !data) {
    notFound();
  }

  const shop = data as PublicShop;

  return <DesignerApp shop={shop} />;
}
