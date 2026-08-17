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

const printerGroups: NavGroup[] = [
  {
    label: "Catalog & sourcing",
    items: [
      { href: "/dashboard/products", label: "Products", icon: "products" },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: "suppliers" },
      { href: "/dashboard/suppliers/cart", label: "Supplier cart", icon: "cart" }
    ]
  },
  {
    label: "Business tools",
    items: [
      { href: "/dashboard/pricing", label: "Pricing", icon: "pricing" },
      { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" },
      { href: "/dashboard/settings", label: "Shop setup", icon: "settings" }
    ]
  }
];

const brandGroups: NavGroup[] = [
  {
    label: "Merch",
    items: [
      { href: "/dashboard/products", label: "Garments", icon: "products" },
      { href: "/dashboard/designs", label: "Designs", icon: "products" },
      { href: "/dashboard/collections", label: "Collections", icon: "cart" },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: "suppliers" },
      { href: "/dashboard/suppliers/cart", label: "Supplier cart", icon: "cart" }
    ]
  },
  {
    label: "Commerce",
    items: [
      { href: "/dashboard/pricing", label: "Pricing", icon: "pricing" },
      { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" },
      { href: "/dashboard/settings", label: "Storefront", icon: "settings" }
    ]
  }
];

const accountGroup: NavGroup = {
  label: "Account",
  items: [
    { href: "/dashboard/mode", label: "Store mode", icon: "settings" },
    { href: "/dashboard/account", label: "Account & billing", icon: "account" }
  ]
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/dashboard/suppliers") return pathname === href || pathname.startsWith("/dashboard/suppliers/catalog");
  return pathname.startsWith(href);
}

export default function DashboardNav({ accountMode = "custom" }: { accountMode?: ShopAccountMode }) {
  const pathname = usePathname();
  const middle = accountMode === "brand" || accountMode === "hybrid" ? brandGroups : printerGroups;
  const groups = [workspace, ...middle, accountGroup];

  return (
    <nav className="admin-nav" aria-label="Dashboard navigation">
      {groups.map((group) => (
        <section className="admin-nav-group" key={group.label}>
          <p>{group.label}</p>
          <div>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} className={active ? "admin-nav-link active" : "admin-nav-link"}>
                  <AdminIcon name={item.icon}/><span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
