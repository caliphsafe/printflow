import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";
import DashboardNav from "@/components/DashboardNav";
import DashboardHelp from "@/components/DashboardHelp";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import { getAdminContext } from "@/lib/admin-data";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { platformShopAccess, shopAccountMode } from "@/lib/shop-mode";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { organization, shop } = await getAdminContext();
  const platformAdmin = await isPlatformAdmin(user.email);
  if (!organization || !shop) redirect("/onboarding");

  const accountMode = shopAccountMode(shop.settings);
  const access = platformShopAccess(shop.settings);
  const jar = await cookies();
  const requested = jar.get("printflow_workspace")?.value;
  const activeWorkspace: "print" | "brand" =
    accountMode === "brand" ? "brand" :
    accountMode === "custom" ? "print" :
    requested === "brand" && access.brandMerch ? "brand" : "print";

  const previewHref = activeWorkspace === "brand" ? `/b/${shop.slug}` : "/preview/storefront";

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <Link href="/dashboard" className="admin-brand">
            <span>PF</span>
            <div><strong>PRINTFLOW</strong><small>{activeWorkspace === "brand" ? "Brand OS" : "Shop OS"}</small></div>
          </Link>

          <div className="shop-switcher">
            <span className="shop-avatar">{shop.name?.slice(0,1).toUpperCase() || "P"}</span>
            <div><strong>{shop.name}</strong><small>{organization.name}</small></div>
          </div>

          {accountMode === "hybrid" && <WorkspaceSwitcher current={activeWorkspace}/>}
          <DashboardNav accountMode={accountMode} activeWorkspace={activeWorkspace}/>
        </div>

        <div className="sidebar-footer">
          <a className="platform-admin-link" href={previewHref} target="_blank" rel="noreferrer">{activeWorkspace === "brand" ? "Brand preview" : "Print preview"}</a>
          <div className="account-chip">
            <span>{user.email?.slice(0,1).toUpperCase()}</span>
            <div><strong>{user.email?.split("@")[0]}</strong><small>{user.email}</small></div>
          </div>
          {platformAdmin && <Link className="platform-admin-link" href="/platform-admin">Platform admin</Link>}
          <SignOutButton />
        </div>
      </aside>

      <div className="admin-mobile-bar">
        <Link href="/dashboard" className="mobile-brand">PRINTFLOW</Link>
        <div className="admin-mobile-actions">
          <a href={previewHref} target="_blank" rel="noreferrer">Preview</a>
          <details className="admin-mobile-menu">
            <summary>Menu</summary>
            <div>
              {accountMode === "hybrid" && <WorkspaceSwitcher current={activeWorkspace}/>}
              <DashboardNav accountMode={accountMode} activeWorkspace={activeWorkspace}/>
              <div className="mobile-account-panel">
                <div className="account-chip">
                  <span>{user.email?.slice(0,1).toUpperCase()}</span>
                  <div><strong>{user.email?.split("@")[0]}</strong><small>{user.email}</small></div>
                </div>
                {platformAdmin && <Link className="platform-admin-link" href="/platform-admin">Platform admin</Link>}
                <SignOutButton />
              </div>
            </div>
          </details>
        </div>
      </div>

      <main className="admin-main">{children}</main>
      <DashboardHelp />

      <style>{`
        .workspace-switcher{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:12px 0 6px;padding:4px;border:1px solid #e1e1dc;border-radius:11px;background:#f5f5f1}
        .workspace-switcher button{min-width:0;padding:8px;border:0;border-radius:8px;background:transparent;color:#747474;text-align:left;cursor:pointer}
        .workspace-switcher button.active{background:#171717;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.12)}
        .workspace-switcher span{display:block;font-size:7px;font-weight:850;letter-spacing:.1em;opacity:.65}
        .workspace-switcher b{display:block;margin-top:2px;font-size:9px;white-space:nowrap}
      `}</style>
    </div>
  );
}
