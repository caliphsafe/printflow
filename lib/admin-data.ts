import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function getAdminContext() {
  const authSupabase = await createSupabaseServer();
  const {
    data: { user }
  } = await authSupabase.auth.getUser();

  if (!user) redirect("/login");

  // All lookups remain scoped to the authenticated user's membership. The admin
  // client is used because a shop stays inactive during onboarding and therefore
  // is intentionally hidden by the public storefront read policy.
  const supabase = createSupabaseAdmin();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return {
      supabase,
      user,
      membership: null,
      organization: null,
      shop: null
    };
  }

  const [{ data: organization }, { data: shop }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id,name,slug")
      .eq("id", membership.organization_id)
      .maybeSingle(),
    supabase
      .from("shops")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .limit(1)
      .maybeSingle()
  ]);

  return {
    supabase,
    user,
    membership,
    organization,
    shop
  };
}
