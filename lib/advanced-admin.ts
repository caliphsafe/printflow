import { redirect } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServer } from "@/lib/supabase-server";

export const ADVANCED_ORGANIZATION_ID = "decf4fd9-fbf7-48dc-a447-0234e73e991e";
export const ADVANCED_SHOP_ID = "1fb2131a-3e33-4986-a66b-de70ea6c7b6b";
export const ADVANCED_SHOP_SLUG = "advanced-embroidery-screen-printing";

async function resolveAdvancedContext() {
  const auth = await createSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;

  const db = createSupabaseAdmin();
  const { data: membership } = await db
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .eq("organization_id", ADVANCED_ORGANIZATION_ID)
    .maybeSingle();

  if (!membership) return { user, db, membership: null, shop: null, organization: null };

  const [{ data: shop }, { data: organization }] = await Promise.all([
    db.from("shops").select("*").eq("id", ADVANCED_SHOP_ID).eq("organization_id", ADVANCED_ORGANIZATION_ID).maybeSingle(),
    db.from("organizations").select("id,name,slug").eq("id", ADVANCED_ORGANIZATION_ID).maybeSingle()
  ]);

  return { user, db, membership, shop, organization };
}

export async function getAdvancedAdminContext() {
  const context = await resolveAdvancedContext();
  if (!context?.user) redirect("/advanced-admin/login");
  if (!context.membership || !context.shop) redirect("/advanced-admin/login?error=not-authorized");
  return context as NonNullable<typeof context> & {
    membership: NonNullable<NonNullable<typeof context>["membership"]>;
    shop: NonNullable<NonNullable<typeof context>["shop"]>;
    organization: NonNullable<NonNullable<typeof context>["organization"]>;
  };
}

export async function getAdvancedAdminApiContext() {
  const context = await resolveAdvancedContext();
  if (!context?.user || !context.membership || !context.shop) return null;
  return context;
}
