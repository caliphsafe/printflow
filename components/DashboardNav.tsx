"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminIcon, { type AdminIconName } from "@/components/AdminIcon";
import type { ShopAccountMode } from "@/lib/shop-mode";

type NavItem={href:string;label:string;icon:AdminIconName};
type NavGroup={label:string;items:NavItem[]};

const printGroups:NavGroup[]=[
  {label:"Print Shop",items:[{href:"/dashboard/print",label:"Overview",icon:"home"},{href:"/dashboard/orders",label:"Orders",icon:"orders"}]},
  {label:"Catalog",items:[{href:"/dashboard/products",label:"Products",icon:"products"},{href:"/dashboard/suppliers",label:"Suppliers",icon:"suppliers"},{href:"/dashboard/suppliers/cart",label:"Supplier cart",icon:"cart"}]},
  {label:"Production & commerce",items:[{href:"/dashboard/pricing",label:"Production pricing",icon:"pricing"},{href:"/dashboard/settings",label:"Order storefront",icon:"settings"},{href:"/dashboard/integrations",label:"Integrations",icon:"integrations"}]}
];

const brandGroups:NavGroup[]=[
  {label:"Brand Business",items:[{href:"/dashboard/brand",label:"Overview",icon:"home"},{href:"/dashboard/brand-orders",label:"Sales & Orders",icon:"orders"}]},
  {label:"Build Your Own Catalog",items:[{href:"/dashboard/brand-garments",label:"Garments & Pricing",icon:"products"},{href:"/dashboard/designs",label:"Designs & Pricing",icon:"products"}]},
  {label:"Storefront",items:[{href:"/dashboard/brand-storefront",label:"Store Controls",icon:"settings"},{href:"/preview/brand",label:"Preview Builder",icon:"products"},{href:"/dashboard/brand-settings",label:"Store Design",icon:"settings"}]},
  {label:"Business",items:[{href:"/dashboard/brand-retail",label:"Cost Economics",icon:"pricing"},{href:"/dashboard/brand-sourcing",label:"Source Garments",icon:"suppliers"}]},
  {label:"Shared Connections",items:[{href:"/dashboard/suppliers",label:"Supplier Connections",icon:"suppliers"},{href:"/dashboard/integrations",label:"Payments & Integrations",icon:"integrations"}]}
];

const accountGroup:NavGroup={label:"PrintFlow Account",items:[{href:"/dashboard/mode",label:"Business access",icon:"settings"},{href:"/dashboard/account",label:"Account & billing",icon:"account"}]};

function active(path:string,href:string){if(href==="/dashboard/print")return path==="/dashboard/print";if(href==="/dashboard/brand")return path==="/dashboard/brand";return path.startsWith(href)}
export default function DashboardNav({accountMode="custom",activeWorkspace="print"}:{accountMode?:ShopAccountMode;activeWorkspace?:"print"|"brand"}) {
  const path=usePathname();const brand=accountMode==="brand"||(accountMode==="hybrid"&&activeWorkspace==="brand");const groups=[...(brand?brandGroups:printGroups),accountGroup];
  return <nav className="admin-nav" aria-label={brand?"Brand business navigation":"Print shop navigation"}>{groups.map(g=><section className="admin-nav-group" key={g.label}><p>{g.label}</p><div>{g.items.map(i=><Link key={i.href} href={i.href} className={active(path,i.href)?"admin-nav-link active":"admin-nav-link"}><AdminIcon name={i.icon}/><span>{i.label}</span></Link>)}</div></section>)}</nav>;
}
