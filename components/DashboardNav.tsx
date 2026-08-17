"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminIcon, { type AdminIconName } from "@/components/AdminIcon";
import type { ShopAccountMode } from "@/lib/shop-mode";

type NavItem = { href: string; label: string; icon: AdminIconName };
type NavGroup = { label: string; items: NavItem[] };

const workspace: NavGroup = {
  label: "Workspace",
  items: [
    { href: "/dashboard", label: "Overview", icon: "home" },
    { href: "/dashboard/orders", label: "Orders", icon: "orders" }
  ]
};

const printGroups: NavGroup[] = [
  {
    label: "Custom Print",
    items: [
      { href: "/dashboard/products", label: "Products", icon: "products" },
      { href: "/dashboard/settings", label: "Print storefront", icon: "settings" }
    ]
  },
  {
    label: "Sourcing & pricing",
    items: [
      { href: "/dashboard/suppliers", label: "Suppliers", icon: "suppliers" },
      { href: "/dashboard/suppliers/cart", label: "Supplier cart", icon: "cart" },
      { href: "/dashboard/pricing", label: "Pricing", icon: "pricing" },
      { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" }
    ]
  }
];

const brandGroups: NavGroup[] = [
  {
    label: "Brand / Merch",
    items: [
      { href: "/dashboard/products", label: "Garments", icon: "products" },
      { href: "/dashboard/designs", label: "Designs", icon: "products" },
      { href: "/dashboard/collections", label: "Collections", icon: "cart" },
      { href: "/dashboard/brand-storefront", label: "Brand storefront", icon: "settings" }
    ]
  },
  {
    label: "Sourcing & pricing",
    items: [
      { href: "/dashboard/suppliers", label: "Suppliers", icon: "suppliers" },
      { href: "/dashboard/suppliers/cart", label: "Supplier cart", icon: "cart" },
      { href: "/dashboard/pricing", label: "Pricing", icon: "pricing" },
      { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" }
    ]
  }
];

const accountGroup: NavGroup = {
  label: "Account",
  items: [
    { href: "/dashboard/mode", label: "Store access", icon: "settings" },
    { href: "/dashboard/account", label: "Account & billing", icon: "account" }
  ]
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/dashboard/suppliers") return pathname === href || pathname.startsWith("/dashboard/suppliers/catalog");
  return pathname.startsWith(href);
}

export default function DashboardNav({
  accountMode = "custom",
  activeWorkspace = "print"
}: {
  accountMode?: ShopAccountMode;
  activeWorkspace?: "print" | "brand";
}) {
  const pathname = usePathname();
  const brandOnly = accountMode === "brand";
  const hybrid = accountMode === "hybrid";
  const useBrand = brandOnly || (hybrid && activeWorkspace === "brand");
  const groups = [workspace, ...(useBrand ? brandGroups : printGroups), accountGroup];

  return (
    <nav className="admin-nav" aria-label="Dashboard navigation">
      {groups.map((group) => (
        <section className="admin-nav-group" key={group.label}>
          <p>{group.label}</p>
          <div>
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "admin-nav-link active" : "admin-nav-link"}>
                <AdminIcon name={item.icon}/><span>{item.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}
