"use client";

import Link from "next/link";

const STEPS = [
  { key: "source", n: "01", label: "Source", text: "Garments", href: "/dashboard/brand-garments" },
  { key: "create", n: "02", label: "Create", text: "Designs", href: "/dashboard/designs" },
  { key: "build", n: "03", label: "Build", text: "Products", href: "/dashboard/brand-products" },
  { key: "merchandise", n: "04", label: "Merchandise", text: "Collections", href: "/dashboard/collections" },
  { key: "price", n: "05", label: "Price", text: "Economics", href: "/dashboard/brand-retail" },
  { key: "publish", n: "06", label: "Publish", text: "Storefront", href: "/dashboard/brand-storefront" },
  { key: "sell", n: "07", label: "Sell", text: "Sales", href: "/dashboard/brand-orders" }
] as const;

export type BrandWorkflowStep = typeof STEPS[number]["key"];

export default function BrandWorkflowRail({ active }: { active?: BrandWorkflowStep }) {
  return (
    <nav className="brand-workflow-rail" aria-label="Brand business workflow">
      {STEPS.map((step) => (
        <Link key={step.key} href={step.href} className={active === step.key ? "active" : ""}>
          <span>{step.n}</span>
          <div>
            <strong>{step.label}</strong>
            <small>{step.text}</small>
          </div>
        </Link>
      ))}
      <style jsx>{`
        .brand-workflow-rail{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin:0 0 14px;padding:5px;border:1px solid #e2e3df;border-radius:14px;background:#f4f4f0;overflow:auto}
        .brand-workflow-rail a{display:grid;grid-template-columns:23px minmax(0,1fr);gap:6px;align-items:center;min-width:112px;padding:8px;border-radius:9px;color:#565b60;text-decoration:none}
        .brand-workflow-rail a:hover{background:#fff}.brand-workflow-rail a.active{background:#1f2947;color:#fff;box-shadow:0 5px 14px rgba(31,41,71,.14)}
        .brand-workflow-rail a>span{display:grid;place-items:center;width:23px;height:23px;border-radius:99px;background:rgba(0,0,0,.07);font-size:7px;font-weight:900}.brand-workflow-rail a.active>span{background:rgba(255,255,255,.14)}
        .brand-workflow-rail strong,.brand-workflow-rail small{display:block}.brand-workflow-rail strong{font-size:8px;line-height:1.1}.brand-workflow-rail small{margin-top:2px;font-size:6px;opacity:.72}
        @media(max-width:900px){.brand-workflow-rail{grid-template-columns:repeat(7,128px);scrollbar-width:none}.brand-workflow-rail::-webkit-scrollbar{display:none}}
      `}</style>
    </nav>
  );
}
