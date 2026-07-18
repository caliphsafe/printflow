import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";
import DashboardNav from "@/components/DashboardNav";
import DashboardHelp from "@/components/DashboardHelp";
import { getAdminContext } from "@/lib/admin-data";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { organization, shop } = await getAdminContext();
  if (!organization || !shop) redirect("/onboarding");

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <Link href="/dashboard" className="admin-brand"><span>PF</span><div><strong>PRINTFLOW</strong><small>Shop OS</small></div></Link>
          <div className="shop-switcher"><span className="shop-avatar">{shop?.name?.slice(0,1).toUpperCase() || "P"}</span><div><strong>{shop?.name || "PrintFlow shop"}</strong><small>{organization?.name || "Pilot workspace"}</small></div></div>
          <DashboardNav />
        </div>
        <div className="sidebar-footer">
          <div className="account-chip"><span>{user.email?.slice(0,1).toUpperCase()}</span><div><strong>{user.email?.split("@")[0]}</strong><small>{user.email}</small></div></div>
          <SignOutButton />
        </div>
      </aside>
      <div className="admin-mobile-bar"><Link href="/dashboard" className="mobile-brand">PRINTFLOW</Link><a href="/preview/storefront" target="_blank" rel="noreferrer">Preview storefront</a></div>
      <main className="admin-main">{children}</main>
      <DashboardHelp />
    </div>
  );
}
