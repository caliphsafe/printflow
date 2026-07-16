import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/dashboard" className="admin-brand">PRINTFLOW</Link>
        <nav>
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/orders">Orders</Link>
          <Link href="/dashboard/products">Products</Link>
          <Link href="/dashboard/integrations">Integrations</Link>
          <Link href="/dashboard/settings">Shop setup</Link>
        </nav>
        <div className="sidebar-footer"><small>{user.email}</small><SignOutButton /></div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
