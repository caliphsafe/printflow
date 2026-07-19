"use client";

import { useMemo, useState } from "react";
import FloatingSaveBar from "@/components/FloatingSaveBar";
import { useUnsavedChanges } from "@/components/useUnsavedChanges";

type Plan = { code: string; name: string; monthly_price: number; description: string; features: string[]; order_limit?: number | null };
type Account = { plan_code?: string; status?: string; current_period_end?: string | null; provider_customer_id?: string | null } | null;
type Profile = { fullName: string; businessName: string; contactEmail: string; phone: string; loginEmail: string };

export default function AccountBillingManager({ plans, account, billingConfigured, profile: initialProfile }: { plans: Plan[]; account: Account; billingConfigured: boolean; profile: Profile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [savedProfile, setSavedProfile] = useState(initialProfile);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const dirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(savedProfile), [profile, savedProfile]);
  useUnsavedChanges(dirty);

  async function saveProfile() {
    setBusy("profile"); setMessage("");
    const response = await fetch("/api/admin/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    const data = await response.json();
    setBusy("");
    if (!response.ok) return setMessage(data.error || "Unable to save account information.");
    setProfile(data.profile); setSavedProfile(data.profile); setMessage("Account information saved.");
  }

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
    if (!response.ok) return setMessage(data.error || "Unable to load billing settings.");
    window.location.assign(data.url);
  }

  const currentPlan = account?.plan_code || "growth";
  const status = account?.status || "trialing";
  const period = account?.current_period_end ? new Date(account.current_period_end).toLocaleDateString() : "Not set";

  return <div className="account-billing-shell account-management-shell">
    <section className="account-status-glass">
      <div><p className="eyebrow">ACCOUNT</p><h1>Account and billing</h1><p>Keep ownership, customer contact, and subscription information current.</p></div>
      <div className="account-status-values"><span><small>Current plan</small><strong>{plans.find((plan) => plan.code === currentPlan)?.name || currentPlan}</strong></span><span><small>Status</small><strong>{status.replace("_", " ")}</strong></span><span><small>Next date</small><strong>{period}</strong></span></div>
      {account?.provider_customer_id && <button className="secondary-button" disabled={busy === "portal"} onClick={manage}>{busy === "portal" ? "Loading…" : "Billing settings"}</button>}
    </section>

    {message && <div className={message.includes("saved") ? "success-message" : "error-message"}>{message}</div>}

    <section className="admin-card account-profile-card">
      <div className="card-heading"><div><p className="section-kicker">BUSINESS PROFILE</p><h2>Account information</h2><p>This information identifies the account and gives customers a reliable way to reach your shop.</p></div></div>
      <div className="account-profile-grid">
        <label><span>Your name</span><input value={profile.fullName} onChange={(event) => setProfile((value) => ({ ...value, fullName: event.target.value }))} /></label>
        <label><span>Business name</span><input value={profile.businessName} onChange={(event) => setProfile((value) => ({ ...value, businessName: event.target.value }))} /></label>
        <label><span>Customer contact email</span><input type="email" value={profile.contactEmail} onChange={(event) => setProfile((value) => ({ ...value, contactEmail: event.target.value }))} /></label>
        <label><span>Business phone</span><input value={profile.phone} onChange={(event) => setProfile((value) => ({ ...value, phone: event.target.value }))} /></label>
        <label className="full"><span>Login email</span><input value={profile.loginEmail} readOnly /><small>Login email changes require email verification and are managed securely through account recovery.</small></label>
      </div>
    </section>

    {!billingConfigured && <div className="account-billing-notice"><strong>Plan checkout is not active yet.</strong><p>The PrintFlow billing account must be connected before paid subscriptions can begin.</p></div>}

    <section className="account-plan-section"><div className="card-heading"><div><p className="section-kicker">SUBSCRIPTION</p><h2>Choose the capacity that fits the shop</h2><p>Customer payment processing remains separate in your Integrations page.</p></div></div><div className="account-plan-grid">
      {plans.map((plan) => {
        const current = plan.code === currentPlan;
        return <article key={plan.code} className={current ? "account-plan-card current" : "account-plan-card"}>
          {current && <span className="plan-current">Current plan</span>}
          <p>{plan.name}</p><h2>${Number(plan.monthly_price).toFixed(0)}<small>/month</small></h2><p>{plan.description}</p>
          <ul>{(plan.features || []).map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
          <button className={current ? "secondary-button" : "primary-button"} disabled={!billingConfigured || busy !== "" || (current && status === "active")} onClick={() => choose(plan.code)}>{busy === plan.code ? "Starting checkout…" : current && status === "active" ? "Active plan" : current ? "Activate plan" : `Choose ${plan.name}`}</button>
        </article>;
      })}
    </div></section>

    <FloatingSaveBar dirty={dirty} busy={busy === "profile"} onSave={saveProfile} message={dirty ? "Save updated account information." : "Account information is current."} />
  </div>;
}
