"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AccountAccess = "custom" | "brand" | "hybrid";
type Note = { note: string; created_by_email: string; created_at: string };
type Cadence = {
  last30: number; previous30: number; last90: number; growthRate: number; utilization: number;
  averageDaysBetween: number | null; lastOrderAt: string | null; daysSinceLastOrder: number | null;
  averageOrderValue: number; paidVolume30: number; monthlyLimit: number | null;
  months: { label: string; count: number }[];
};
type Growth = { score: number; segment: "upgrade" | "onboarding" | "retention" | "reengage" | "healthy"; reason: string; recommendedPlan: string | null };
type Row = {
  organization: { id: string; name: string; slug: string; subscription_status: string; created_at: string };
  shop?: {
    id: string; name: string; slug: string; active: boolean; onboarding_completed_at?: string | null;
    accountMode?: AccountAccess; effectiveAccessMode?: AccountAccess;
    platformAccess?: { customPrint: boolean; brandMerch: boolean };
  };
  subscription?: { plan_code?: string; status?: string; current_period_end?: string | null };
  orderCount: number; paidOrderCount: number; revenue: number; memberCount: number;
  ownerUserId: string; ownerEmail: string; ownerName: string;
  ownerCreatedAt?: string | null; ownerLastSignInAt?: string | null; ownerEmailConfirmedAt?: string | null;
  readiness: { payment: boolean; supplier: boolean; pricing: boolean; products: number; onboarding: boolean };
  integrations: { payments: string[]; suppliers: string[] };
  notes: Note[]; cadence: Cadence; growth: Growth;
};

type AccountCreationMode = "password" | "invite";

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
function accessLabel(value: AccountAccess) {
  if (value === "brand") return "Brand / Merch";
  if (value === "hybrid") return "Custom Print + Brand";
  return "Custom Print";
}

const freshCreateForm = () => ({
  ownerName: "", email: "", password: "", businessName: "",
  planCode: "starter", trialDays: 14, accountAccess: "custom" as AccountAccess
});

export default function PlatformAdminDashboard({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [view, setView] = useState<"accounts" | "growth">("accounts");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(initialRows[0]?.organization.id || "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [extensionDays, setExtensionDays] = useState(14);
  const [createOpen, setCreateOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<AccountCreationMode>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [createForm, setCreateForm] = useState(freshCreateForm());

  const filtered = useMemo(() => rows.filter((row) => {
    const matches = `${row.organization.name} ${row.shop?.name || ""} ${row.shop?.slug || ""} ${row.ownerEmail} ${row.ownerName}`.toLowerCase().includes(query.toLowerCase());
    if (!matches) return false;
    if (filter === "live") return Boolean(row.shop?.active);
    if (filter === "trial") return row.subscription?.status === "trialing";
    if (filter === "attention") return readinessScore(row) < 80 || ["past_due", "canceled"].includes(row.subscription?.status || "");
    if (filter === "brand") return row.shop?.effectiveAccessMode === "brand" || row.shop?.effectiveAccessMode === "hybrid";
    return true;
  }), [rows, query, filter]);

  const selected = rows.find((row) => row.organization.id === selectedId) || filtered[0];
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const activeShops = rows.filter((row) => row.shop?.active).length;
  const totalOrders = rows.reduce((sum, row) => sum + row.orderCount, 0);
  const attention = rows.filter((row) => readinessScore(row) < 80 || ["past_due", "canceled"].includes(row.subscription?.status || "")).length;
  const upgradeLeads = useMemo(() => rows.filter((row) => row.growth.segment === "upgrade").sort((a, b) => b.growth.score - a.growth.score), [rows]);

  async function update(row: Row, changes: Partial<{
    active: boolean; planCode: string; subscriptionStatus: string; ownerName: string;
    note: string; trialExtensionDays: number; accountAccess: AccountAccess;
  }>) {
    if (!row.shop) return;
    setBusy(row.organization.id);
    setMessage("");

    const next = {
      active: changes.active ?? row.shop.active,
      planCode: changes.planCode ?? row.subscription?.plan_code ?? "starter",
      subscriptionStatus: changes.subscriptionStatus ?? row.subscription?.status ?? row.organization.subscription_status ?? "trialing",
      ownerName: changes.ownerName ?? row.ownerName,
      note: changes.note || "",
      trialExtensionDays: changes.trialExtensionDays || 0,
      accountAccess: changes.accountAccess
    };

    const response = await fetch("/api/platform-admin/shops", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: row.organization.id,
        shopId: row.shop.id,
        ownerUserId: row.ownerUserId,
        ...next
      })
    });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to update account.");

    const newNote = next.note ? { note: next.note, created_by_email: "Platform admin", created_at: new Date().toISOString() } : null;
    setRows((current) => current.map((item) => {
      if (item.organization.id !== row.organization.id) return item;
      const accountMode = changes.accountAccess || item.shop?.effectiveAccessMode || "custom";
      return {
        ...item,
        organization: { ...item.organization, subscription_status: next.subscriptionStatus },
        shop: item.shop ? {
          ...item.shop,
          active: next.active,
          ...(changes.accountAccess ? {
            accountMode,
            effectiveAccessMode: accountMode,
            platformAccess: accountMode === "hybrid"
              ? { customPrint: true, brandMerch: true }
              : accountMode === "brand"
                ? { customPrint: false, brandMerch: true }
                : { customPrint: true, brandMerch: false }
          } : {})
        } : item.shop,
        subscription: { ...item.subscription, plan_code: next.planCode, status: next.subscriptionStatus, current_period_end: data.currentPeriodEnd || item.subscription?.current_period_end },
        ownerName: next.ownerName,
        notes: newNote ? [newNote, ...item.notes] : item.notes
      };
    }));

    setNote("");
    setMessage(`${row.organization.name} updated.`);
  }

  function openCreateAccount() {
    setCreateForm(freshCreateForm());
    setCreationMode("password");
    setShowPassword(false);
    setMessage("");
    setCreateOpen(true);
  }

  function closeCreateAccount() {
    if (busy === "create") return;
    setCreateOpen(false);
    setShowPassword(false);
  }

  async function createAccount() {
    setBusy("create");
    setMessage("");

    const payload = {
      ownerName: createForm.ownerName,
      email: createForm.email,
      businessName: createForm.businessName,
      planCode: createForm.planCode,
      trialDays: createForm.trialDays,
      accountAccess: createForm.accountAccess,
      ...(creationMode === "password" ? { password: createForm.password, creationMode: "password" } : {})
    };

    const response = await fetch("/api/platform-admin/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setBusy("");

    if (!response.ok) return setMessage(data.error || "Unable to create account.");

    setCreateOpen(false);
    setMessage(
      creationMode === "password"
        ? `${data.createdEmail} is ready with ${accessLabel(createForm.accountAccess)} access.`
        : `Invitation sent to ${data.invitedEmail} with ${accessLabel(createForm.accountAccess)} access.`
    );
    window.setTimeout(() => window.location.reload(), 900);
  }

  async function deleteAccount(row: Row) {
    if (!row.shop) return;
    const confirmed = window.confirm(
      `Permanently delete ${row.shop.name || row.organization.name}?\n\nThis removes the shop, orders, products, settings, connections, and users that do not belong to another PrintFlow organization. This cannot be undone.`
    );
    if (!confirmed) return;

    setBusy("delete");
    setMessage("");

    const response = await fetch("/api/platform-admin/shops", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: row.organization.id, confirmDelete: true })
    });
    const data = await response.json();
    setBusy("");

    if (!response.ok) return setMessage(data.error || "Unable to delete account.");

    const nextRows = rows.filter((item) => item.organization.id !== row.organization.id);
    setRows(nextRows);
    setSelectedId(nextRows[0]?.organization.id || "");
    setMessage(`${row.organization.name} was permanently removed.`);
  }

  function exportGrowthReport() {
    const headers = ["Shop", "Owner", "Email", "Access", "Plan", "Orders last 30", "Previous 30", "Growth", "Plan utilization", "Average order", "Days since last order", "Recommendation"];
    const lines = rows.map((row) => [
      row.shop?.name || row.organization.name, row.ownerName, row.ownerEmail,
      accessLabel(row.shop?.effectiveAccessMode || "custom"),
      row.subscription?.plan_code || "starter", row.cadence.last30, row.cadence.previous30,
      `${Math.round(row.cadence.growthRate * 100)}%`, `${Math.round(row.cadence.utilization * 100)}%`,
      row.cadence.averageOrderValue.toFixed(2), row.cadence.daysSinceLastOrder ?? "",
      segmentLabel(row.growth.segment)
    ]);
    const csv = [headers, ...lines].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `printflow-account-cadence-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const directCreateValid = /^\S+@\S+\.\S+$/.test(createForm.email.trim()) && createForm.businessName.trim().length > 0 && createForm.password.length >= 8;
  const inviteCreateValid = /^\S+@\S+\.\S+$/.test(createForm.email.trim()) && createForm.businessName.trim().length > 0;

  return (
    <main className="platform-admin-shell platform-command-center">
      <header className="platform-admin-header">
        <div>
          <p className="eyebrow">PRINTFLOW SYSTEMS</p>
          <h1>Platform control center</h1>
          <p>Manage account access, owners, billing, storefront status, and growth from one place.</p>
        </div>
        <div className="platform-header-actions">
          <button className="primary-button" onClick={openCreateAccount}>Add shop account</button>
          <Link className="secondary-button" href="/dashboard">Shop dashboard</Link>
        </div>
      </header>

      <nav className="platform-view-tabs" aria-label="Platform sections">
        <button className={view === "accounts" ? "active" : ""} onClick={() => setView("accounts")}>Account control</button>
        <button className={view === "growth" ? "active" : ""} onClick={() => setView("growth")}>Growth intelligence</button>
      </nav>

      <section className="platform-admin-metrics">
        <article><span>Accounts</span><strong>{rows.length}</strong><small>{rows.filter((row) => row.subscription?.status === "trialing").length} trials</small></article>
        <article><span>Live storefronts</span><strong>{activeShops}</strong><small>{rows.length - activeShops} paused or preparing</small></article>
        <article><span>Orders</span><strong>{totalOrders}</strong><small>{rows.reduce((sum, row) => sum + row.paidOrderCount, 0)} paid</small></article>
        <article><span>Paid volume</span><strong>{money(totalRevenue)}</strong><small>Across all shops</small></article>
        <article className={upgradeLeads.length ? "growth" : ""}><span>Upgrade leads</span><strong>{upgradeLeads.length}</strong><small>Based on cadence and plan use</small></article>
        <article className={attention ? "attention" : ""}><span>Needs attention</span><strong>{attention}</strong><small>Billing or setup support</small></article>
      </section>

      {message && <div className={message.includes("Unable") ? "error-message platform-global-message" : "success-message platform-global-message"}>{message}</div>}

      {view === "accounts" && (
        <section className="platform-control-layout">
          <div className="platform-account-list admin-card">
            <div className="platform-admin-toolbar">
              <div><h2>Shop accounts</h2><p>Select an account to manage the owner and every platform-level setting.</p></div>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shop or owner" />
            </div>

            <div className="platform-filter-row">
              {[["all","All"],["live","Live"],["trial","Trials"],["brand","Brand access"],["attention","Needs attention"]].map(([value,label]) => (
                <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>

            <div className="platform-account-cards">
              {filtered.map((row) => (
                <button key={row.organization.id} className={selected?.organization.id === row.organization.id ? "selected" : ""} onClick={() => setSelectedId(row.organization.id)}>
                  <span className="platform-shop-avatar">{(row.shop?.name || row.organization.name).slice(0,2).toUpperCase()}</span>
                  <span>
                    <strong>{row.shop?.name || row.organization.name}</strong>
                    <small>{row.ownerEmail || "Owner not assigned"} · {accessLabel(row.shop?.effectiveAccessMode || "custom")}</small>
                  </span>
                  <em>{readinessScore(row)}%</em>
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <aside className="platform-account-inspector admin-card">
              <header>
                <div>
                  <p className="section-kicker">ACCOUNT CONTROL</p>
                  <h2>{selected.shop?.name || selected.organization.name}</h2>
                  <p>{selected.ownerEmail || "Owner email unavailable"}</p>
                </div>
                <span className={selected.shop?.active ? "platform-live-chip" : "platform-paused-chip"}>{selected.shop?.active ? "Live" : "Paused"}</span>
              </header>

              <div className="platform-health-grid">
                <div><span>Launch health</span><strong>{readinessScore(selected)}%</strong></div>
                <div><span>Orders · 30 days</span><strong>{selected.cadence.last30}</strong></div>
                <div><span>Paid volume · 30 days</span><strong>{money(selected.cadence.paidVolume30)}</strong></div>
                <div><span>Trial / renewal</span><strong>{date(selected.subscription?.current_period_end)}</strong></div>
              </div>

              <section className="account-control-section">
                <div className="account-control-heading">
                  <div><span>Commerce access</span><h3>{accessLabel(selected.shop?.effectiveAccessMode || "custom")}</h3></div>
                  <small>Platform controlled</small>
                </div>
                <div className="account-access-options">
                  {(["custom","brand","hybrid"] as AccountAccess[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={busy === selected.organization.id}
                      className={(selected.shop?.effectiveAccessMode || "custom") === value ? "active" : ""}
                      onClick={() => update(selected, { accountAccess: value })}
                    >
                      <strong>{accessLabel(value)}</strong>
                      <small>
                        {value === "custom" ? "Customer-uploaded artwork orders" : value === "brand" ? "Predetermined design commerce" : "Both experiences in one account"}
                      </small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="account-control-section">
                <div className="account-control-heading"><div><span>Owner & subscription</span><h3>Account details</h3></div></div>
                <div className="platform-admin-fields">
                  <label><span>Owner name</span><input defaultValue={selected.ownerName} key={`${selected.organization.id}-name`} id="platform-owner-name" /></label>
                  <label><span>Plan</span><select value={selected.subscription?.plan_code || "starter"} disabled={!selected.shop || busy === selected.organization.id} onChange={(event) => update(selected, { planCode: event.target.value })}><option value="starter">Starter</option><option value="growth">Growth</option><option value="scale">Scale</option></select></label>
                  <label><span>Subscription status</span><select value={selected.subscription?.status || selected.organization.subscription_status || "trialing"} disabled={!selected.shop || busy === selected.organization.id} onChange={(event) => update(selected, { subscriptionStatus: event.target.value })}><option value="trialing">Trialing</option><option value="active">Active</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select></label>
                  <label><span>Extend access</span><select value={extensionDays} onChange={(event) => setExtensionDays(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label>
                </div>
                <div className="platform-action-row">
                  <button className="secondary-button" disabled={busy === selected.organization.id} onClick={() => update(selected, { ownerName: (document.getElementById("platform-owner-name") as HTMLInputElement)?.value || selected.ownerName })}>Save owner</button>
                  <button className="secondary-button" disabled={busy === selected.organization.id} onClick={() => update(selected, { trialExtensionDays: extensionDays })}>Extend {extensionDays} days</button>
                  <button className={selected.shop?.active ? "danger-button" : "primary-button"} disabled={!selected.shop || busy === selected.organization.id} onClick={() => update(selected, { active: !selected.shop!.active })}>{selected.shop?.active ? "Pause storefront" : "Activate storefront"}</button>
                </div>
              </section>

              <section className="account-control-section identity-section">
                <div className="account-control-heading"><div><span>User</span><h3>Owner access</h3></div></div>
                <div className="identity-grid">
                  <div><span>Email</span><strong>{selected.ownerEmail || "Unavailable"}</strong></div>
                  <div><span>Email confirmed</span><strong>{selected.ownerEmailConfirmedAt ? "Yes" : "Pending"}</strong></div>
                  <div><span>Last sign-in</span><strong>{date(selected.ownerLastSignInAt)}</strong></div>
                  <div><span>Account created</span><strong>{date(selected.ownerCreatedAt)}</strong></div>
                </div>
              </section>

              <div className="platform-support-note">
                <label><span>Support note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Record an account change, support conversation, or follow-up." /></label>
                <button className="primary-button" disabled={!note.trim() || busy === selected.organization.id} onClick={() => update(selected, { note })}>Add note</button>
              </div>

              <div className="platform-note-history">
                <h3>Recent support history</h3>
                {selected.notes.length ? selected.notes.map((item,index) => <article key={`${item.created_at}-${index}`}><p>{item.note}</p><small>{item.created_by_email} · {date(item.created_at)}</small></article>) : <p>No support notes yet.</p>}
              </div>

              <section className="simple-delete-account">
                <div>
                  <span>Delete account</span>
                  <p>Permanently remove this shop and its account data. You will receive one browser confirmation before deletion.</p>
                </div>
                <button className="danger-button" type="button" disabled={busy === "delete"} onClick={() => deleteAccount(selected)}>
                  {busy === "delete" ? "Deleting…" : "Delete account"}
                </button>
              </section>
            </aside>
          ) : <aside className="platform-account-inspector admin-card"><h2>No account selected</h2></aside>}
        </section>
      )}

      {view === "growth" && (
        <section className="platform-growth-section">
          <header className="platform-section-header">
            <div><p className="eyebrow">ACCOUNT CADENCE</p><h2>Growth and upgrade intelligence</h2><p>Use recent order behavior, plan utilization, average order value, and inactivity to prioritize outreach.</p></div>
            <button className="secondary-button" onClick={exportGrowthReport}>Download report</button>
          </header>
          <div className="platform-growth-grid">
            {[...rows].sort((a,b) => b.growth.score - a.growth.score).map((row) => (
              <article key={row.organization.id} className={`platform-growth-card ${row.growth.segment}`}>
                <header><div><span className="platform-shop-avatar">{(row.shop?.name || row.organization.name).slice(0,2).toUpperCase()}</span><div><h3>{row.shop?.name || row.organization.name}</h3><p>{accessLabel(row.shop?.effectiveAccessMode || "custom")} · {row.ownerEmail}</p></div></div><b>{segmentLabel(row.growth.segment)}</b></header>
                <div className="cadence-metric-grid">
                  <div><span>Last 30 days</span><strong>{row.cadence.last30}</strong><small>{trendLabel(row.cadence.growthRate)}</small></div>
                  <div><span>Plan usage</span><strong>{row.cadence.monthlyLimit ? `${Math.round(row.cadence.utilization * 100)}%` : "Unlimited"}</strong><small>{row.cadence.monthlyLimit ? `${row.cadence.last30} of ${row.cadence.monthlyLimit}` : "Scale plan"}</small></div>
                  <div><span>Average order</span><strong>{money(row.cadence.averageOrderValue)}</strong><small>{money(row.cadence.paidVolume30)} paid volume</small></div>
                  <div><span>Last order</span><strong>{row.cadence.daysSinceLastOrder === null ? "None" : `${row.cadence.daysSinceLastOrder}d`}</strong><small>{date(row.cadence.lastOrderAt)}</small></div>
                </div>
                <p className="platform-growth-reason">{row.growth.reason}</p>
                <footer><button className="secondary-button" onClick={() => { setSelectedId(row.organization.id); setView("accounts"); }}>Account details</button></footer>
              </article>
            ))}
          </div>
        </section>
      )}

      {createOpen && (
        <div className="modal-backdrop platform-account-modal-backdrop" onMouseDown={closeCreateAccount}>
          <section className="platform-create-modal platform-account-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeCreateAccount}>×</button>
            <div className="platform-account-modal-heading">
              <p className="eyebrow">NEW PRINTFLOW ACCOUNT</p>
              <h2>Add a shop account</h2>
              <p>Create the owner and choose exactly which commerce experiences the account can access.</p>
            </div>

            <div className="platform-account-mode-switch" role="tablist" aria-label="Account creation method">
              <button type="button" className={creationMode === "password" ? "active" : ""} onClick={() => setCreationMode("password")}><strong>Create login</strong><small>Email + password</small></button>
              <button type="button" className={creationMode === "invite" ? "active" : ""} onClick={() => setCreationMode("invite")}><strong>Send invitation</strong><small>Owner sets password</small></button>
            </div>

            <div className="platform-account-modal-form">
              <label><span>Business name</span><input value={createForm.businessName} onChange={(event) => setCreateForm((value) => ({ ...value, businessName: event.target.value }))} placeholder="Morgan Print Co." /></label>
              <label><span>Owner name <em>optional</em></span><input value={createForm.ownerName} onChange={(event) => setCreateForm((value) => ({ ...value, ownerName: event.target.value }))} placeholder="Alex Morgan" /></label>
              <label className="full"><span>Owner email</span><input type="email" value={createForm.email} onChange={(event) => setCreateForm((value) => ({ ...value, email: event.target.value }))} placeholder="alex@printshop.com" /></label>

              {creationMode === "password" && <label className="full"><span>Temporary password</span><div className="platform-password-input"><input type={showPassword ? "text" : "password"} minLength={8} autoComplete="new-password" value={createForm.password} onChange={(event) => setCreateForm((value) => ({ ...value, password: event.target.value }))} placeholder="Minimum 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div><small>The owner can change this after signing in.</small></label>}

              <div className="full create-access-field">
                <span>PrintFlow access</span>
                <div className="create-access-options">
                  {(["custom","brand","hybrid"] as AccountAccess[]).map((value) => (
                    <button type="button" key={value} className={createForm.accountAccess === value ? "active" : ""} onClick={() => setCreateForm((current) => ({ ...current, accountAccess: value }))}>
                      <strong>{accessLabel(value)}</strong>
                      <small>{value === "custom" ? "Custom artwork orders" : value === "brand" ? "Predetermined Brand commerce" : "Both experiences"}</small>
                    </button>
                  ))}
                </div>
              </div>

              <label><span>Starting plan</span><select value={createForm.planCode} onChange={(event) => setCreateForm((value) => ({ ...value, planCode: event.target.value }))}><option value="starter">Starter</option><option value="growth">Growth</option><option value="scale">Scale</option></select></label>
              <label><span>Trial period</span><select value={createForm.trialDays} onChange={(event) => setCreateForm((value) => ({ ...value, trialDays: Number(event.target.value) }))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label>
            </div>

            {message && createOpen && <div className="error-message">{message}</div>}

            <div className="platform-account-modal-footer">
              <p>{creationMode === "password" ? "The login is created immediately with the selected PrintFlow access." : "The owner receives a secure email and their PrintFlow access is already assigned."}</p>
              <div>
                <button className="secondary-button" type="button" disabled={busy === "create"} onClick={closeCreateAccount}>Cancel</button>
                <button className="primary-button" disabled={busy === "create" || !(creationMode === "password" ? directCreateValid : inviteCreateValid)} onClick={createAccount}>
                  {busy === "create" ? "Creating account…" : creationMode === "password" ? "Create login" : "Send invitation"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <style jsx>{`
        .account-control-section { padding:18px 0; border-top:1px solid #e8e8e3; }
        .account-control-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:12px; }
        .account-control-heading span { display:block; margin-bottom:3px; color:#777; font-size:9px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
        .account-control-heading h3 { margin:0; font-size:14px; }
        .account-control-heading > small { padding:5px 7px; border-radius:999px; background:#f2f2ee; color:#777; font-size:9px; }
        .account-access-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
        .account-access-options button,.create-access-options button { min-width:0; padding:11px; border:1px solid #deded8; border-radius:10px; background:#fff; color:#171717; text-align:left; cursor:pointer; }
        .account-access-options button.active,.create-access-options button.active { border-color:#171717; background:#f5f5f1; box-shadow:inset 0 0 0 1px #171717; }
        .account-access-options strong,.create-access-options strong { display:block; margin-bottom:3px; font-size:10px; }
        .account-access-options small,.create-access-options small { display:block; color:#747474; font-size:8px; line-height:1.35; }
        .identity-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .identity-grid > div { display:grid; gap:3px; padding:10px 11px; border-radius:9px; background:#f6f6f2; min-width:0; }
        .identity-grid span { color:#777; font-size:8px; text-transform:uppercase; letter-spacing:.07em; }
        .identity-grid strong { min-width:0; overflow-wrap:anywhere; font-size:10px; }
        .simple-delete-account { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-top:18px; padding-top:18px; border-top:1px solid #ead4d2; }
        .simple-delete-account span { display:block; margin-bottom:3px; color:#9a2e26; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
        .simple-delete-account p { margin:0; max-width:470px; color:#777; font-size:9px; line-height:1.45; }
        .create-access-field { display:grid; gap:7px; }
        .create-access-field > span { font-size:.78rem; font-weight:750; }
        .create-access-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; }
        @media(max-width:760px) {
          .account-access-options,.create-access-options { grid-template-columns:1fr; }
          .identity-grid { grid-template-columns:1fr; }
          .simple-delete-account { align-items:stretch; flex-direction:column; }
        }
      `}</style>
    </main>
  );
}
