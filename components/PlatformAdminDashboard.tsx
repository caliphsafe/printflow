"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Note = { note: string; created_by_email: string; created_at: string };
type Cadence = {
  last30: number;
  previous30: number;
  last90: number;
  growthRate: number;
  utilization: number;
  averageDaysBetween: number | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  averageOrderValue: number;
  paidVolume30: number;
  monthlyLimit: number | null;
  months: { label: string; count: number }[];
};
type Growth = { score: number; segment: "upgrade" | "onboarding" | "retention" | "reengage" | "healthy"; reason: string; recommendedPlan: string | null };
type Row = {
  organization: { id: string; name: string; slug: string; subscription_status: string; created_at: string };
  shop?: { id: string; name: string; slug: string; active: boolean; onboarding_completed_at?: string | null };
  subscription?: { plan_code?: string; status?: string; current_period_end?: string | null };
  orderCount: number;
  paidOrderCount: number;
  revenue: number;
  memberCount: number;
  ownerUserId: string;
  ownerEmail: string;
  ownerName: string;
  ownerCreatedAt?: string | null;
  ownerLastSignInAt?: string | null;
  ownerEmailConfirmedAt?: string | null;
  readiness: { payment: boolean; supplier: boolean; pricing: boolean; products: number; onboarding: boolean };
  integrations: { payments: string[]; suppliers: string[] };
  notes: Note[];
  cadence: Cadence;
  growth: Growth;
};

function date(value?: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function readinessScore(row: Row) {
  const checks = [row.readiness.payment, row.readiness.supplier, row.readiness.pricing, row.readiness.products > 0, row.readiness.onboarding];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function trendLabel(rate: number) {
  if (!Number.isFinite(rate)) return "No comparison";
  const percent = Math.round(rate * 100);
  return `${percent >= 0 ? "+" : ""}${percent}% vs previous 30 days`;
}

function segmentLabel(segment: Growth["segment"]) {
  return { upgrade: "Upgrade opportunity", onboarding: "Onboarding support", retention: "Billing attention", reengage: "Re-engagement", healthy: "Healthy" }[segment];
}

export default function PlatformAdminDashboard({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [view, setView] = useState<"accounts" | "growth" | "users">("accounts");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(initialRows[0]?.organization.id || "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [extensionDays, setExtensionDays] = useState(14);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ownerName: "", email: "", businessName: "", planCode: "starter", trialDays: 14 });
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const filtered = useMemo(() => rows.filter((row) => {
    const matches = `${row.organization.name} ${row.shop?.name || ""} ${row.shop?.slug || ""} ${row.ownerEmail} ${row.ownerName}`.toLowerCase().includes(query.toLowerCase());
    if (!matches) return false;
    if (filter === "live") return Boolean(row.shop?.active);
    if (filter === "trial") return row.subscription?.status === "trialing";
    if (filter === "attention") return readinessScore(row) < 80 || ["past_due", "canceled"].includes(row.subscription?.status || "");
    if (filter === "upgrade") return row.growth.segment === "upgrade";
    return true;
  }), [rows, query, filter]);

  const selected = rows.find((row) => row.organization.id === selectedId) || filtered[0];
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const activeShops = rows.filter((row) => row.shop?.active).length;
  const totalOrders = rows.reduce((sum, row) => sum + row.orderCount, 0);
  const attention = rows.filter((row) => readinessScore(row) < 80 || ["past_due", "canceled"].includes(row.subscription?.status || "")).length;
  const upgradeLeads = useMemo(() => rows.filter((row) => row.growth.segment === "upgrade").sort((a, b) => b.growth.score - a.growth.score), [rows]);

  async function update(row: Row, changes: Partial<{ active: boolean; planCode: string; subscriptionStatus: string; ownerName: string; note: string; trialExtensionDays: number }>) {
    if (!row.shop) return;
    setBusy(row.organization.id); setMessage("");
    const next = {
      active: changes.active ?? row.shop.active,
      planCode: changes.planCode ?? row.subscription?.plan_code ?? "starter",
      subscriptionStatus: changes.subscriptionStatus ?? row.subscription?.status ?? row.organization.subscription_status ?? "trialing",
      ownerName: changes.ownerName ?? row.ownerName,
      note: changes.note || "",
      trialExtensionDays: changes.trialExtensionDays || 0
    };
    const response = await fetch("/api/platform-admin/shops", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: row.organization.id, shopId: row.shop.id, ownerUserId: row.ownerUserId, ...next }) });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to update account.");
    const newNote = next.note ? { note: next.note, created_by_email: "Platform admin", created_at: new Date().toISOString() } : null;
    setRows((current) => current.map((item) => item.organization.id === row.organization.id ? {
      ...item,
      organization: { ...item.organization, subscription_status: next.subscriptionStatus },
      shop: item.shop ? { ...item.shop, active: next.active } : item.shop,
      subscription: { ...item.subscription, plan_code: next.planCode, status: next.subscriptionStatus, current_period_end: data.currentPeriodEnd || item.subscription?.current_period_end },
      ownerName: next.ownerName,
      notes: newNote ? [newNote, ...item.notes] : item.notes
    } : item));
    setNote("");
    setMessage(`${row.organization.name} updated.`);
  }

  async function createAccount() {
    setBusy("create"); setMessage("");
    const response = await fetch("/api/platform-admin/shops", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createForm) });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to create account.");
    setMessage(`Invitation sent to ${data.invitedEmail}. The new shop can complete guided setup from the invitation.`);
    setCreateOpen(false);
    window.setTimeout(() => window.location.reload(), 900);
  }

  async function deleteAccount(row: Row) {
    if (!row.shop) return;
    setBusy("delete"); setMessage("");
    const response = await fetch("/api/platform-admin/shops", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: row.organization.id, confirmation: deleteConfirmation }) });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to delete account.");
    const nextRows = rows.filter((item) => item.organization.id !== row.organization.id);
    setRows(nextRows);
    setSelectedId(nextRows[0]?.organization.id || "");
    setDeleteConfirmation("");
    setMessage(`${row.organization.name} was permanently removed.`);
  }

  function exportGrowthReport() {
    const headers = ["Shop", "Owner", "Email", "Plan", "Orders last 30", "Previous 30", "Growth", "Plan utilization", "Average order", "Days since last order", "Recommendation"];
    const lines = rows.map((row) => [row.shop?.name || row.organization.name, row.ownerName, row.ownerEmail, row.subscription?.plan_code || "starter", row.cadence.last30, row.cadence.previous30, `${Math.round(row.cadence.growthRate * 100)}%`, `${Math.round(row.cadence.utilization * 100)}%`, row.cadence.averageOrderValue.toFixed(2), row.cadence.daysSinceLastOrder ?? "", segmentLabel(row.growth.segment)]);
    const csv = [headers, ...lines].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `printflow-account-cadence-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <main className="platform-admin-shell platform-command-center">
    <header className="platform-admin-header"><div><p className="eyebrow">PRINTFLOW SYSTEMS</p><h1>Platform control center</h1><p>Manage accounts, support shop owners, understand order behavior, and identify the right moment for an upgrade conversation.</p></div><div className="platform-header-actions"><button className="primary-button" onClick={() => setCreateOpen(true)}>Add shop account</button><Link className="secondary-button" href="/dashboard">Shop dashboard</Link></div></header>

    <nav className="platform-view-tabs" aria-label="Platform sections">{[["accounts", "Account control"], ["growth", "Growth intelligence"], ["users", "User management"]].map(([key, label]) => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key as any)}>{label}</button>)}</nav>

    <section className="platform-admin-metrics"><article><span>Accounts</span><strong>{rows.length}</strong><small>{rows.filter((row) => row.subscription?.status === "trialing").length} trials</small></article><article><span>Live storefronts</span><strong>{activeShops}</strong><small>{rows.length - activeShops} paused or preparing</small></article><article><span>Orders</span><strong>{totalOrders}</strong><small>{rows.reduce((sum, row) => sum + row.paidOrderCount, 0)} paid</small></article><article><span>Paid volume</span><strong>{money(totalRevenue)}</strong><small>Across all shops</small></article><article className={upgradeLeads.length ? "growth" : ""}><span>Upgrade leads</span><strong>{upgradeLeads.length}</strong><small>Based on cadence and plan use</small></article><article className={attention ? "attention" : ""}><span>Needs attention</span><strong>{attention}</strong><small>Billing or setup support</small></article></section>

    {message && <div className={message.includes("Unable") || message.includes("Type ") ? "error-message platform-global-message" : "success-message platform-global-message"}>{message}</div>}

    {view === "accounts" && <section className="platform-control-layout">
      <div className="platform-account-list admin-card"><div className="platform-admin-toolbar"><div><h2>Shop accounts</h2><p>Select an account to manage support, access, and launch health.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shop or owner" /></div><div className="platform-filter-row">{[["all", "All"], ["live", "Live"], ["trial", "Trials"], ["attention", "Needs attention"], ["upgrade", "Upgrade leads"]].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="platform-account-cards">{filtered.map((row) => <button key={row.organization.id} className={selected?.organization.id === row.organization.id ? "selected" : ""} onClick={() => setSelectedId(row.organization.id)}><span className="platform-shop-avatar">{(row.shop?.name || row.organization.name).slice(0, 2).toUpperCase()}</span><span><strong>{row.shop?.name || row.organization.name}</strong><small>{row.ownerEmail || "Owner not assigned"}</small></span><em>{readinessScore(row)}%</em></button>)}</div></div>
      {selected ? <aside className="platform-account-inspector admin-card"><header><div><p className="section-kicker">ACCOUNT SUPPORT</p><h2>{selected.shop?.name || selected.organization.name}</h2><p>{selected.ownerEmail || "Owner email unavailable"}</p></div><span className={selected.shop?.active ? "platform-live-chip" : "platform-paused-chip"}>{selected.shop?.active ? "Live" : "Paused"}</span></header>
        <div className="platform-health-grid"><div><span>Launch health</span><strong>{readinessScore(selected)}%</strong></div><div><span>Orders · 30 days</span><strong>{selected.cadence.last30}</strong></div><div><span>Paid volume · 30 days</span><strong>{money(selected.cadence.paidVolume30)}</strong></div><div><span>Trial / renewal</span><strong>{date(selected.subscription?.current_period_end)}</strong></div></div>
        <div className={`platform-growth-callout ${selected.growth.segment}`}><span>{segmentLabel(selected.growth.segment)}</span><strong>{selected.growth.recommendedPlan ? `Recommend ${selected.growth.recommendedPlan}` : trendLabel(selected.cadence.growthRate)}</strong><p>{selected.growth.reason}</p></div>
        <div className="platform-readiness-list"><span className={selected.readiness.onboarding ? "done" : ""}>Onboarding</span><span className={selected.readiness.payment ? "done" : ""}>Payments</span><span className={selected.readiness.supplier ? "done" : ""}>Supplier</span><span className={selected.readiness.pricing ? "done" : ""}>Pricing</span><span className={selected.readiness.products > 0 ? "done" : ""}>{selected.readiness.products} products</span></div>
        <div className="platform-admin-fields"><label><span>Owner name</span><input defaultValue={selected.ownerName} key={`${selected.organization.id}-name`} id="platform-owner-name" /></label><label><span>Plan</span><select value={selected.subscription?.plan_code || "starter"} disabled={!selected.shop || busy === selected.organization.id} onChange={(event) => update(selected, { planCode: event.target.value })}><option value="starter">Starter</option><option value="growth">Growth</option><option value="scale">Scale</option></select></label><label><span>Subscription status</span><select value={selected.subscription?.status || selected.organization.subscription_status || "trialing"} disabled={!selected.shop || busy === selected.organization.id} onChange={(event) => update(selected, { subscriptionStatus: event.target.value })}><option value="trialing">Trialing</option><option value="active">Active</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select></label><label><span>Extend access</span><select value={extensionDays} onChange={(event) => setExtensionDays(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label></div>
        <div className="platform-action-row"><button className="secondary-button" disabled={busy === selected.organization.id} onClick={() => update(selected, { ownerName: (document.getElementById("platform-owner-name") as HTMLInputElement)?.value || selected.ownerName })}>Save owner</button><button className="secondary-button" disabled={busy === selected.organization.id} onClick={() => update(selected, { trialExtensionDays: extensionDays })}>Extend {extensionDays} days</button><button className={selected.shop?.active ? "danger-button" : "primary-button"} disabled={!selected.shop || busy === selected.organization.id} onClick={() => update(selected, { active: !selected.shop!.active })}>{selected.shop?.active ? "Pause storefront" : "Activate storefront"}</button></div>
        <div className="platform-support-note"><label><span>Support note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Record an account change, support conversation, or follow-up." /></label><button className="primary-button" disabled={!note.trim() || busy === selected.organization.id} onClick={() => update(selected, { note })}>Add note</button></div>
        <div className="platform-note-history"><h3>Recent support history</h3>{selected.notes.length ? selected.notes.map((item, index) => <article key={`${item.created_at}-${index}`}><p>{item.note}</p><small>{item.created_by_email} · {date(item.created_at)}</small></article>) : <p>No support notes yet.</p>}</div>
      </aside> : <aside className="platform-account-inspector admin-card"><h2>No account selected</h2></aside>}
    </section>}

    {view === "growth" && <section className="platform-growth-section"><header className="platform-section-header"><div><p className="eyebrow">ACCOUNT CADENCE</p><h2>Growth and upgrade intelligence</h2><p>Use recent order behavior, plan utilization, average order value, and inactivity to prioritize outreach.</p></div><button className="secondary-button" onClick={exportGrowthReport}>Download report</button></header><div className="platform-growth-grid">{[...rows].sort((a, b) => b.growth.score - a.growth.score).map((row) => <article key={row.organization.id} className={`platform-growth-card ${row.growth.segment}`}><header><div><span className="platform-shop-avatar">{(row.shop?.name || row.organization.name).slice(0, 2).toUpperCase()}</span><div><h3>{row.shop?.name || row.organization.name}</h3><p>{row.subscription?.plan_code || "starter"} · {row.ownerEmail}</p></div></div><b>{segmentLabel(row.growth.segment)}</b></header><div className="cadence-metric-grid"><div><span>Last 30 days</span><strong>{row.cadence.last30}</strong><small>{trendLabel(row.cadence.growthRate)}</small></div><div><span>Plan usage</span><strong>{row.cadence.monthlyLimit ? `${Math.round(row.cadence.utilization * 100)}%` : "Unlimited"}</strong><small>{row.cadence.monthlyLimit ? `${row.cadence.last30} of ${row.cadence.monthlyLimit}` : "Scale plan"}</small></div><div><span>Average order</span><strong>{money(row.cadence.averageOrderValue)}</strong><small>{money(row.cadence.paidVolume30)} paid volume</small></div><div><span>Last order</span><strong>{row.cadence.daysSinceLastOrder === null ? "None" : `${row.cadence.daysSinceLastOrder}d`}</strong><small>{date(row.cadence.lastOrderAt)}</small></div></div><div className="cadence-spark" aria-label="Six month order cadence">{row.cadence.months.map((month) => <div key={month.label}><i style={{ height: `${Math.max(6, Math.min(100, month.count * 12))}%` }}/><span>{month.label}</span><b>{month.count}</b></div>)}</div><p className="platform-growth-reason">{row.growth.reason}</p><footer>{row.growth.recommendedPlan && <button className="primary-button" onClick={() => { setSelectedId(row.organization.id); setView("accounts"); }}>Review upgrade</button>}<button className="secondary-button" onClick={() => { setSelectedId(row.organization.id); setView("accounts"); }}>Account details</button></footer></article>)}</div></section>}

    {view === "users" && <section className="platform-user-management"><div className="admin-card platform-create-account-card"><div><p className="eyebrow">NEW ACCOUNT</p><h2>Invite a shop owner</h2><p>PrintFlow creates the workspace and sends a secure invitation to complete password setup and onboarding.</p></div><div className="platform-create-grid"><label><span>Owner name</span><input value={createForm.ownerName} onChange={(event) => setCreateForm((value) => ({ ...value, ownerName: event.target.value }))} placeholder="Alex Morgan"/></label><label><span>Owner email</span><input type="email" value={createForm.email} onChange={(event) => setCreateForm((value) => ({ ...value, email: event.target.value }))} placeholder="alex@printshop.com"/></label><label><span>Business name</span><input value={createForm.businessName} onChange={(event) => setCreateForm((value) => ({ ...value, businessName: event.target.value }))} placeholder="Morgan Print Co."/></label><label><span>Starting plan</span><select value={createForm.planCode} onChange={(event) => setCreateForm((value) => ({ ...value, planCode: event.target.value }))}><option value="starter">Starter</option><option value="growth">Growth</option><option value="scale">Scale</option></select></label><label><span>Trial period</span><select value={createForm.trialDays} onChange={(event) => setCreateForm((value) => ({ ...value, trialDays: Number(event.target.value) }))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label></div><button className="primary-button" disabled={busy === "create" || !createForm.email || !createForm.businessName} onClick={createAccount}>{busy === "create" ? "Creating account…" : "Create account and send invitation"}</button></div>
      <div className="admin-card platform-user-directory"><div><p className="eyebrow">USER DIRECTORY</p><h2>Owners and access</h2><p>Review account identity, email confirmation, and recent access.</p></div><div className="platform-user-table"><div className="platform-user-row heading"><span>Owner</span><span>Shop</span><span>Confirmed</span><span>Last sign-in</span><span>Plan</span></div>{rows.map((row) => <button key={row.organization.id} className="platform-user-row" onClick={() => { setSelectedId(row.organization.id); setView("accounts"); }}><span><strong>{row.ownerName || "Owner name missing"}</strong><small>{row.ownerEmail}</small></span><span>{row.shop?.name || row.organization.name}</span><span>{row.ownerEmailConfirmedAt ? "Yes" : "Pending"}</span><span>{date(row.ownerLastSignInAt)}</span><span>{row.subscription?.plan_code || "starter"}</span></button>)}</div></div>
      {selected && <div className="admin-card platform-danger-zone"><div><p className="eyebrow">PERMANENT REMOVAL</p><h2>Delete {selected.shop?.name || selected.organization.name}</h2><p>This permanently removes the shop, its orders, products, settings, connections, and users who do not belong to another PrintFlow organization.</p></div><label><span>Type <b>{selected.shop?.slug || selected.organization.slug}</b> to confirm</span><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={selected.shop?.slug || selected.organization.slug}/></label><button className="danger-button" disabled={busy === "delete" || deleteConfirmation !== (selected.shop?.slug || selected.organization.slug)} onClick={() => deleteAccount(selected)}>{busy === "delete" ? "Deleting account…" : "Permanently delete account"}</button></div>}
    </section>}

    {createOpen && <div className="modal-backdrop" onMouseDown={() => setCreateOpen(false)}><section className="platform-create-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setCreateOpen(false)}>×</button><p className="eyebrow">NEW PRINTFLOW ACCOUNT</p><h2>Invite a shop owner</h2><p>Create the workspace now and email the owner a secure invitation.</p><div className="platform-create-grid"><label><span>Owner name</span><input value={createForm.ownerName} onChange={(event) => setCreateForm((value) => ({ ...value, ownerName: event.target.value }))}/></label><label><span>Owner email</span><input type="email" value={createForm.email} onChange={(event) => setCreateForm((value) => ({ ...value, email: event.target.value }))}/></label><label className="full"><span>Business name</span><input value={createForm.businessName} onChange={(event) => setCreateForm((value) => ({ ...value, businessName: event.target.value }))}/></label><label><span>Plan</span><select value={createForm.planCode} onChange={(event) => setCreateForm((value) => ({ ...value, planCode: event.target.value }))}><option value="starter">Starter</option><option value="growth">Growth</option><option value="scale">Scale</option></select></label><label><span>Trial</span><select value={createForm.trialDays} onChange={(event) => setCreateForm((value) => ({ ...value, trialDays: Number(event.target.value) }))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label></div><button className="primary-button" disabled={busy === "create" || !createForm.email || !createForm.businessName} onClick={createAccount}>{busy === "create" ? "Creating account…" : "Create and send invitation"}</button></section></div>}
  </main>;
}
