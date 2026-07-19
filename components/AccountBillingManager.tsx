"use client";

import { useState } from "react";

type Plan = { code: string; name: string; monthly_price: number; description: string; features: string[]; order_limit?: number | null };
type Account = { plan_code?: string; status?: string; current_period_end?: string | null; provider_customer_id?: string | null } | null;

export default function AccountBillingManager({ plans, account, billingConfigured, email }: { plans: Plan[]; account: Account; billingConfigured: boolean; email: string }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function choose(planCode: string) {
    setBusy(planCode); setMessage("");
    const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCode }) });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to start checkout.");
    window.location.assign(data.url);
  }

  async function manage() {
    setBusy("portal"); setMessage("");
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to open billing management.");
    window.location.assign(data.url);
  }

  const currentPlan = account?.plan_code || "growth";
  const status = account?.status || "trialing";
  const period = account?.current_period_end ? new Date(account.current_period_end).toLocaleDateString() : "Not set";

  return <div className="account-billing-shell">
    <section className="account-status-glass">
      <div><p className="eyebrow">ACCOUNT</p><h1>Plan and billing</h1><p>Manage the PrintFlow subscription for {email}.</p></div>
      <div className="account-status-values"><span><small>Current plan</small><strong>{plans.find((plan) => plan.code === currentPlan)?.name || currentPlan}</strong></span><span><small>Status</small><strong>{status.replace("_", " ")}</strong></span><span><small>Next date</small><strong>{period}</strong></span></div>
      {account?.provider_customer_id && <button className="secondary-button" disabled={busy === "portal"} onClick={manage}>{busy === "portal" ? "Loading…" : "Billing settings"}</button>}
    </section>

    {!billingConfigured && <div className="account-billing-notice"><strong>Subscription checkout needs one final platform setting.</strong><p>The platform owner must add the PrintFlow billing Stripe key in Vercel before paid plans can begin.</p></div>}
    {message && <div className="error-message">{message}</div>}

    <section className="account-plan-grid">
      {plans.map((plan) => {
        const current = plan.code === currentPlan;
        return <article key={plan.code} className={current ? "account-plan-card current" : "account-plan-card"}>
          {current && <span className="plan-current">Current plan</span>}
          <p>{plan.name}</p><h2>${Number(plan.monthly_price).toFixed(0)}<small>/month</small></h2><p>{plan.description}</p>
          <ul>{(plan.features || []).map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
          <button className={current ? "secondary-button" : "primary-button"} disabled={!billingConfigured || busy !== "" || (current && status === "active")} onClick={() => choose(plan.code)}>{busy === plan.code ? "Starting checkout…" : current && status === "active" ? "Active plan" : current ? "Activate plan" : `Choose ${plan.name}`}</button>
        </article>;
      })}
    </section>
  </div>;
}
