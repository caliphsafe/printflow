"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Overview", icon: "home" },
  { href: "/dashboard/orders", label: "Orders", icon: "orders" },
  { href: "/dashboard/products", label: "Products", icon: "products" },
  { href: "/dashboard/integrations", label: "Integrations", icon: "integrations" },
  { href: "/dashboard/settings", label: "Shop setup", icon: "settings" },
];

function Icon({ name }: { name: string }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "home") return <svg {...common}><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>;
  if (name === "orders") return <svg {...common}><path d="M7 3h10v4H7z"/><path d="M5 5H4v16h16V5h-1"/><path d="M8 11h8M8 15h8"/></svg>;
  if (name === "products") return <svg {...common}><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></svg>;
  if (name === "integrations") return <svg {...common}><path d="M8 12a4 4 0 1 0-4 4h4"/><path d="M16 12a4 4 0 1 1 4 4h-4"/><path d="M8 8h8M8 16h8"/></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.08A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.08A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.08A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.25.37.46.67.6 1 .1.25.1.62.1 1.1V12.4h.9v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>;
}

export default function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="Dashboard navigation">
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} className={active ? "admin-nav-link active" : "admin-nav-link"}><Icon name={item.icon}/><span>{item.label}</span></Link>;
      })}
    </nav>
  );
}
