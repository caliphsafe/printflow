"use client";
import Link from "next/link";

const STEPS = [
  { key:"garments", n:"01", label:"Garments", text:"Choose & price", href:"/dashboard/brand-garments" },
  { key:"designs", n:"02", label:"Designs", text:"Upload & price", href:"/dashboard/designs" },
  { key:"store", n:"03", label:"Storefront", text:"Preview & publish", href:"/dashboard/brand-storefront" },
  { key:"sales", n:"04", label:"Sales", text:"Orders & mockups", href:"/dashboard/brand-orders" }
] as const;
export type BrandWorkflowStep=typeof STEPS[number]["key"] | "source" | "create" | "build" | "merchandise" | "price" | "publish" | "sell";
export default function BrandWorkflowRail({active}:{active?:BrandWorkflowStep}) {
  return <nav className="brand-flow-v3">{STEPS.map(s=><Link key={s.key} href={s.href} className={active===s.key?"active":""}><span>{s.n}</span><div><strong>{s.label}</strong><small>{s.text}</small></div></Link>)}<style jsx>{`
    .brand-flow-v3{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:13px;padding:5px;border:1px solid #e2e2dd;border-radius:12px;background:#f1f1ed}.brand-flow-v3 a{display:grid;grid-template-columns:25px 1fr;gap:7px;align-items:center;padding:8px;border-radius:8px;color:#666;text-decoration:none}.brand-flow-v3 a.active{background:#1f2947;color:#fff}.brand-flow-v3 span{display:grid;place-items:center;width:24px;height:24px;border-radius:99px;background:rgba(0,0,0,.07);font-size:7px;font-weight:900}.brand-flow-v3 a.active span{background:rgba(255,255,255,.14)}.brand-flow-v3 strong,.brand-flow-v3 small{display:block}.brand-flow-v3 strong{font-size:8px}.brand-flow-v3 small{font-size:6px;opacity:.7}@media(max-width:650px){.brand-flow-v3{grid-template-columns:repeat(4,125px);overflow:auto}}
  `}</style></nav>;
}
