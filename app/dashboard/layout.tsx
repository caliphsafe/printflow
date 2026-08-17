import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import SignOutButton from "@/components/SignOutButton";
import DashboardNav from "@/components/DashboardNav";
import DashboardHelp from "@/components/DashboardHelp";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import WorkspaceGuard from "@/components/WorkspaceGuard";
import { getAdminContext } from "@/lib/admin-data";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { normalizeBrandBusinessProfile } from "@/lib/brand-retail";
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

  const { data: brandBusinessRow } = activeWorkspace === "brand"
    ? await supabase.from("brand_business_profiles").select("id,name,settings").eq("shop_id", shop.id).maybeSingle()
    : { data: null };

  const brandBusiness = normalizeBrandBusinessProfile(brandBusinessRow, shop.name);
  const workspaceName = activeWorkspace === "brand" ? brandBusiness.name : shop.name;
  const workspaceLabel = activeWorkspace === "brand" ? "BRAND / MERCH" : "PRINT SHOP";
  const previewHref = activeWorkspace === "brand" ? `/b/${shop.slug}` : "/preview/storefront";
  const homeHref = activeWorkspace === "brand" ? "/dashboard/brand" : accountMode === "hybrid" ? "/dashboard/print" : "/dashboard";

  return (
    <div className={`admin-shell business-shell workspace-${activeWorkspace}`}>
      <WorkspaceGuard workspace={activeWorkspace} accountMode={accountMode} />

      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <Link href={homeHref} className="admin-brand">
            <span>PF</span>
            <div>
              <strong>PRINTFLOW</strong>
              <small>{workspaceLabel}</small>
            </div>
          </Link>

          <div className="business-identity">
            <span className="business-avatar">{workspaceName.slice(0, 1).toUpperCase()}</span>
            <div>
              <small>{activeWorkspace === "brand" ? "Retail business" : "Production business"}</small>
              <strong>{workspaceName}</strong>
              <span>{organization.name}</span>
            </div>
          </div>

          {accountMode === "hybrid" && <WorkspaceSwitcher current={activeWorkspace} />}
          <DashboardNav accountMode={accountMode} activeWorkspace={activeWorkspace} />
        </div>

        <div className="sidebar-footer">
          <a className="platform-admin-link" href={previewHref} target="_blank" rel="noreferrer">
            {activeWorkspace === "brand" ? "Open Brand store" : "Preview Print storefront"}
          </a>

          <div className="account-chip">
            <span>{user.email?.slice(0, 1).toUpperCase()}</span>
            <div><strong>{user.email?.split("@")[0]}</strong><small>{user.email}</small></div>
          </div>

          {platformAdmin && <Link className="platform-admin-link" href="/platform-admin">Platform admin</Link>}
          <SignOutButton />
        </div>
      </aside>

      <div className="admin-mobile-bar">
        <Link href={homeHref} className="mobile-brand">{activeWorkspace === "brand" ? "PRINTFLOW · BRAND" : "PRINTFLOW · SHOP"}</Link>
        <div className="admin-mobile-actions">
          <a href={previewHref} target="_blank" rel="noreferrer">Preview</a>
          <details className="admin-mobile-menu">
            <summary>Menu</summary>
            <div>
              <div className="mobile-business-title">
                <small>{workspaceLabel}</small>
                <strong>{workspaceName}</strong>
              </div>
              {accountMode === "hybrid" && <WorkspaceSwitcher current={activeWorkspace} />}
              <DashboardNav accountMode={accountMode} activeWorkspace={activeWorkspace} />
              <div className="mobile-account-panel">
                <div className="account-chip">
                  <span>{user.email?.slice(0, 1).toUpperCase()}</span>
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
        .business-identity{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;align-items:center;margin:12px 0;padding:10px;border:1px solid #e4e4df;border-radius:11px;background:#fafaf7}
        .business-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#171717;color:#fff;font-size:10px;font-weight:850}
        .business-identity small,.business-identity strong,.business-identity div>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .business-identity small{font-size:7px;text-transform:uppercase;letter-spacing:.08em;color:#888}.business-identity strong{margin:2px 0;font-size:10px}.business-identity div>span{font-size:7px;color:#888}
        .workspace-brand .business-avatar{background:#1f2947}.workspace-brand .admin-nav-link.active{background:#1f2947;color:#fff}.workspace-brand .admin-sidebar{border-right-color:#dfe3ef}
        .workspace-switcher-v2{display:grid;gap:5px;margin:8px 0 12px;padding:5px;border-radius:12px;background:#f0f0ec}
        .workspace-switcher-v2 button{display:grid;min-width:0;padding:8px 9px;border:1px solid transparent;border-radius:9px;background:transparent;color:#777;text-align:left}
        .workspace-switcher-v2 button span{font-size:6px;font-weight:850;letter-spacing:.1em}.workspace-switcher-v2 button b{margin:2px 0;font-size:9px}.workspace-switcher-v2 button small{font-size:6px;opacity:.7}
        .workspace-switcher-v2 button.active{background:#fff;color:#171717;border-color:#ddd;box-shadow:0 4px 12px rgba(0,0,0,.06)}
        .workspace-switcher-v2 button.active.brand{border-color:#cbd2e5;background:#f5f7fc}
        .mobile-business-title{display:grid;gap:2px;padding:10px 0}.mobile-business-title small{font-size:7px;color:#888}.mobile-business-title strong{font-size:11px}
      `}</style>
    </div>
  );
}
