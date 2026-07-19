"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Row = {
  organization: { id: string; name: string; slug: string; subscription_status: string; created_at: string };
  shop?: { id: string; name: string; slug: string; active: boolean; onboarding_completed_at?: string | null };
  subscription?: { plan_code?: string; status?: string };
  orderCount: number;
  revenue: number;
  memberCount: number;
  ownerEmail: string;
  ownerName: string;
};

export default function PlatformAdminDashboard({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => rows.filter((row) => `${row.organization.name} ${row.shop?.name || ""} ${row.shop?.slug || ""} ${row.ownerEmail} ${row.ownerName}`.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const activeShops = rows.filter((row) => row.shop?.active).length;
  const totalOrders = rows.reduce((sum, row) => sum + row.orderCount, 0);

  async function update(row: Row, changes: Partial<{ active: boolean; planCode: string; subscriptionStatus: string }>) {
    if (!row.shop) return;
    setBusy(row.organization.id); setMessage("");
    const next = {
      active: changes.active ?? row.shop.active,
      planCode: changes.planCode ?? row.subscription?.plan_code ?? "starter",
      subscriptionStatus: changes.subscriptionStatus ?? row.subscription?.status ?? row.organization.subscription_status ?? "trialing"
    };
    const response = await fetch("/api/platform-admin/shops", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: row.organization.id, shopId: row.shop.id, ...next }) });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to update account.");
    setRows((current) => current.map((item) => item.organization.id === row.organization.id ? { ...item, organization: { ...item.organization, subscription_status: next.subscriptionStatus }, shop: item.shop ? { ...item.shop, active: next.active } : item.shop, subscription: { ...item.subscription, plan_code: next.planCode, status: next.subscriptionStatus } } : item));
    setMessage(`${row.organization.name} updated.`);
  }

  return <main className="platform-admin-shell">
    <header className="platform-admin-header"><div><p className="eyebrow">PRINTFLOW ADMIN</p><h1>Platform control center</h1><p>Manage shops, plans, account status, and platform activity.</p></div><Link className="secondary-button" href="/dashboard">Shop dashboard</Link></header>
    <section className="platform-admin-metrics"><article><span>Accounts</span><strong>{rows.length}</strong></article><article><span>Active shops</span><strong>{activeShops}</strong></article><article><span>Orders</span><strong>{totalOrders}</strong></article><article><span>Paid volume</span><strong>${totalRevenue.toFixed(2)}</strong></article></section>
    <section className="platform-admin-table-card"><div className="platform-admin-toolbar"><div><h2>Shop accounts</h2><p>Control availability and subscription access.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts" /></div>{message && <div className="success-message">{message}</div>}<div className="platform-admin-table"><div className="platform-admin-row head"><span>Shop</span><span>Plan</span><span>Status</span><span>Orders</span><span>Revenue</span><span>Storefront</span></div>{filtered.map((row) => <div className="platform-admin-row" key={row.organization.id}><span><strong>{row.shop?.name || row.organization.name}</strong><small>{row.ownerName || row.ownerEmail || row.shop?.slug || "Setup incomplete"}</small>{row.ownerName && row.ownerEmail ? <small>{row.ownerEmail}</small> : null}</span><span><select value={row.subscription?.plan_code || "starter"} disabled={!row.shop || busy === row.organization.id} onChange={(event) => update(row, { planCode: event.target.value })}><option value="starter">Starter</option><option value="growth">Growth</option><option value="scale">Scale</option></select></span><span><select value={row.subscription?.status || row.organization.subscription_status || "trialing"} disabled={!row.shop || busy === row.organization.id} onChange={(event) => update(row, { subscriptionStatus: event.target.value })}><option value="trialing">Trialing</option><option value="active">Active</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select></span><span>{row.orderCount}</span><span>${row.revenue.toFixed(2)}</span><span>{row.shop ? <button className={row.shop.active ? "platform-status-button live" : "platform-status-button"} disabled={busy === row.organization.id} onClick={() => update(row, { active: !row.shop!.active })}>{row.shop.active ? "Live" : "Paused"}</button> : "—"}</span></div>)}</div></section>
  </main>;
}
