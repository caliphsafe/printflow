import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function getPlatformAdminContext() {
  const auth = await createSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) redirect("/login");
  const email = String(user.email || "").toLowerCase();
  const admin = createSupabaseAdmin();
  const { data: access } = await admin.from("platform_admins").select("email,active").eq("email", email).eq("active", true).maybeSingle();
  if (!access) redirect("/dashboard");
  return { user, admin };
}

export async function isPlatformAdmin(email?: string | null) {
  if (!email) return false;
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("platform_admins").select("email").eq("email", email.toLowerCase()).eq("active", true).maybeSingle();
  return Boolean(data);
}
