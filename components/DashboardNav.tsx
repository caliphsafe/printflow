"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminIcon, { type AdminIconName } from "@/components/AdminIcon";

const groups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: "home" as AdminIconName },
      { href: "/dashboard/orders", label: "Orders", icon: "orders" as AdminIconName }
    ]
  },
  {
    label: "Catalog & sourcing",
    items: [
      { href: "/dashboard/products", label: "Products", icon: "products" as AdminIconName },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: "suppliers" as AdminIconName },
      { href: "/dashboard/suppliers/cart", label: "Supplier cart", icon: "cart" as AdminIconName }
    ]
  },
  {
    label: "Business tools",
    items: [
      { href: "/dashboard/pricing", label: "Pricing", icon: "pricing" as AdminIconName },
      { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" as AdminIconName },
      { href: "/dashboard/settings", label: "Shop setup", icon: "settings" as AdminIconName }
    ]
  },
  {
    label: "Account",
    items: [{ href: "/dashboard/account", label: "Account & billing", icon: "account" as AdminIconName }]
  }
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  if (href === "/dashboard/suppliers") return pathname === href || pathname.startsWith("/dashboard/suppliers/catalog");
  return pathname.startsWith(href);
}

export default function DashboardNav() {
  const pathname = usePathname();
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
