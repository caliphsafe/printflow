"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Connection = { provider: string; category: string; status: string; account_label?: string; last_tested_at?: string; last_error?: string; managedExternally?: boolean };
type Field = { key: string; label: string; type?: string; placeholder?: string };
type Definition = {
  provider: string;
  name: string;
  category: string;
  initials: string;
  description: string;
  note?: string;
  fields?: Field[];
  actionHref?: string;
  actionLabel?: string;
};

const definitions: Definition[] = [
  { provider: "stripe", name: "Stripe", category: "Payments", initials: "ST", description: "Native card payments, refunds, and payment status.", fields: [{ key: "secretKey", label: "Restricted or secret API key", type: "password", placeholder: "sk_live_…" }] },
  { provider: "square", name: "Square", category: "Payments", initials: "SQ", description: "Payments, locations, and future Square catalog workflows.", fields: [{ key: "accessToken", label: "Access token", type: "password" }, { key: "environment", label: "Environment", placeholder: "production or sandbox" }] },
  { provider: "squarespace", name: "Squarespace Commerce", category: "Commerce", initials: "SC", description: "Orders, products, inventory, and transaction synchronization.", fields: [{ key: "apiKey", label: "Commerce API key", type: "password" }] },
  { provider: "shopify", name: "Shopify", category: "Commerce", initials: "SH", description: "Store products, orders, and checkout handoff.", note: "Custom-app token mode. Public app OAuth can be added before marketplace launch.", fields: [{ key: "shopDomain", label: "Shop domain", placeholder: "store.myshopify.com" }, { key: "accessToken", label: "Admin API access token", type: "password" }] },
  { provider: "google-drive", name: "Google Drive", category: "Files", initials: "GD", description: "Deliver artwork, mockups, and production sheets to a shop folder.", fields: [{ key: "serviceAccountJson", label: "Service account JSON", type: "textarea" }, { key: "folderId", label: "Destination folder ID" }] },
  { provider: "ss-activewear", name: "S&S Activewear", category: "Suppliers", initials: "S&S", description: "Live blank catalog, inventory, product imports, and wholesale ordering. AlphaBroder is managed through S&S Activewear.", actionHref: "/dashboard/suppliers?manage=ss-activewear", actionLabel: "Manage supplier" },
  { provider: "sanmar", name: "SanMar", category: "Suppliers", initials: "SM", description: "Credential-ready supplier connection for future catalog and order mapping.", note: "Credentials can be stored securely now. Live catalog mapping requires approved provider access.", fields: [{ key: "accountNumber", label: "Account number" }, { key: "apiCredential", label: "API credential", type: "password" }] }
];

const categoryOptions = ["All", "Payments", "Commerce", "Suppliers", "Files"];

export default function IntegrationCenter({ initialConnections }: { initialConnections: Connection[] }) {
  const [connections, setConnections] = useState(initialConnections);
  const [open, setOpen] = useState<Definition | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("All");
  const visible = useMemo(() => category === "All" ? definitions : definitions.filter((item) => item.category === category), [category]);

  async function connect() {
    if (!open || !open.fields) return;
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/integrations/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: open.provider, category: ({ Payments: "payment", Commerce: "commerce", Files: "files", Suppliers: "supplier" } as Record<string, string>)[open.category] || "commerce", credentials: values })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok || !data.ok) return setMessage(data.error || "Connection failed.");
    setConnections((current) => [...current.filter((item) => item.provider !== open.provider), { provider: open.provider, category: open.category, status: "connected", account_label: data.accountLabel, last_tested_at: new Date().toISOString() }]);
    setMessage("Connected and encrypted.");
  }

  async function disconnect(provider: string) {
    if (!confirm("Disconnect this integration?")) return;
    await fetch(`/api/admin/integrations/connections?provider=${provider}`, { method: "DELETE" });
    setConnections((current) => current.filter((item) => item.provider !== provider));
    setOpen(null);
  }

  return <>
    <nav className="integration-filters" aria-label="Integration categories">{categoryOptions.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</nav>
    <div className="integration-center-grid upgraded">
      {visible.map((item) => {
        const connection = connections.find((candidate) => candidate.provider === item.provider);
        const status = connection?.status || "Not connected";
        return <article className="admin-card integration-vault-card upgraded" key={item.provider}>
          <header className="integration-card-header"><div className="integration-vault-icon">{item.initials}</div><span className={status === "connected" ? "status-pill connected" : status === "error" ? "status-pill error" : "status-pill"}>{status}</span></header>
          <div className="integration-vault-copy"><p className="eyebrow">{item.category}</p><h2>{item.name}</h2><p>{item.description}</p>{connection?.account_label && <small className="integration-account-label">{connection.account_label}</small>}{connection?.last_error && <small className="integration-error">{connection.last_error}</small>}</div>
          <footer className="integration-card-footer">
            <small>{connection?.last_tested_at ? `Last checked ${new Date(connection.last_tested_at).toLocaleDateString()}` : "Credentials encrypted at rest"}</small>
            {item.actionHref ? <Link className="secondary-button integration-card-action" href={item.actionHref}>{item.actionLabel || "Manage"}</Link> : <button className="secondary-button integration-card-action" onClick={() => { setOpen(item); setValues({}); setMessage(""); }}>{connection ? "Manage" : "Connect"}</button>}
          </footer>
        </article>;
      })}
    </div>

    {open && <div className="modal-backdrop" onMouseDown={() => setOpen(null)}><section className="integration-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setOpen(null)}>×</button><p className="eyebrow">CONNECT {open.category.toUpperCase()}</p><h2>{open.name}</h2><p>{open.description}</p>{open.note && <div className="integration-note">{open.note}</div>}<div className="integration-form">{open.fields?.map((field) => <label key={field.key}><span>{field.label}</span>{field.type === "textarea" ? <textarea rows={7} value={values[field.key] || ""} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}/> : <input type={field.type || "text"} placeholder={field.placeholder} value={values[field.key] || ""} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}/>}</label>)}</div>{message && <div className={message.startsWith("Connected") ? "success-message" : "error-message"}>{message}</div>}<div className="integration-modal-actions">{connections.some((item) => item.provider === open.provider) && <button className="danger-button" onClick={() => disconnect(open.provider)}>Disconnect</button>}<button className="primary-button" disabled={busy} onClick={connect}>{busy ? "Testing…" : "Save & test connection"}</button></div><small>Credentials are encrypted with PRINTFLOW_ENCRYPTION_KEY and are never returned to the browser after saving.</small></section></div>}
  </>;
}
