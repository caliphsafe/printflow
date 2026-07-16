import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function getAdminContext() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return { supabase, user, membership: null, organization: null, shop: null };
  const organization = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
  const { data: shop } = await supabase.from("shops").select("*").eq("organization_id", membership.organization_id).limit(1).single();
  return { supabase, user, membership, organization, shop };
}
