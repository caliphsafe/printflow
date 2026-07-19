"use client";

import { useEffect, useMemo, useState } from "react";
import FloatingSaveBar from "@/components/FloatingSaveBar";
import { useUnsavedChanges } from "@/components/useUnsavedChanges";
import type {
  CorePricingFee,
  DtfPricing,
  EmbroideryPricing,
  PricingAddOn,
  QuantityDiscountTier,
  ScreenPrintingPricing,
  ShopPricingProfile
} from "@/lib/types";

const money = (value: number) => Number(Math.max(0, Number(value || 0)).toFixed(2));
const tabs = ["Foundation", "Screen printing", "DTF", "Embroidery", "Add-ons"] as const;
type Tab = (typeof tabs)[number];

export default function PricingSettingsManager({ initialPricing, sampleBlankCost = 0, sampleBlankLabel = "Imported garment" }: { initialPricing: ShopPricingProfile; sampleBlankCost?: number; sampleBlankLabel?: string }) {
  const [draft, setDraft] = useState(initialPricing);
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(initialPricing));
  const [tab, setTab] = useState<Tab>("Foundation");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = useMemo(() => JSON.stringify(draft) !== savedSnapshot, [draft, savedSnapshot]);
  useUnsavedChanges(dirty);
  const activeMethods = [draft.screenPrinting.active, draft.dtf.active, draft.embroidery.active].filter(Boolean).length;
  const exampleCost = Math.max(0, sampleBlankCost);
  const exampleGarment = exampleCost * (1 + draft.garmentMarkupPercent / 100);
  const exampleScreen = draft.screenPrinting.heartBasePerItem;
  const exampleUnit = exampleGarment + exampleScreen;

  function duplicateBreak(method: string, values: QuantityDiscountTier[]) {
    const seen = new Set<number>();
    for (const item of values) {
      const quantity = Math.max(1, Math.round(Number(item.minQuantity || 1)));
      if (seen.has(quantity)) return `${method} has more than one price break starting at ${quantity} items.`;
      seen.add(quantity);
    }
    return "";
  }

  async function save() {
    setMessage("");
    setError("");
    const validation =
      duplicateBreak("Screen printing", draft.screenPrinting.quantityDiscounts) ||
      duplicateBreak("DTF", draft.dtf.quantityDiscounts) ||
      duplicateBreak("Embroidery", draft.embroidery.quantityDiscounts);
    if (validation) {
      setError(`${validation} Change or remove the duplicate row before saving.`);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save pricing.");
      setDraft(data.pricing);
      setSavedSnapshot(JSON.stringify(data.pricing));
      setMessage("Pricing saved. New quotes now use these rates.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save pricing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pricing-v8-shell">
      <section className="pricing-v8-summary">
        <article><span>Garment markup</span><strong>{draft.garmentMarkupPercent}%</strong><small>Applied to live supplier cost</small></article>
        <article><span>Production setup floor</span><strong>${draft.orderSetupFee.amount.toFixed(2)}</strong><small>Method setup can exceed this</small></article>
        <article><span>Live print methods</span><strong>{activeMethods}</strong><small>Available to customers</small></article>
        <article><span>Optional services</span><strong>{draft.addOns.filter((item) => item.active).length}</strong><small>Order or per-item add-ons</small></article>
      </section>

      <section className="admin-card pricing-v8-workspace">
        <nav className="pricing-v8-tabs" aria-label="Pricing sections">
          {tabs.map((item) => <button type="button" key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}
        </nav>

        {tab === "Foundation" && (
          <div className="pricing-v8-panel">
            <PanelHeading eyebrow="PRICING FOUNDATION" title="Build profitable quotes from real cost" description="PrintFlow starts with the exact supplier cost for each selected size, adds your garment markup, then applies the selected production method, quantity break, setup, and services." />
            <div className="pricing-foundation-grid">
              <label className="modern-field"><span>Supplier garment markup</span><div className="field-suffix"><input type="text" inputMode="decimal" value={draft.garmentMarkupPercent} onChange={(event) => setDraft({ ...draft, garmentMarkupPercent: Math.max(0, Number(event.target.value) || 0) })}/><b>%</b></div><small>Default is 10%. The markup is calculated from each imported size and color cost.</small></label>
              <label className="modern-field"><span>Currency</span><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option value="usd">USD — US Dollar</option><option value="cad">CAD — Canadian Dollar</option></select><small>Checkout sessions and customer totals use this currency.</small></label>
            </div>
            <div className="pricing-fee-grid">
              <FeeEditor title="Production setup minimum" value={draft.orderSetupFee} onChange={(value) => setDraft({ ...draft, orderSetupFee: value })}/>
              <FeeEditor title="Design optimization" value={draft.designOptimizationFee} onChange={(value) => setDraft({ ...draft, designOptimizationFee: value })}/>
            </div>
            <div className="pricing-v8-example">
              <div><span>{sampleBlankLabel}</span><b>${exampleCost.toFixed(2)}</b></div><div><span>{draft.garmentMarkupPercent}% garment markup</span><b>${(exampleGarment - exampleCost).toFixed(2)}</b></div><div><span>1-color Heart screen print</span><b>${exampleScreen.toFixed(2)}</b></div><div className="total"><span>Merchandise unit before setup</span><b>${exampleUnit.toFixed(2)}</b></div>
            </div>
          </div>
        )}

        {tab === "Screen printing" && <ScreenPrintingEditor value={draft.screenPrinting} onChange={(screenPrinting) => setDraft({ ...draft, screenPrinting })}/>} 
        {tab === "DTF" && <DtfEditor value={draft.dtf} onChange={(dtf) => setDraft({ ...draft, dtf })}/>} 
        {tab === "Embroidery" && <EmbroideryEditor value={draft.embroidery} onChange={(embroidery) => setDraft({ ...draft, embroidery })}/>} 
        {tab === "Add-ons" && <AddOnEditor values={draft.addOns} onChange={(addOns) => setDraft({ ...draft, addOns })}/>} 
      </section>

      {error && <div className="error-message settings-message">{error}</div>}
      {message && <div className="success-message settings-message">{message}</div>}
      <FloatingSaveBar dirty={dirty} busy={busy} onSave={save} message="Supplier costs stay live while these shop-wide production rates remain under your control." />
    </div>
  );
}

function PanelHeading({ eyebrow, title, description, active, onActive }: { eyebrow: string; title: string; description: string; active?: boolean; onActive?: (active: boolean) => void }) {
  return <header className="pricing-panel-heading"><div><p className="section-kicker">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{onActive && <label className="modern-switch"><input type="checkbox" checked={active} onChange={(event) => onActive(event.target.checked)}/><span/><b>{active ? "Live" : "Off"}</b></label>}</header>;
}

function FeeEditor({ title, value, onChange }: { title: string; value: CorePricingFee; onChange: (value: CorePricingFee) => void }) {
  return <article className={value.enabled ? "pricing-fee-editor active" : "pricing-fee-editor"}><header><div><strong>{title}</strong><small>{value.enabled ? "Included when applicable" : "Disabled"}</small></div><label className="modern-switch compact-switch"><input type="checkbox" checked={value.enabled} onChange={(event) => onChange({ ...value, enabled: event.target.checked })}/><span/><b>{value.enabled ? "On" : "Off"}</b></label></header><label><span>Customer label</span><input value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })}/></label><label><span>Amount</span><MoneyInput value={value.amount} onChange={(amount) => onChange({ ...value, amount })}/></label><label><span>Description</span><textarea rows={3} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })}/></label></article>;
}

function ScreenPrintingEditor({ value, onChange }: { value: ScreenPrintingPricing; onChange: (value: ScreenPrintingPricing) => void }) {
  return <div className="pricing-v8-panel"><PanelHeading eyebrow="SCREEN PRINTING" title="Price by colors, locations, and volume" description="Screen printing uses a base impression price, added ink colors, screen setup, and quantity discounts. Each printed side is calculated independently." active={value.active} onActive={(active) => onChange({ ...value, active })}/><div className="method-grid four"><Field label="Minimum quantity" suffix="items" value={value.minimumQuantity} onChange={(minimumQuantity) => onChange({ ...value, minimumQuantity: Math.max(1, minimumQuantity) })}/><Field label="Maximum ink colors" suffix="colors" value={value.maximumColors} onChange={(maximumColors) => onChange({ ...value, maximumColors: Math.max(1, maximumColors) })}/><MoneyField label="Heart / left-chest base" value={value.heartBasePerItem} onChange={(heartBasePerItem) => onChange({ ...value, heartBasePerItem })}/><MoneyField label="Full-size base" value={value.fullBasePerItem} onChange={(fullBasePerItem) => onChange({ ...value, fullBasePerItem })}/><MoneyField label="Each added color / item" value={value.additionalColorPerItem} onChange={(additionalColorPerItem) => onChange({ ...value, additionalColorPerItem })}/><MoneyField label="Screen setup / color" value={value.setupPerScreen} onChange={(setupPerScreen) => onChange({ ...value, setupPerScreen })}/><Field label="Second-location discount" suffix="%" value={value.additionalLocationDiscountPercent} onChange={(additionalLocationDiscountPercent) => onChange({ ...value, additionalLocationDiscountPercent })}/><label className="method-check"><input type="checkbox" checked={value.countWhiteUnderbase} onChange={(event) => onChange({ ...value, countWhiteUnderbase: event.target.checked })}/><span><b>Count white underbase as a screen</b><small>Recommended for dark garments when a white base adds another production pass.</small></span></label></div><QuantityDiscountEditor values={value.quantityDiscounts} onChange={(quantityDiscounts) => onChange({ ...value, quantityDiscounts })}/><FormulaNote title="Screen print calculation" text="Per side: (size base + added colors) × quantity discount. Setup is based on total screens/colors, with the shop setup minimum applied when higher." /></div>;
}

function DtfEditor({ value, onChange }: { value: DtfPricing; onChange: (value: DtfPricing) => void }) {
  return <div className="pricing-v8-panel"><PanelHeading eyebrow="DIRECT TO FILM" title="Price DTF by actual print area" description="The customer’s resized artwork is translated into physical inches using your print zones. PrintFlow calculates width × height, then adds pressing labor and volume discounts." active={value.active} onActive={(active) => onChange({ ...value, active })}/><div className="method-grid three"><Field label="Minimum quantity" suffix="items" value={value.minimumQuantity} onChange={(minimumQuantity) => onChange({ ...value, minimumQuantity: Math.max(1, minimumQuantity) })}/><MoneyField label="Rate / square inch" value={value.ratePerSquareInch} decimals={3} onChange={(ratePerSquareInch) => onChange({ ...value, ratePerSquareInch })}/><MoneyField label="Press labor / location" value={value.pressFeePerLocation} onChange={(pressFeePerLocation) => onChange({ ...value, pressFeePerLocation })}/><MoneyField label="Minimum / location" value={value.minimumPerLocation} onChange={(minimumPerLocation) => onChange({ ...value, minimumPerLocation })}/><MoneyField label="DTF setup" value={value.setupFee} onChange={(setupFee) => onChange({ ...value, setupFee })}/></div><QuantityDiscountEditor values={value.quantityDiscounts} onChange={(quantityDiscounts) => onChange({ ...value, quantityDiscounts })}/><FormulaNote title="DTF calculation" text="Per side: max(minimum location price, artwork square inches × rate + press labor) × quantity discount." /></div>;
}

function EmbroideryEditor({ value, onChange }: { value: EmbroideryPricing; onChange: (value: EmbroideryPricing) => void }) {
  return <div className="pricing-v8-panel"><PanelHeading eyebrow="EMBROIDERY" title="Price by estimated stitch count and volume" description="Embroidery uses stitch-count estimates for Heart and Full placements, a per-thousand-stitch rate, digitizing, machine setup, and quantity breaks." active={value.active} onActive={(active) => onChange({ ...value, active })}/><div className="method-grid four"><Field label="Minimum quantity" suffix="items" value={value.minimumQuantity} onChange={(minimumQuantity) => onChange({ ...value, minimumQuantity: Math.max(1, minimumQuantity) })}/><MoneyField label="Rate / 1,000 stitches" value={value.ratePerThousandStitches} onChange={(ratePerThousandStitches) => onChange({ ...value, ratePerThousandStitches })}/><MoneyField label="Minimum / location" value={value.minimumPerLocation} onChange={(minimumPerLocation) => onChange({ ...value, minimumPerLocation })}/><MoneyField label="Setup / location" value={value.setupPerLocation} onChange={(setupPerLocation) => onChange({ ...value, setupPerLocation })}/><MoneyField label="Digitizing fee" value={value.digitizingFee} onChange={(digitizingFee) => onChange({ ...value, digitizingFee })}/><Field label="Heart estimated stitches" suffix="stitches" value={value.heartEstimatedStitches} onChange={(heartEstimatedStitches) => onChange({ ...value, heartEstimatedStitches: Math.max(1000, heartEstimatedStitches) })}/><Field label="Full estimated stitches" suffix="stitches" value={value.fullEstimatedStitches} onChange={(fullEstimatedStitches) => onChange({ ...value, fullEstimatedStitches: Math.max(1000, fullEstimatedStitches) })}/></div><QuantityDiscountEditor values={value.quantityDiscounts} onChange={(quantityDiscounts) => onChange({ ...value, quantityDiscounts })}/><FormulaNote title="Embroidery calculation" text="Per side: max(minimum location price, estimated stitches ÷ 1,000 × rate) × quantity discount. Digitizing and location setup are added once per order." /></div>;
}

function QuantityDiscountEditor({ values, onChange }: { values: QuantityDiscountTier[]; onChange: (values: QuantityDiscountTier[]) => void }) {
  const rows = values.length ? values : [{ id: "tier-base", minQuantity: 12, discountPercent: 0 }];

  function update(id: string, next: Partial<QuantityDiscountTier>) {
    onChange(rows.map((item) => item.id === id ? { ...item, ...next } : item));
  }

  function add() {
    const last = rows[rows.length - 1];
    const nextMinimum = Math.max(12, Number(last?.minQuantity || 12) * 2);
    onChange([...rows, { id: `tier-${crypto.randomUUID()}`, minQuantity: nextMinimum, discountPercent: Number(last?.discountPercent || 0) }]);
  }

  function remove(id: string) {
    if (rows.length <= 1) return;
    onChange(rows.filter((item) => item.id !== id));
  }

  function normalizeOrder() {
    onChange(rows
      .map((item) => ({ ...item, minQuantity: Math.max(1, Math.round(item.minQuantity || 1)) }))
      .sort((a, b) => a.minQuantity - b.minQuantity));
  }

  return <section className="quantity-break-editor stable"><div className="quantity-break-heading"><div><h3>Quantity price breaks</h3><p>Add each starting quantity and the production discount that begins there.</p></div><button type="button" className="secondary-button compact" onClick={add}>Add price break</button></div><div className="quantity-break-list">{rows.map((item, index) => { const next = rows[index + 1]; return <article key={item.id} className="quantity-break-row"><div className="quantity-range"><span>Range</span><strong>{item.minQuantity}–{next ? Math.max(item.minQuantity, next.minQuantity - 1) : "and up"}</strong></div><label><span>Starts at</span><div className="field-suffix"><input type="text" inputMode="numeric" value={item.minQuantity} onChange={(event) => update(item.id, { minQuantity: Math.max(1, Number(event.target.value.replace(/\D/g, "")) || 1) })} onBlur={normalizeOrder}/><b>items</b></div></label><label><span>Production discount</span><div className="field-suffix"><input type="text" inputMode="decimal" value={item.discountPercent} onChange={(event) => update(item.id, { discountPercent: Math.min(95, Math.max(0, Number(event.target.value.replace(/[^0-9.]/g, "")) || 0)) })}/><b>%</b></div></label><button type="button" className="quantity-delete" aria-label={`Delete price break starting at ${item.minQuantity}`} disabled={rows.length === 1} onClick={() => remove(item.id)}>Delete</button></article>; })}</div></section>;
}

function AddOnEditor({ values, onChange }: { values: PricingAddOn[]; onChange: (values: PricingAddOn[]) => void }) {
  function update(index: number, next: Partial<PricingAddOn>) { onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item)); }
  return <div className="pricing-v8-panel"><PanelHeading eyebrow="OPTIONAL SERVICES" title="Add future charges without rebuilding pricing" description="Create rush service, folding, bagging, labels, specialty ink, delivery, or any other order-level or per-garment service."/><div className="addon-editor-list v8">{values.map((item, index) => <article className="addon-editor-card" key={item.id}><header><div><strong>{item.name || "Untitled add-on"}</strong><small>{item.pricingMode === "per_item" ? "Per garment" : "Per order"}</small></div><label className="modern-switch compact-switch"><input type="checkbox" checked={item.active} onChange={(event) => update(index, { active: event.target.checked })}/><span/><b>{item.active ? "Live" : "Off"}</b></label></header><div className="addon-fields"><label><span>Name</span><input value={item.name} onChange={(event) => update(index, { name: event.target.value })}/></label><label><span>Price</span><MoneyInput value={item.amount} onChange={(amount) => update(index, { amount })}/></label><label><span>Charge</span><select value={item.pricingMode} onChange={(event) => update(index, { pricingMode: event.target.value === "per_item" ? "per_item" : "order" })}><option value="order">Once per order</option><option value="per_item">Per garment</option></select></label><label className="wide"><span>Description</span><input value={item.description} onChange={(event) => update(index, { description: event.target.value })}/></label></div><footer><label><input type="checkbox" checked={item.customerSelectable} onChange={(event) => update(index, { customerSelectable: event.target.checked })}/> Customer can select</label><label><input type="checkbox" checked={item.selectedByDefault} onChange={(event) => update(index, { selectedByDefault: event.target.checked })}/> Selected by default</label><button type="button" className="text-button danger-text" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></footer></article>)}<button type="button" className="add-outline-button" onClick={() => onChange([...values, { id: `add-on-${Date.now()}`, name: "New service", description: "", amount: 0, pricingMode: "order", active: true, customerSelectable: true, selectedByDefault: false }])}>+ Add service</button></div></div>;
}

function FormulaNote({ title, text }: { title: string; text: string }) { return <div className="formula-note"><span>ƒ</span><div><strong>{title}</strong><p>{text}</p></div></div>; }
function Field({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void }) { return <label className="modern-field"><span>{label}</span><div className="field-suffix"><input type="text" inputMode="decimal" value={value} onChange={(event) => onChange(Number(event.target.value.replace(/[^0-9.]/g, "")) || 0)}/><b>{suffix}</b></div></label>; }
function MoneyField({ label, value, decimals = 2, onChange }: { label: string; value: number; decimals?: number; onChange: (value: number) => void }) { return <label className="modern-field"><span>{label}</span><MoneyInput value={value} decimals={decimals} onChange={onChange}/></label>; }
function MoneyInput({ value, decimals = 2, onChange }: { value: number; decimals?: number; onChange: (value: number) => void }) { const [text, setText] = useState(Number(value || 0).toFixed(decimals)); useEffect(() => setText(Number(value || 0).toFixed(decimals)), [value, decimals]); return <div className="money-input"><span>$</span><input type="text" inputMode="decimal" value={text} onChange={(event) => setText(event.target.value.replace(/[^0-9.]/g, ""))} onBlur={() => { const next = money(Number(text)); setText(next.toFixed(decimals)); onChange(next); }}/></div>; }
