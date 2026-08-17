"use client";

import { useMemo, useState } from "react";
import type {
  DtfPricing,
  EmbroideryPricing,
  QuantityDiscountTier,
  ScreenPrintingPricing,
  ShopPricingProfile
} from "@/lib/types";

const tabs = ["Foundation", "Screen Print", "DTF", "Embroidery"] as const;
type Tab = (typeof tabs)[number];

function money(value: number) {
  return Math.max(0, Number(value || 0));
}

export default function BrandPricingManager({
  initialPricing,
  sampleCost,
  sampleLabel
}: {
  initialPricing: ShopPricingProfile;
  sampleCost: number;
  sampleLabel: string;
}) {
  const [draft, setDraft] = useState(initialPricing);
  const [saved, setSaved] = useState(JSON.stringify(initialPricing));
  const [tab, setTab] = useState<Tab>("Foundation");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const dirty = JSON.stringify(draft) !== saved;
  const preview = useMemo(() => {
    const blank = money(sampleCost);
    const garment = blank * (1 + draft.garmentMarkupPercent / 100);
    const print = draft.screenPrinting.active ? draft.screenPrinting.fullBasePerItem : 0;
    return { blank, garment, print, unit: garment + print };
  }, [draft, sampleCost]);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/brand-commerce/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Brand pricing.");
      setDraft(data.pricing);
      setSaved(JSON.stringify(data.pricing));
      setMessage("Brand pricing saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save Brand pricing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-pricing-shell">
      <section className="pricing-summary">
        <article><span>Brand garment markup</span><strong>{draft.garmentMarkupPercent}%</strong><small>Separate from Print Shop</small></article>
        <article><span>Brand setup</span><strong>${draft.orderSetupFee.amount.toFixed(2)}</strong><small>Applied to Brand orders</small></article>
        <article><span>Screen Print</span><strong>{draft.screenPrinting.active ? "On" : "Off"}</strong><small>Brand pricing only</small></article>
        <article><span>DTF / Embroidery</span><strong>{[draft.dtf.active, draft.embroidery.active].filter(Boolean).length}/2</strong><small>Brand methods enabled</small></article>
      </section>

      <section className="admin-card brand-pricing-workspace">
        <nav>
          {tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}
        </nav>

        {tab === "Foundation" && (
          <div className="pricing-panel">
            <Heading title="Brand pricing foundation" text="This profile is used only for Brand / Merch orders. Print Shop pricing remains completely separate." />
            <div className="pricing-grid two">
              <Field label="Brand garment markup" suffix="%" value={draft.garmentMarkupPercent} onChange={(garmentMarkupPercent) => setDraft({ ...draft, garmentMarkupPercent })} />
              <label className="field"><span>Currency</span><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option value="usd">USD</option><option value="cad">CAD</option></select></label>
              <Field label="Brand order setup" prefix="$" value={draft.orderSetupFee.amount} onChange={(amount) => setDraft({ ...draft, orderSetupFee: { ...draft.orderSetupFee, amount } })} />
              <label className="check"><input type="checkbox" checked={draft.orderSetupFee.enabled} onChange={(event) => setDraft({ ...draft, orderSetupFee: { ...draft.orderSetupFee, enabled: event.target.checked } })} /><span>Charge Brand order setup</span></label>
            </div>

            <div className="price-example">
              <div><span>{sampleLabel}</span><b>${preview.blank.toFixed(2)}</b></div>
              <div><span>{draft.garmentMarkupPercent}% Brand garment markup</span><b>${(preview.garment - preview.blank).toFixed(2)}</b></div>
              <div><span>Example Full Size Screen Print</span><b>${preview.print.toFixed(2)}</b></div>
              <div className="total"><span>Example Brand unit</span><b>${preview.unit.toFixed(2)}</b></div>
            </div>
          </div>
        )}

        {tab === "Screen Print" && <ScreenEditor value={draft.screenPrinting} onChange={(screenPrinting) => setDraft({ ...draft, screenPrinting })} />}
        {tab === "DTF" && <DtfEditor value={draft.dtf} onChange={(dtf) => setDraft({ ...draft, dtf })} />}
        {tab === "Embroidery" && <EmbroideryEditor value={draft.embroidery} onChange={(embroidery) => setDraft({ ...draft, embroidery })} />}
      </section>

      {message && <div className={message.includes("saved") ? "success-message" : "error-message"}>{message}</div>}

      {dirty && (
        <div className="brand-pricing-save">
          <div><strong>Unsaved Brand pricing</strong><small>Print Shop rates are unaffected.</small></div>
          <button className="primary-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Brand pricing"}</button>
        </div>
      )}

      <style jsx global>{`
        .brand-pricing-shell{display:grid;gap:14px}.pricing-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.pricing-summary article{padding:13px;border:1px solid #e1e1dc;border-radius:11px;background:#fff}.pricing-summary span{display:block;font-size:8px;color:#777;text-transform:uppercase;letter-spacing:.07em}.pricing-summary strong{display:block;margin:4px 0 2px;font-size:18px}.pricing-summary small{font-size:8px;color:#777}
        .brand-pricing-workspace{overflow:hidden}.brand-pricing-workspace>nav{display:flex;gap:3px;padding:8px;border-bottom:1px solid #eee;background:#fafaf7}.brand-pricing-workspace>nav button{padding:8px 10px;border:0;border-radius:8px;background:transparent;font-size:9px}.brand-pricing-workspace>nav button.active{background:#171717;color:#fff}.pricing-panel{padding:20px}.pricing-grid{display:grid;gap:9px;margin-top:16px}.pricing-grid.two{grid-template-columns:1fr 1fr}.pricing-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.pricing-grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.field{display:grid;gap:5px}.field>span{font-size:8px;font-weight:800;color:#666}.field input,.field select{width:100%;box-sizing:border-box}.field-box{display:grid;grid-template-columns:28px minmax(0,1fr) 32px}.field-box i,.field-box b{display:grid;place-items:center;background:#eee;font-size:8px;font-style:normal}.field-box i{border-radius:8px 0 0 8px}.field-box b{border-radius:0 8px 8px 0}.check{display:flex;align-items:center;gap:6px;padding:10px;border-radius:9px;background:#f5f5f1;font-size:9px}
        .price-example{display:grid;gap:0;margin-top:16px;border:1px solid #e1e1dc;border-radius:10px;overflow:hidden}.price-example>div{display:flex;justify-content:space-between;gap:12px;padding:9px 11px;border-bottom:1px solid #eee;font-size:9px}.price-example>div:last-child{border-bottom:0}.price-example .total{background:#171717;color:#fff}
        .brand-pricing-save{position:sticky;bottom:14px;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-left:auto;width:min(560px,100%);padding:10px 12px;border:1px solid #d5d5cf;border-radius:12px;background:rgba(255,255,255,.96);box-shadow:0 14px 35px rgba(0,0,0,.12)}.brand-pricing-save strong{display:block;font-size:10px}.brand-pricing-save small{display:block;color:#777;font-size:8px}
        @media(max-width:850px){.pricing-summary{grid-template-columns:repeat(2,1fr)}.pricing-grid.three,.pricing-grid.four{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.pricing-summary,.pricing-grid.two,.pricing-grid.three,.pricing-grid.four{grid-template-columns:1fr}.brand-pricing-workspace>nav{overflow:auto}.brand-pricing-save{bottom:7px;display:grid;width:100%;box-sizing:border-box}}
      `}</style>
    </div>
  );
}

function Heading({ title, text, active, onActive }: { title: string; text: string; active?: boolean; onActive?: (value: boolean) => void }) {
  return <header className="pricing-heading"><div><h2>{title}</h2><p>{text}</p></div>{onActive && <label className="modern-switch"><input type="checkbox" checked={active} onChange={(event) => onActive(event.target.checked)} /><span /><b>{active ? "On" : "Off"}</b></label>}<style jsx>{`.pricing-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.pricing-heading h2{margin:0 0 4px}.pricing-heading p{margin:0;color:#777;max-width:680px;font-size:9px}`}</style></header>;
}

function Field({ label, value, onChange, prefix, suffix }: { label: string; value: number; onChange: (value: number) => void; prefix?: string; suffix?: string }) {
  return <label className="field"><span>{label}</span><div className="field-box">{prefix && <i>{prefix}</i>}<input type="number" min="0" step=".01" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} />{suffix && <b>{suffix}</b>}</div></label>;
}

function ScreenEditor({ value, onChange }: { value: ScreenPrintingPricing; onChange: (value: ScreenPrintingPricing) => void }) {
  return <div className="pricing-panel"><Heading title="Brand Screen Print pricing" text="Brand-only screen rates, setup and quantity discounts." active={value.active} onActive={(active) => onChange({ ...value, active })} /><div className="pricing-grid four"><Field label="Minimum quantity" value={value.minimumQuantity} onChange={(minimumQuantity) => onChange({ ...value, minimumQuantity: Math.max(1, minimumQuantity) })} /><Field label="Maximum ink colors" value={value.maximumColors} onChange={(maximumColors) => onChange({ ...value, maximumColors: Math.max(1, maximumColors) })} /><Field label="Heart Size / item" prefix="$" value={value.heartBasePerItem} onChange={(heartBasePerItem) => onChange({ ...value, heartBasePerItem })} /><Field label="Full Size / item" prefix="$" value={value.fullBasePerItem} onChange={(fullBasePerItem) => onChange({ ...value, fullBasePerItem })} /><Field label="Additional color / item" prefix="$" value={value.additionalColorPerItem} onChange={(additionalColorPerItem) => onChange({ ...value, additionalColorPerItem })} /><Field label="Screen setup / color" prefix="$" value={value.setupPerScreen} onChange={(setupPerScreen) => onChange({ ...value, setupPerScreen })} /></div><Discounts values={value.quantityDiscounts} onChange={(quantityDiscounts) => onChange({ ...value, quantityDiscounts })} /></div>;
}

function DtfEditor({ value, onChange }: { value: DtfPricing; onChange: (value: DtfPricing) => void }) {
  return <div className="pricing-panel"><Heading title="Brand DTF pricing" text="Brand-only DTF pricing by physical print area." active={value.active} onActive={(active) => onChange({ ...value, active })} /><div className="pricing-grid three"><Field label="Minimum quantity" value={value.minimumQuantity} onChange={(minimumQuantity) => onChange({ ...value, minimumQuantity: Math.max(1, minimumQuantity) })} /><Field label="Rate / sq. inch" prefix="$" value={value.ratePerSquareInch} onChange={(ratePerSquareInch) => onChange({ ...value, ratePerSquareInch })} /><Field label="Press / location" prefix="$" value={value.pressFeePerLocation} onChange={(pressFeePerLocation) => onChange({ ...value, pressFeePerLocation })} /><Field label="Minimum / location" prefix="$" value={value.minimumPerLocation} onChange={(minimumPerLocation) => onChange({ ...value, minimumPerLocation })} /><Field label="Brand DTF setup" prefix="$" value={value.setupFee} onChange={(setupFee) => onChange({ ...value, setupFee })} /></div><Discounts values={value.quantityDiscounts} onChange={(quantityDiscounts) => onChange({ ...value, quantityDiscounts })} /></div>;
}

function EmbroideryEditor({ value, onChange }: { value: EmbroideryPricing; onChange: (value: EmbroideryPricing) => void }) {
  return <div className="pricing-panel"><Heading title="Brand Embroidery pricing" text="Brand-only stitch pricing, digitizing and setup." active={value.active} onActive={(active) => onChange({ ...value, active })} /><div className="pricing-grid four"><Field label="Minimum quantity" value={value.minimumQuantity} onChange={(minimumQuantity) => onChange({ ...value, minimumQuantity: Math.max(1, minimumQuantity) })} /><Field label="Rate / 1,000 stitches" prefix="$" value={value.ratePerThousandStitches} onChange={(ratePerThousandStitches) => onChange({ ...value, ratePerThousandStitches })} /><Field label="Minimum / location" prefix="$" value={value.minimumPerLocation} onChange={(minimumPerLocation) => onChange({ ...value, minimumPerLocation })} /><Field label="Setup / location" prefix="$" value={value.setupPerLocation} onChange={(setupPerLocation) => onChange({ ...value, setupPerLocation })} /><Field label="Digitizing" prefix="$" value={value.digitizingFee} onChange={(digitizingFee) => onChange({ ...value, digitizingFee })} /><Field label="Heart stitches" value={value.heartEstimatedStitches} onChange={(heartEstimatedStitches) => onChange({ ...value, heartEstimatedStitches })} /><Field label="Full stitches" value={value.fullEstimatedStitches} onChange={(fullEstimatedStitches) => onChange({ ...value, fullEstimatedStitches })} /></div><Discounts values={value.quantityDiscounts} onChange={(quantityDiscounts) => onChange({ ...value, quantityDiscounts })} /></div>;
}

function Discounts({ values, onChange }: { values: QuantityDiscountTier[]; onChange: (values: QuantityDiscountTier[]) => void }) {
  function update(index: number, patch: Partial<QuantityDiscountTier>) {
    onChange(values.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }
  return <section className="discounts"><header><div><h3>Brand quantity discounts</h3><p>Volume discounts used only on Brand / Merch orders.</p></div><button className="secondary-button compact" onClick={() => onChange([...values, { id: `brand-tier-${Date.now()}`, minQuantity: (values.at(-1)?.minQuantity || 12) * 2, discountPercent: 0 }])}>Add break</button></header><div>{values.map((item, index) => <article key={item.id}><Field label="Starts at" value={item.minQuantity} onChange={(minQuantity) => update(index, { minQuantity: Math.max(1, Math.round(minQuantity)) })} /><Field label="Discount" suffix="%" value={item.discountPercent} onChange={(discountPercent) => update(index, { discountPercent })} />{values.length > 1 && <button className="danger-button compact" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</article>)}</div><style jsx>{`.discounts{margin-top:18px;padding-top:16px;border-top:1px solid #eee}.discounts>header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.discounts h3{margin:0 0 3px;font-size:12px}.discounts p{margin:0;color:#777;font-size:8px}.discounts>div{display:grid;gap:6px;margin-top:10px}.discounts article{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;padding:8px;border-radius:9px;background:#f7f7f3}@media(max-width:600px){.discounts article{grid-template-columns:1fr}}`}</style></section>;
}
