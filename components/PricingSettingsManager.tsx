"use client";

import { useMemo, useState } from "react";
import type { DecorationPricingRule, PricingAddOn, ShopPricingProfile } from "@/lib/types";

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const money = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const slug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now()}`;

export default function PricingSettingsManager({ initialPricing }: { initialPricing: ShopPricingProfile }) {
  const [draft, setDraft] = useState(copy(initialPricing));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeServices = useMemo(() => draft.decorationServices.filter((item) => item.active).length, [draft.decorationServices]);
  const activeAddOns = useMemo(() => draft.addOns.filter((item) => item.active).length, [draft.addOns]);

  function patchFee(key: "setupFee" | "designOptimizationFee", values: Partial<ShopPricingProfile["setupFee"]>) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], ...values } }));
  }

  function updateService(index: number, values: Partial<DecorationPricingRule>) {
    setDraft((current) => ({
      ...current,
      decorationServices: current.decorationServices.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item)
    }));
  }

  function updateAddOn(index: number, values: Partial<PricingAddOn>) {
    setDraft((current) => ({
      ...current,
      addOns: current.addOns.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item)
    }));
  }

  async function save() {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/admin/pricing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save pricing settings.");
      setDraft(data.pricing);
      setMessage("Global pricing rules are live across the customer designer.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save pricing settings.");
    } finally { setBusy(false); }
  }

  return <div className="pricing-settings-shell">
    <section className="pricing-overview-grid">
      <article className="admin-card pricing-overview-card"><span>Order setup</span><strong>${draft.setupFee.amount.toFixed(2)}</strong><small>{draft.setupFee.enabled ? "Included by default" : "Disabled globally"}</small></article>
      <article className="admin-card pricing-overview-card"><span>Design optimization</span><strong>${draft.designOptimizationFee.amount.toFixed(2)}</strong><small>{draft.designOptimizationFee.enabled ? "Optional customer service" : "Disabled globally"}</small></article>
      <article className="admin-card pricing-overview-card"><span>Decoration services</span><strong>{activeServices}</strong><small>Active percentage rules</small></article>
      <article className="admin-card pricing-overview-card"><span>Customer add-ons</span><strong>{activeAddOns}</strong><small>Available extras</small></article>
    </section>

    <div className="pricing-settings-grid">
      <div className="pricing-settings-main">
        <section className="admin-card pricing-settings-card">
          <div className="card-heading"><div><p className="section-kicker">CORE ORDER FEES</p><h2>Setup and design services</h2><p>These order-level charges become the default for every product. Products can inherit, override, or disable them.</p></div></div>
          <div className="core-fee-grid">
            <CoreFeeCard title="Production setup" value={draft.setupFee} onChange={(values) => patchFee("setupFee", values)} />
            <CoreFeeCard title="Design optimization" value={draft.designOptimizationFee} onChange={(values) => patchFee("designOptimizationFee", values)} />
          </div>
        </section>

        <section className="admin-card pricing-settings-card">
          <div className="card-heading"><div><p className="section-kicker">DECORATION MULTIPLIERS</p><h2>Printing service adjustments</h2><p>Percentage adjustments apply to the Heart and Full print components only. Blank garment cost stays unchanged.</p></div><button className="secondary-button compact" type="button" onClick={() => setDraft((current) => ({ ...current, decorationServices: [...current.decorationServices, { id: `service-${Date.now()}`, name: "New service", percentageAdjustment: 0, active: true }] }))}>Add service</button></div>
          <div className="decoration-rule-list">
            {draft.decorationServices.map((item, index) => <article className="decoration-rule-row" key={`${item.id}-${index}`}>
              <label className="modern-switch compact-switch"><input type="checkbox" checked={item.active} onChange={(event) => updateService(index, { active: event.target.checked })}/><span/><b>{item.active ? "Active" : "Off"}</b></label>
              <label><span>Service name</span><input value={item.name} onChange={(event) => updateService(index, { name: event.target.value, id: slug(event.target.value) })}/></label>
              <label><span>Print price adjustment</span><div className="input-suffix"><input type="text" inputMode="decimal" value={item.percentageAdjustment} onChange={(event) => updateService(index, { percentageAdjustment: Number(event.target.value) || 0 })}/><span>%</span></div></label>
              <button className="icon-delete-button" aria-label={`Remove ${item.name}`} onClick={() => setDraft((current) => ({ ...current, decorationServices: current.decorationServices.filter((_, itemIndex) => itemIndex !== index) }))}>×</button>
            </article>)}
          </div>
        </section>

        <section className="admin-card pricing-settings-card">
          <div className="card-heading"><div><p className="section-kicker">FUTURE-READY ADD-ONS</p><h2>Optional services and extras</h2><p>Add order-level or per-item services. Customer-selectable extras appear during checkout configuration.</p></div><button className="secondary-button compact" type="button" onClick={() => setDraft((current) => ({ ...current, addOns: [...current.addOns, { id: `add-on-${Date.now()}`, name: "New add-on", description: "", amount: 0, pricingMode: "order", active: true, customerSelectable: true, selectedByDefault: false }] }))}>Add add-on</button></div>
          <div className="addon-editor-list">
            {draft.addOns.length ? draft.addOns.map((item, index) => <article className="addon-editor-card" key={`${item.id}-${index}`}>
              <header><div><strong>{item.name || "Untitled add-on"}</strong><small>{item.pricingMode === "per_item" ? "Per garment" : "Per order"}</small></div><label className="modern-switch compact-switch"><input type="checkbox" checked={item.active} onChange={(event) => updateAddOn(index, { active: event.target.checked })}/><span/><b>{item.active ? "Active" : "Off"}</b></label></header>
              <div className="addon-fields">
                <label><span>Name</span><input value={item.name} onChange={(event) => updateAddOn(index, { name: event.target.value, id: slug(event.target.value) })}/></label>
                <label><span>Price</span><div className="money-input"><span>$</span><input type="text" inputMode="decimal" value={item.amount} onChange={(event) => updateAddOn(index, { amount: money(Number(event.target.value)) })}/></div></label>
                <label><span>Pricing mode</span><select value={item.pricingMode} onChange={(event) => updateAddOn(index, { pricingMode: event.target.value === "per_item" ? "per_item" : "order" })}><option value="order">One charge per order</option><option value="per_item">Charge per garment</option></select></label>
                <label className="wide"><span>Description</span><input value={item.description} onChange={(event) => updateAddOn(index, { description: event.target.value })}/></label>
              </div>
              <footer><label><input type="checkbox" checked={item.customerSelectable} onChange={(event) => updateAddOn(index, { customerSelectable: event.target.checked })}/> Customer can select this</label><label><input type="checkbox" checked={item.selectedByDefault} onChange={(event) => updateAddOn(index, { selectedByDefault: event.target.checked })}/> Selected by default</label><button className="text-button danger-text" onClick={() => setDraft((current) => ({ ...current, addOns: current.addOns.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button></footer>
            </article>) : <div className="pricing-empty-state"><span>＋</span><h3>No add-ons yet</h3><p>Add rush production, specialty packaging, delivery, folding, tagging, or any future service.</p></div>}
          </div>
        </section>
      </div>

      <aside className="pricing-settings-side">
        <section className="admin-card pricing-logic-card"><p className="section-kicker">PRICING ORDER</p><h2>How totals are built</h2><ol><li><span>1</span><div><strong>Garment + printed sides</strong><small>Uses the product quantity tier.</small></div></li><li><span>2</span><div><strong>Decoration adjustment</strong><small>Applies only to print components.</small></div></li><li><span>3</span><div><strong>Order setup</strong><small>Included once per order.</small></div></li><li><span>4</span><div><strong>Design optimization</strong><small>Added only when requested.</small></div></li><li><span>5</span><div><strong>Add-ons</strong><small>Order or per-item extras.</small></div></li></ol></section>
        <section className="admin-card pricing-example-card"><p className="section-kicker">EXAMPLE</p><h2>$3 blank + $3 Heart + $5 Full</h2><div><span>Unit merchandise</span><b>$11.00</b></div><div><span>12 garments</span><b>$132.00</b></div><div><span>{draft.setupFee.label}</span><b>${draft.setupFee.enabled ? draft.setupFee.amount.toFixed(2) : "0.00"}</b></div><div className="total"><span>Order before extras</span><b>${(132 + (draft.setupFee.enabled ? draft.setupFee.amount : 0)).toFixed(2)}</b></div></section>
      </aside>
    </div>

    {error && <div className="error-message settings-message">{error}</div>}
    {message && <div className="success-message settings-message">{message}</div>}
    <div className="pricing-save-bar"><div><strong>Global pricing changes affect every active product.</strong><span>Product-level overrides remain intact.</span></div><button className="primary-button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save global pricing"}</button></div>
  </div>;
}

function CoreFeeCard({ title, value, onChange }: { title: string; value: ShopPricingProfile["setupFee"]; onChange: (values: Partial<ShopPricingProfile["setupFee"]>) => void }) {
  return <article className={value.enabled ? "core-fee-card enabled" : "core-fee-card"}>
    <header><div><strong>{title}</strong><small>{value.enabled ? "Included in customer pricing" : "Disabled globally"}</small></div><label className="modern-switch"><input type="checkbox" checked={value.enabled} onChange={(event) => onChange({ enabled: event.target.checked })}/><span/><b>{value.enabled ? "On" : "Off"}</b></label></header>
    <label><span>Customer-facing label</span><input value={value.label} onChange={(event) => onChange({ label: event.target.value })}/></label>
    <label><span>Default amount</span><div className="money-input"><span>$</span><input type="text" inputMode="decimal" value={value.amount} onChange={(event) => onChange({ amount: money(Number(event.target.value)) })}/></div></label>
    <label><span>Description</span><textarea rows={3} value={value.description} onChange={(event) => onChange({ description: event.target.value })}/></label>
  </article>;
}
