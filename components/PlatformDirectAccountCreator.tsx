"use client";

import { useState } from "react";

const initialForm = {
  email: "",
  password: "",
  ownerName: "",
  businessName: "",
  planCode: "starter",
  trialDays: 14
};

export default function PlatformDirectAccountCreator() {
  const [form, setForm] = useState(initialForm);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const emailValid = /^\S+@\S+\.\S+$/.test(form.email.trim());
  const passwordValid = form.password.length >= 8;
  const businessValid = form.businessName.trim().length > 0;
  const canSubmit = emailValid && passwordValid && businessValid && !busy;

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/platform-admin/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email.trim().toLowerCase(),
          ownerName: form.ownerName.trim(),
          businessName: form.businessName.trim(),
          creationMode: "password"
        })
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Unable to create account." });
        return;
      }

      setMessage({
        type: "success",
        text: `${data.createdEmail} is ready. The owner can sign in immediately with the password you set.`
      });
      setForm(initialForm);
      setAdvancedOpen(false);
      setShowPassword(false);
      window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      setMessage({ type: "error", text: "Unable to create account. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="direct-account-card" aria-labelledby="direct-account-title">
      <div className="direct-account-intro">
        <div>
          <p className="direct-account-kicker">QUICK ACCOUNT SETUP</p>
          <h2 id="direct-account-title">Create a shop login</h2>
          <p>
            Create the owner&apos;s login directly from PrintFlow. They can sign in immediately
            instead of waiting for an invitation email.
          </p>
        </div>
        <span className="direct-account-security">Admin only</span>
      </div>

      <form onSubmit={createAccount}>
        <div className="direct-account-primary-grid">
          <label>
            <span>Owner email</span>
            <input
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
              placeholder="owner@printshop.com"
              aria-invalid={Boolean(form.email) && !emailValid}
            />
            <small>This becomes the account&apos;s sign-in email.</small>
          </label>

          <label>
            <span>Temporary password</span>
            <div className="direct-password-field">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={form.password}
                onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))}
                placeholder="Minimum 8 characters"
                aria-invalid={Boolean(form.password) && !passwordValid}
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <small>The owner can change this later from their account.</small>
          </label>

          <label>
            <span>Business name</span>
            <input
              value={form.businessName}
              onChange={(event) => setForm((value) => ({ ...value, businessName: event.target.value }))}
              placeholder="Morgan Print Co."
            />
            <small>Used to create the shop workspace.</small>
          </label>

          <label>
            <span>Owner name <em>optional</em></span>
            <input
              value={form.ownerName}
              onChange={(event) => setForm((value) => ({ ...value, ownerName: event.target.value }))}
              placeholder="Alex Morgan"
            />
            <small>Can also be completed later.</small>
          </label>
        </div>

        <button
          className="direct-account-advanced-toggle"
          type="button"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((value) => !value)}
        >
          <span>
            <b>Plan & access</b>
            <small>{form.planCode.charAt(0).toUpperCase() + form.planCode.slice(1)} · {form.trialDays}-day trial</small>
          </span>
          <strong>{advancedOpen ? "−" : "+"}</strong>
        </button>

        {advancedOpen && (
          <div className="direct-account-advanced-grid">
            <label>
              <span>Starting plan</span>
              <select
                value={form.planCode}
                onChange={(event) => setForm((value) => ({ ...value, planCode: event.target.value }))}
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="scale">Scale</option>
              </select>
            </label>
            <label>
              <span>Trial period</span>
              <select
                value={form.trialDays}
                onChange={(event) => setForm((value) => ({ ...value, trialDays: Number(event.target.value) }))}
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
              </select>
            </label>
          </div>
        )}

        {message && (
          <div className={`direct-account-message ${message.type}`} role="status">
            {message.text}
          </div>
        )}

        <div className="direct-account-footer">
          <p>
            The login is created in Supabase Auth and attached to a new PrintFlow organization
            and shop automatically.
          </p>
          <button className="primary-button" type="submit" disabled={!canSubmit}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </div>
      </form>

      <style jsx>{`
        .direct-account-card {
          margin: 0 0 26px;
          padding: 26px;
          border: 1px solid rgba(127,127,127,.2);
          border-radius: 20px;
          background: var(--panel, #fff);
          box-shadow: 0 14px 40px rgba(0,0,0,.05);
        }
        .direct-account-intro {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          padding-bottom: 22px;
          margin-bottom: 22px;
          border-bottom: 1px solid rgba(127,127,127,.16);
        }
        .direct-account-kicker {
          margin: 0 0 7px;
          font-size: .7rem;
          font-weight: 800;
          letter-spacing: .14em;
          opacity: .58;
        }
        .direct-account-intro h2 { margin: 0 0 7px; font-size: clamp(1.35rem, 2vw, 1.8rem); }
        .direct-account-intro p { margin: 0; max-width: 700px; line-height: 1.55; opacity: .68; }
        .direct-account-security {
          flex: 0 0 auto;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: .72rem;
          font-weight: 750;
          background: rgba(127,127,127,.1);
        }
        .direct-account-primary-grid,
        .direct-account-advanced-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        label { display: grid; gap: 7px; min-width: 0; }
        label > span { font-size: .8rem; font-weight: 750; }
        label em { font-style: normal; font-weight: 500; opacity: .5; }
        label small { font-size: .72rem; line-height: 1.35; opacity: .55; }
        input, select {
          width: 100%;
          min-height: 46px;
          box-sizing: border-box;
          border: 1px solid rgba(127,127,127,.25);
          border-radius: 11px;
          padding: 0 13px;
          background: var(--input-bg, rgba(127,127,127,.045));
          color: inherit;
          outline: none;
        }
        input:focus, select:focus { border-color: currentColor; box-shadow: 0 0 0 3px rgba(127,127,127,.1); }
        input[aria-invalid="true"] { border-color: #b42318; }
        .direct-password-field { position: relative; }
        .direct-password-field input { padding-right: 64px; }
        .direct-password-field button {
          position: absolute;
          right: 7px;
          top: 50%;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: inherit;
          padding: 8px;
          font-size: .72rem;
          font-weight: 750;
          cursor: pointer;
        }
        .direct-account-advanced-toggle {
          width: 100%;
          margin: 22px 0 0;
          padding: 14px 0;
          border: 0;
          border-top: 1px solid rgba(127,127,127,.14);
          border-bottom: 1px solid rgba(127,127,127,.14);
          background: transparent;
          color: inherit;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
          cursor: pointer;
        }
        .direct-account-advanced-toggle span { display: grid; gap: 2px; }
        .direct-account-advanced-toggle b { font-size: .82rem; }
        .direct-account-advanced-toggle small { opacity: .55; }
        .direct-account-advanced-toggle strong { font-size: 1.25rem; font-weight: 400; }
        .direct-account-advanced-grid {
          padding: 18px 0 2px;
        }
        .direct-account-message {
          margin-top: 18px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: .82rem;
          line-height: 1.45;
        }
        .direct-account-message.success { background: rgba(38, 137, 82, .12); }
        .direct-account-message.error { background: rgba(180, 35, 24, .12); }
        .direct-account-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-top: 22px;
        }
        .direct-account-footer p { margin: 0; max-width: 620px; font-size: .76rem; line-height: 1.5; opacity: .55; }
        .direct-account-footer :global(.primary-button) { flex: 0 0 auto; min-width: 150px; }
        .direct-account-footer :global(.primary-button:disabled) { opacity: .45; cursor: not-allowed; }
        @media (max-width: 760px) {
          .direct-account-card { padding: 19px; border-radius: 16px; }
          .direct-account-intro { display: grid; gap: 12px; }
          .direct-account-security { width: max-content; }
          .direct-account-primary-grid, .direct-account-advanced-grid { grid-template-columns: 1fr; gap: 15px; }
          .direct-account-footer { display: grid; }
          .direct-account-footer :global(.primary-button) { width: 100%; }
        }
      `}</style>
    </section>
  );
}
