"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items=[
 {href:"/dashboard",label:"Overview",icon:"home"},{href:"/dashboard/orders",label:"Orders",icon:"orders"},{href:"/dashboard/products",label:"Products",icon:"products"},{href:"/dashboard/pricing",label:"Pricing",icon:"pricing"},{href:"/dashboard/suppliers",label:"Suppliers",icon:"suppliers"},{href:"/dashboard/suppliers/cart",label:"Supplier cart",icon:"cart"},{href:"/dashboard/integrations",label:"Integrations",icon:"integrations"},{href:"/dashboard/settings",label:"Shop setup",icon:"settings"},{href:"/dashboard/account",label:"Account",icon:"account"}
];
function Icon({name}:{name:string}){const c={width:19,height:19,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 if(name==='home')return <svg {...c}><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>;
 if(name==='orders')return <svg {...c}><path d="M7 3h10v4H7z"/><path d="M5 5H4v16h16V5h-1"/><path d="M8 11h8M8 15h8"/></svg>;
 if(name==='products')return <svg {...c}><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></svg>;
 if(name==='pricing')return <svg {...c}><path d="M4 6h16M7 3v6M17 3v6"/><path d="M5 12h14v9H5z"/><path d="M9 16h6"/></svg>;
 if(name==='suppliers')return <svg {...c}><path d="M3 7h18v13H3z"/><path d="M6 7V4h12v3M3 12h18M8 12v8M16 12v8"/></svg>;
 if(name==='cart')return <svg {...c}><path d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>;
 if(name==='account')return <svg {...c}><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>;
 if(name==='integrations')return <svg {...c}><path d="M8 12a4 4 0 1 0-4 4h4"/><path d="M16 12a4 4 0 1 1 4 4h-4"/><path d="M8 8h8M8 16h8"/></svg>;
 return <svg {...c}><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5"/></svg>}
export default function DashboardNav(){const pathname=usePathname();return <nav className="admin-nav" aria-label="Dashboard navigation">{items.map(i=>{const active=i.href==='/dashboard'?pathname===i.href:i.href==='/dashboard/suppliers'?pathname==='/dashboard/suppliers'||pathname.startsWith('/dashboard/suppliers/catalog'):pathname.startsWith(i.href);return <Link key={i.href} href={i.href} className={active?'admin-nav-link active':'admin-nav-link'}><Icon name={i.icon}/><span>{i.label}</span></Link>})}</nav>}
