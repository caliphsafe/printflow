"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminIcon, { type AdminIconName } from "@/components/AdminIcon";
import type { ShopAccountMode } from "@/lib/shop-mode";

type NavItem = { href: string; label: string; icon: AdminIconName };
type NavGroup = { label: string; items: NavItem[] };

const printGroups: NavGroup[] = [
  {
    label: "Print Shop",
    items: [
      { href: "/dashboard/print", label: "Overview", icon: "home" },
      { href: "/dashboard/orders", label: "Orders", icon: "orders" }
    ]
  },
  {
    label: "Catalog",
    items: [
      { href: "/dashboard/products", label: "Products", icon: "products" },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: "suppliers" },
      { href: "/dashboard/suppliers/cart", label: "Supplier cart", icon: "cart" }
    ]
  },
  {
    label: "Production & commerce",
    items: [
      { href: "/dashboard/pricing", label: "Production pricing", icon: "pricing" },
      { href: "/dashboard/settings", label: "Order storefront", icon: "settings" },
      { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" }
    ]
  }
];

const brandGroups: NavGroup[] = [
  {
    label: "Brand Business",
    items: [
      { href: "/dashboard/brand", label: "Overview", icon: "home" },
      { href: "/dashboard/brand-orders", label: "Sales", icon: "orders" }
    ]
  },
  {
    label: "Merchandise",
    items: [
      { href: "/dashboard/brand-garments", label: "Garments", icon: "products" },
      { href: "/dashboard/designs", label: "Design Studio", icon: "products" },
      { href: "/dashboard/brand-products", label: "Products", icon: "products" },
      { href: "/dashboard/collections", label: "Collections", icon: "cart" }
    ]
  },
  {
    label: "Retail Commerce",
    items: [
      { href: "/dashboard/brand-retail", label: "Retail Economics", icon: "pricing" },
      { href: "/dashboard/brand-storefront", label: "Brand storefront", icon: "settings" }
    ]
  },
  {
    label: "Brand Operations",
    items: [
      { href: "/dashboard/brand-sourcing", label: "Source catalog", icon: "suppliers" },
      { href: "/dashboard/suppliers", label: "Supplier connections", icon: "suppliers" },
      { href: "/dashboard/integrations", label: "Payments & integrations", icon: "integrations" },
      { href: "/dashboard/brand-settings", label: "Brand settings", icon: "settings" }
    ]
  }
];

const accountGroup: NavGroup = {
  label: "PrintFlow Account",
  items: [
    { href: "/dashboard/mode", label: "Business access", icon: "settings" },
    { href: "/dashboard/account", label: "Account & billing", icon: "account" }
  ]
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard/print") return pathname === "/dashboard/print";
  if (href === "/dashboard/brand") return pathname === "/dashboard/brand";
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
  const useBrand = accountMode === "brand" || (accountMode === "hybrid" && activeWorkspace === "brand");
  const groups = [...(useBrand ? brandGroups : printGroups), accountGroup];

  return (
    <nav className="admin-nav" aria-label={useBrand ? "Brand business navigation" : "Print shop navigation"}>
      {groups.map((group) => (
        <section className="admin-nav-group" key={group.label}>
          <p>{group.label}</p>
          <div>
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "admin-nav-link active" : "admin-nav-link"}>
                <AdminIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}
