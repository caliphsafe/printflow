"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const nav = [
  { href: "/advanced-admin", label: "Dashboard", icon: "▦" },
  { href: "/advanced-admin/orders", label: "Orders", icon: "▤" },
  { href: "/advanced-admin/products", label: "Products", icon: "▣" },
  { href: "/advanced-admin/pricing", label: "Pricing", icon: "$" },
  { href: "/advanced-admin/customers", label: "Customers", icon: "◎" },
  { href: "/advanced-admin/school", label: "School Uniforms", icon: "S" },
  { href: "/advanced-admin/settings", label: "Settings", icon: "⚙" }
];

export default function AdvancedAdminShell({
  children,
  userEmail
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function active(href: string) {
    return href === "/advanced-admin"
      ? pathname === href
      : pathname.startsWith(href);
  }

  async function signOut() {
    await createSupabaseBrowser().auth.signOut();
    router.replace("/advanced-admin/login");
    router.refresh();
  }

  return (
    <div className="ae-admin-shell">
      <aside className="ae-sidebar">
        <div>
          <Link href="/advanced-admin" className="ae-sidebar-brand">
            <span className="ae-mark">AE</span>
            <span><b>ADVANCED</b><small>ADMIN</small></span>
          </Link>
          <div className="ae-shop-chip">
            <span>01</span>
            <div><small>PRINT SHOP</small><strong>Advanced Embroidery</strong><em>New Bedford, MA</em></div>
          </div>
          <nav className="ae-nav">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={active(item.href) ? "active" : ""}>
                <span>{item.icon}</span><b>{item.label}</b>
              </Link>
            ))}
          </nav>
        </div>

        <div className="ae-sidebar-bottom">
          <a href="https://adv-emb-sp.vercel.app/order/" target="_blank" rel="noreferrer">View customer ordering ↗</a>
          <div className="ae-user-chip">
            <span>{(userEmail || "A").slice(0, 1).toUpperCase()}</span>
            <div><b>{userEmail?.split("@")[0] || "Staff"}</b><small>{userEmail}</small></div>
          </div>
          <button onClick={signOut} className="ae-signout">Sign out</button>
        </div>
      </aside>

      <header className="ae-mobile-header">
        <Link href="/advanced-admin"><span className="ae-mark">AE</span><b>ADVANCED ADMIN</b></Link>
        <details>
          <summary>Menu</summary>
          <div className="ae-mobile-menu">
            {nav.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
            <button onClick={signOut}>Sign out</button>
          </div>
        </details>
      </header>

      <main className="ae-admin-main">{children}</main>
    </div>
  );
}
