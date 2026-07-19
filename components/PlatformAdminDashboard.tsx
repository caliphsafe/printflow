"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Note = { note: string; created_by_email: string; created_at: string };
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
  readiness: { payment: boolean; supplier: boolean; pricing: boolean; products: number; onboarding: boolean };
  integrations: { payments: string[]; suppliers: string[] };
  notes: Note[];
};

function date(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function readinessScore(row: Row) {
  const checks = [row.readiness.payment, row.readiness.supplier, row.readiness.pricing, row.readiness.products > 0, row.readiness.onboarding];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function PlatformAdminDashboard({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(initialRows[0]?.organization.id || "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [extensionDays, setExtensionDays] = useState(14);
  const filtered = useMemo(() => rows.filter((row) => {
    const matches = `${row.organization.name} ${row.shop?.name || ""} ${row.shop?.slug || ""} ${row.ownerEmail} ${row.ownerName}`.toLowerCase().includes(query.toLowerCase());
    if (!matches) return false;
    if (filter === "live") return Boolean(row.shop?.active);
    if (filter === "trial") return row.subscription?.status === "trialing";
    if (filter === "attention") return readinessScore(row) < 80 || ["past_due", "canceled"].includes(row.subscription?.status || "");
    return true;
  }), [rows, query, filter]);
  const selected = rows.find((row) => row.organization.id === selectedId) || filtered[0];
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const activeShops = rows.filter((row) => row.shop?.active).length;
  const totalOrders = rows.reduce((sum, row) => sum + row.orderCount, 0);
  const attention = rows.filter((row) => readinessScore(row) < 80 || ["past_due", "canceled"].includes(row.subscription?.status || "")).length;

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
    const response = await fetch("/api/platform-admin/shops", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: row.organization.id, shopId: row.shop.id, ownerUserId: row.ownerUserId, ...next })
    });
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

  return <main className="platform-admin-shell platform-command-center">
    <header className="platform-admin-header"><div><p className="eyebrow">PRINTFLOW SYSTEMS</p><h1>Platform control center</h1><p>Support every shop, review launch health, manage access, and keep the network moving.</p></div><Link className="secondary-button" href="/dashboard">Shop dashboard</Link></header>
    <section className="platform-admin-metrics"><article><span>Accounts</span><strong>{rows.length}</strong><small>{rows.filter((row) => row.subscription?.status === "trialing").length} trials</small></article><article><span>Live storefronts</span><strong>{activeShops}</strong><small>{rows.length - activeShops} paused or preparing</small></article><article><span>Orders</span><strong>{totalOrders}</strong><small>{rows.reduce((sum,row)=>sum+row.paidOrderCount,0)} paid</small></article><article><span>Paid volume</span><strong>${totalRevenue.toFixed(2)}</strong><small>Across all shops</small></article><article className={attention ? "attention" : ""}><span>Needs attention</span><strong>{attention}</strong><small>Billing or setup support</small></article></section>

    <section className="platform-control-layout">
      <div className="platform-account-list admin-card">
        <div className="platform-admin-toolbar"><div><h2>Shop accounts</h2><p>Select an account to manage support and access.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shop or owner" /></div>
        <div className="platform-filter-row">{[["all","All"],["live","Live"],["trial","Trials"],["attention","Needs attention"]].map(([value,label])=><button key={value} className={filter===value?"active":""} onClick={()=>setFilter(value)}>{label}</button>)}</div>
        <div className="platform-account-cards">{filtered.map((row) => <button key={row.organization.id} className={selected?.organization.id===row.organization.id?"selected":""} onClick={()=>setSelectedId(row.organization.id)}><span className="platform-shop-avatar">{(row.shop?.name || row.organization.name).slice(0,2).toUpperCase()}</span><span><strong>{row.shop?.name || row.organization.name}</strong><small>{row.ownerEmail || "Owner not assigned"}</small></span><em>{readinessScore(row)}%</em></button>)}</div>
      </div>

      {selected ? <aside className="platform-account-inspector admin-card">
        <header><div><p className="section-kicker">ACCOUNT SUPPORT</p><h2>{selected.shop?.name || selected.organization.name}</h2><p>{selected.ownerEmail || "Owner email unavailable"}</p></div><span className={selected.shop?.active?"platform-live-chip":"platform-paused-chip"}>{selected.shop?.active?"Live":"Paused"}</span></header>
        {message && <div className="success-message">{message}</div>}
        <div className="platform-health-grid"><div><span>Launch health</span><strong>{readinessScore(selected)}%</strong></div><div><span>Orders</span><strong>{selected.orderCount}</strong></div><div><span>Paid volume</span><strong>${selected.revenue.toFixed(2)}</strong></div><div><span>Trial / renewal</span><strong>{date(selected.subscription?.current_period_end)}</strong></div></div>
        <div className="platform-readiness-list"><span className={selected.readiness.onboarding?"done":""}>Onboarding</span><span className={selected.readiness.payment?"done":""}>Payments</span><span className={selected.readiness.supplier?"done":""}>Supplier</span><span className={selected.readiness.pricing?"done":""}>Pricing</span><span className={selected.readiness.products>0?"done":""}>{selected.readiness.products} products</span></div>
        <div className="platform-admin-fields">
          <label><span>Owner name</span><input defaultValue={selected.ownerName} key={`${selected.organization.id}-name`} id="platform-owner-name" /></label>
          <label><span>Plan</span><select value={selected.subscription?.plan_code || "starter"} disabled={!selected.shop || busy===selected.organization.id} onChange={(event)=>update(selected,{planCode:event.target.value})}><option value="starter">Starter</option><option value="growth">Growth</option><option value="scale">Scale</option></select></label>
          <label><span>Subscription status</span><select value={selected.subscription?.status || selected.organization.subscription_status || "trialing"} disabled={!selected.shop || busy===selected.organization.id} onChange={(event)=>update(selected,{subscriptionStatus:event.target.value})}><option value="trialing">Trialing</option><option value="active">Active</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select></label>
          <label><span>Extend access</span><select value={extensionDays} onChange={(event)=>setExtensionDays(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label>
        </div>
        <div className="platform-action-row"><button className="secondary-button" disabled={busy===selected.organization.id} onClick={()=>update(selected,{ownerName:(document.getElementById("platform-owner-name") as HTMLInputElement)?.value || selected.ownerName})}>Save owner</button><button className="secondary-button" disabled={busy===selected.organization.id} onClick={()=>update(selected,{trialExtensionDays:extensionDays})}>Extend {extensionDays} days</button><button className={selected.shop?.active?"danger-button":"primary-button"} disabled={!selected.shop||busy===selected.organization.id} onClick={()=>update(selected,{active:!selected.shop!.active})}>{selected.shop?.active?"Pause storefront":"Activate storefront"}</button></div>
        <div className="platform-support-note"><label><span>Support note</span><textarea value={note} onChange={(event)=>setNote(event.target.value)} rows={3} placeholder="Record an account change, support conversation, or follow-up." /></label><button className="primary-button" disabled={!note.trim()||busy===selected.organization.id} onClick={()=>update(selected,{note})}>Add note</button></div>
        <div className="platform-note-history"><h3>Recent support history</h3>{selected.notes.length?selected.notes.map((item,index)=><article key={`${item.created_at}-${index}`}><p>{item.note}</p><small>{item.created_by_email} · {date(item.created_at)}</small></article>):<p>No support notes yet.</p>}</div>
      </aside> : <aside className="platform-account-inspector admin-card"><h2>No account selected</h2></aside>}
    </section>
  </main>;
}
