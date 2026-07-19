"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

type Guide = {
  eyebrow: string;
  title: string;
  intro: string;
  steps: string[];
  links: { label: string; href: string }[];
};

const guides: Record<string, Guide> = {
  overview: {
    eyebrow: "GETTING STARTED",
    title: "Launch your first order flow",
    intro: "Complete these foundations in order. PrintFlow updates the dashboard checklist as the shop becomes ready to accept orders.",
    steps: ["Connect Stripe or Square.", "Connect S&S and import at least one product.", "Review production pricing.", "Customize and publish the storefront."],
    links: [{ label: "Launch checklist", href: "/dashboard" }, { label: "Preview storefront", href: "/preview/storefront" }]
  },
  orders: {
    eyebrow: "ORDER HELP",
    title: "Move an order into production",
    intro: "Select an order to review payment, artwork, mockups, customer notes, blank requirements, and fulfillment status.",
    steps: ["Confirm payment is marked Paid.", "Download original artwork and mockups.", "Review design optimization requests.", "Prepare or place the supplier blank order."],
    links: [{ label: "View all orders", href: "/dashboard/orders" }, { label: "Preview order flow", href: "/preview/storefront" }]
  },
  products: {
    eyebrow: "PRODUCT HELP",
    title: "Publish a customer-ready product",
    intro: "A product needs customer options, garment images, print zones, a real cost basis, and an Active status.",
    steps: ["Add sizes, colors, and decoration methods.", "Upload front and back images for each color.", "Position Heart and Full print zones.", "Confirm supplier or manual cost, then save and activate."],
    links: [{ label: "Manage products", href: "/dashboard/products" }, { label: "Import from S&S", href: "/dashboard/suppliers/catalog" }]
  },
  pricing: {
    eyebrow: "PRICING HELP",
    title: "Build a reliable production quote",
    intro: "PrintFlow starts with the garment cost, applies your markup, then calculates the selected production method and quantity break.",
    steps: ["Set the garment markup.", "Configure Screen Print, DTF, and Embroidery inputs.", "Add quantity discounts.", "Publish pricing before testing checkout."],
    links: [{ label: "Pricing", href: "/dashboard/pricing" }, { label: "Return to products", href: "/dashboard/products" }]
  },
  suppliers: {
    eyebrow: "SUPPLIER HELP",
    title: "Import live blanks safely",
    intro: "Use S&S to browse real styles, colors, costs, inventory, and exact SKUs before publishing products.",
    steps: ["Confirm S&S shows Connected.", "Search the live catalog.", "Choose only the colors you plan to sell.", "Import and finish print zones in Products."],
    links: [{ label: "Browse S&S catalog", href: "/dashboard/suppliers/catalog" }, { label: "Manage suppliers", href: "/dashboard/suppliers" }]
  },
  integrations: {
    eyebrow: "INTEGRATION HELP",
    title: "Connect live services",
    intro: "A provider is marked connected only after PrintFlow validates the credentials and completes the required live setup.",
    steps: ["Connect Stripe or Square for checkout.", "Connect S&S for catalog and blank ordering.", "Use test credentials first when available.", "Run one complete order before switching fully live."],
    links: [{ label: "Manage integrations", href: "/dashboard/integrations" }, { label: "Preview checkout flow", href: "/preview/storefront" }]
  },
  account: {
    eyebrow: "ACCOUNT HELP",
    title: "Manage your PrintFlow plan",
    intro: "Your plan controls monthly order capacity and account access. Customer payments remain separate in your shop's Stripe or Square connection.",
    steps: ["Review the current plan and status.", "Choose a plan before the trial ends.", "Use Billing settings to manage payment details.", "Contact platform support if account access needs review."],
    links: [{ label: "Plan and billing", href: "/dashboard/account" }, { label: "Overview", href: "/dashboard" }]
  },
  settings: {
    eyebrow: "STOREFRONT HELP",
    title: "Create a storefront customers trust",
    intro: "Preview privately while you work. The public storefront only opens after Storefront active is enabled and saved.",
    steps: ["Add contact details and a logo.", "Choose readable brand colors.", "Write clear artwork and turnaround guidance.", "Preview, then activate and save."],
    links: [{ label: "Preview storefront", href: "/preview/storefront" }, { label: "Edit shop setup", href: "/dashboard/settings" }]
  }
};

function guideKey(pathname: string) {
  if (pathname.startsWith("/dashboard/orders")) return "orders";
  if (pathname.startsWith("/dashboard/products")) return "products";
  if (pathname.startsWith("/dashboard/pricing")) return "pricing";
  if (pathname.startsWith("/dashboard/suppliers")) return "suppliers";
  if (pathname.startsWith("/dashboard/integrations")) return "integrations";
  if (pathname.startsWith("/dashboard/account")) return "account";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  return "overview";
}

export default function DashboardHelp() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const guide = useMemo(() => guides[guideKey(pathname)], [pathname]);

  return (
    <div className={open ? "dashboard-help open" : "dashboard-help"}>
      {open && (
        <aside className="dashboard-help-panel" aria-label="Page setup assistance">
          <header>
            <div><p>{guide.eyebrow}</p><h2>{guide.title}</h2></div>
            <button type="button" aria-label="Close help" onClick={() => setOpen(false)}>×</button>
          </header>
          <p className="dashboard-help-intro">{guide.intro}</p>
          <ol>{guide.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
          <footer>{guide.links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</Link>)}</footer>
        </aside>
      )}
      <button className="dashboard-help-trigger" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>?</span><b>{open ? "Close help" : "Setup help"}</b>
      </button>
    </div>
  );
}
