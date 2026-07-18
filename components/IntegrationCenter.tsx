"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Connection = { provider: string; category: string; status: string; account_label?: string; last_tested_at?: string; last_error?: string; configuration?: Record<string, any> };
type Field = { key: string; label: string; type?: string; placeholder?: string; help?: string };
type Definition = { provider: string; name: string; category: string; initials: string; description: string; capability: string; fields?: Field[]; actionHref?: string; status: "live" | "roadmap" };

const definitions: Definition[] = [
  { provider: "stripe", name: "Stripe Payments", category: "Payments", initials: "ST", description: "Native Stripe Checkout, live payment status, and automatic order updates.", capability: "Creates hosted checkout sessions and configures the PrintFlow webhook during connection.", status: "live", fields: [{ key: "secretKey", label: "Stripe secret key", type: "password", placeholder: "sk_live_…", help: "Use a live key for production or a test key while validating your workflow." }] },
  { provider: "square", name: "Square Payments", category: "Payments", initials: "SQ", description: "Square-hosted checkout with automatic payment status updates.", capability: "Creates payment links using your active location and installs a payment webhook.", status: "live", fields: [{ key: "accessToken", label: "Personal access token", type: "password", help: "The token must have checkout, order, payment, location, and webhook permissions." }, { key: "environment", label: "Environment", type: "select", placeholder: "production" }] },
  { provider: "ss-activewear", name: "S&S Activewear", category: "Suppliers", initials: "S&S", description: "Live catalog, account pricing, inventory, exact SKUs, and blank ordering.", capability: "Connected supplier products can be imported and ordered from the production workflow.", actionHref: "/dashboard/suppliers?manage=ss-activewear", status: "live" },
  { provider: "google-drive", name: "Google Drive Delivery", category: "Files", initials: "GD", description: "Production-file delivery and job-folder automation.", capability: "Roadmap — hidden from connection until resumable large-file delivery is production verified.", status: "roadmap" },
  { provider: "shopify", name: "Shopify Commerce", category: "Commerce", initials: "SH", description: "Product, customer, and order synchronization.", capability: "Roadmap — OAuth and two-way synchronization are being prepared for a future release.", status: "roadmap" },
  { provider: "squarespace", name: "Squarespace Commerce", category: "Commerce", initials: "SC", description: "Commerce order and catalog synchronization.", capability: "Roadmap — connection is disabled until the complete sync workflow is production ready.", status: "roadmap" },
  { provider: "sanmar", name: "SanMar", category: "Suppliers", initials: "SM", description: "Catalog and wholesale order connection.", capability: "Roadmap — available after approved API access and live catalog mapping.", status: "roadmap" }
];

const categories = ["All", "Payments", "Suppliers", "Commerce", "Files"];

export default function IntegrationCenter({ initialConnections }: { initialConnections: Connection[] }) {
  const [connections, setConnections] = useState(initialConnections);
  const [open, setOpen] = useState<Definition | null>(null);
  const [values, setValues] = useState<Record<string, string>>({ environment: "production" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("All");
  const visible = useMemo(() => category === "All" ? definitions : definitions.filter((item) => item.category === category), [category]);

  async function connect() {
    if (!open?.fields) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: open.provider, category: "payment", credentials: values }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Connection failed.");
      setConnections((current) => [...current.filter((item) => item.provider !== open.provider), { provider: open.provider, category: "payment", status: "connected", account_label: data.accountLabel, last_tested_at: new Date().toISOString(), configuration: data.configuration }]);
      setMessage(`${open.name} is live. New customer orders can use it immediately.`);
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  async function disconnect(provider: string) {
    if (!confirm("Disconnect this live integration? New orders will stop using it.")) return;
    const response = await fetch(`/api/admin/integrations/connections?provider=${provider}`, { method: "DELETE" });
    if (response.ok) { setConnections((current) => current.filter((item) => item.provider !== provider)); setOpen(null); }
  }

  return <>
    <nav className="integration-filters" aria-label="Integration categories">{categories.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</nav>
    <div className="integration-live-grid">
      {visible.map((item) => {
        const connection = connections.find((candidate) => candidate.provider === item.provider);
        const connected = connection?.status === "connected";
        const mode = connection?.configuration?.mode;
        return <article className={item.status === "roadmap" ? "integration-live-card roadmap" : "integration-live-card"} key={item.provider}>
          <header><div className="integration-live-icon">{item.initials}</div><span className={connected ? "status-pill connected" : item.status === "roadmap" ? "status-pill roadmap" : "status-pill"}>{connected ? mode === "test" || mode === "sandbox" ? "Test connected" : "Live" : item.status === "roadmap" ? "Roadmap" : "Not connected"}</span></header>
          <div className="integration-live-copy"><p className="eyebrow">{item.category}</p><h2>{item.name}</h2><p>{item.description}</p><div className="integration-capability"><span>✓</span><small>{item.capability}</small></div>{connection?.account_label && <strong className="integration-account-label">{connection.account_label}</strong>}{connection?.last_error && <small className="integration-error">{connection.last_error}</small>}</div>
          <footer><small>{connected && connection?.last_tested_at ? `Verified ${new Date(connection.last_tested_at).toLocaleDateString()}` : item.status === "live" ? "Credentials encrypted at rest" : "No credentials accepted yet"}</small>{item.actionHref ? <Link className="secondary-button integration-card-action" href={item.actionHref}>{connected ? "Manage live connection" : "Connect supplier"}</Link> : item.status === "live" ? <button type="button" className="secondary-button integration-card-action" onClick={() => { setOpen(item); setValues({ environment: "production" }); setMessage(""); }}>{connected ? "Manage connection" : "Connect & activate"}</button> : <button type="button" className="secondary-button integration-card-action" disabled>Coming soon</button>}</footer>
        </article>;
      })}
    </div>

    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(null)}><section className="integration-modal production" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setOpen(null)}>×</button><p className="eyebrow">LIVE CONNECTION</p><h2>{open.name}</h2><p>{open.capability}</p><div className="integration-live-warning"><strong>This activates real customer transactions.</strong><span>Use production credentials only when you are ready to accept live payments.</span></div><div className="integration-form">{open.fields?.map((field) => <label key={field.key}><span>{field.label}</span>{field.type === "select" ? <select value={values[field.key] || "production"} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}><option value="production">Production / live</option><option value="sandbox">Sandbox / test</option></select> : <input type={field.type || "text"} placeholder={field.placeholder} value={values[field.key] || ""} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}/>} {field.help && <small>{field.help}</small>}</label>)}</div>{message && <div className={message.includes("is live") ? "success-message" : "error-message"}>{message}</div>}<div className="integration-modal-actions">{connections.some((item) => item.provider === open.provider) && <button className="danger-button" onClick={() => disconnect(open.provider)}>Disconnect</button>}<button className="primary-button" disabled={busy} onClick={connect}>{busy ? "Verifying and activating…" : "Connect and make live"}</button></div><small>PrintFlow verifies the account and creates the payment webhook before marking this connection live.</small></section></div>}
  </>;
}
