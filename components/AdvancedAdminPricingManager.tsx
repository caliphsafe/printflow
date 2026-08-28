"use client";
import { useMemo, useState } from "react";
import type { ShopPricingProfile } from "@/lib/types";

function num(value: string) { return Math.max(0, Number(value || 0)); }

export default function AdvancedAdminPricingManager({ initialPricing }: { initialPricing: ShopPricingProfile }) {
  const [draft, setDraft] = useState(initialPricing);
  const [saved, setSaved] = useState(JSON.stringify(initialPricing));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = useMemo(() => JSON.stringify(draft) !== saved, [draft, saved]);

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/pricing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save pricing.");
      setDraft(data.pricing);
      setSaved(JSON.stringify(data.pricing));
      setMessage("Pricing saved. New customer quotes use these rates.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save pricing.");
    } finally { setBusy(false); }
  }

  const money = (value: number, onChange: (value:number) => void) => <div className="ae-money-wrap"><b>$</b><input type="number" step="0.01" min="0" value={value} onChange={(e) => onChange(num(e.target.value))}/></div>;

  return <div className="ae-pricing-sections">
    <section className="ae-pricing-section">
      <header><p className="ae-kicker">GARMENTS</p><h2>Blank garment pricing</h2><p>PrintFlow starts from SanMar's live supplier cost, then applies this markup.</p></header>
      <div className="ae-field-grid">
        <label className="ae-field"><span>Garment markup %</span><input type="number" min="0" value={draft.garmentMarkupPercent} onChange={(e) => setDraft({...draft, garmentMarkupPercent:num(e.target.value)})}/></label>
        <label className="ae-field"><span>Production setup</span>{money(draft.orderSetupFee.amount, amount => setDraft({...draft,orderSetupFee:{...draft.orderSetupFee,amount}}))}</label>
        <label className="ae-switch" style={{alignSelf:"end",minHeight:40}}><input type="checkbox" checked={draft.orderSetupFee.enabled} onChange={(e)=>setDraft({...draft,orderSetupFee:{...draft.orderSetupFee,enabled:e.target.checked}})}/><span>Production setup {draft.orderSetupFee.enabled ? "ON" : "OFF"}</span></label>
      </div>
    </section>

    <section className="ae-pricing-section">
      <header><p className="ae-kicker">SCREEN PRINTING</p><h2>Screen print pricing</h2><p>Keep the inputs Advanced actually uses day-to-day.</p></header>
      <div className="ae-field-grid">
        <label className="ae-field"><span>Minimum quantity</span><input type="number" min="1" value={draft.screenPrinting.minimumQuantity} onChange={(e)=>setDraft({...draft,screenPrinting:{...draft.screenPrinting,minimumQuantity:Math.max(1,num(e.target.value))}})}/></label>
        <label className="ae-field"><span>Heart / left chest base</span>{money(draft.screenPrinting.heartBasePerItem, heartBasePerItem=>setDraft({...draft,screenPrinting:{...draft.screenPrinting,heartBasePerItem}}))}</label>
        <label className="ae-field"><span>Full size base</span>{money(draft.screenPrinting.fullBasePerItem, fullBasePerItem=>setDraft({...draft,screenPrinting:{...draft.screenPrinting,fullBasePerItem}}))}</label>
        <label className="ae-field"><span>Additional color / item</span>{money(draft.screenPrinting.additionalColorPerItem, additionalColorPerItem=>setDraft({...draft,screenPrinting:{...draft.screenPrinting,additionalColorPerItem}}))}</label>
        <label className="ae-field"><span>Screen setup / color</span>{money(draft.screenPrinting.setupPerScreen, setupPerScreen=>setDraft({...draft,screenPrinting:{...draft.screenPrinting,setupPerScreen}}))}</label>
        <label className="ae-switch" style={{alignSelf:"end",minHeight:40}}><input type="checkbox" checked={draft.screenPrinting.active} onChange={(e)=>setDraft({...draft,screenPrinting:{...draft.screenPrinting,active:e.target.checked}})}/><span>Screen Printing {draft.screenPrinting.active ? "ON" : "OFF"}</span></label>
      </div>
    </section>

    <section className="ae-pricing-section">
      <header><p className="ae-kicker">EMBROIDERY</p><h2>Embroidery pricing</h2><p>Rate per thousand stitches plus digitizing and setup.</p></header>
      <div className="ae-field-grid">
        <label className="ae-field"><span>Minimum quantity</span><input type="number" min="1" value={draft.embroidery.minimumQuantity} onChange={(e)=>setDraft({...draft,embroidery:{...draft.embroidery,minimumQuantity:Math.max(1,num(e.target.value))}})}/></label>
        <label className="ae-field"><span>Rate / 1,000 stitches</span>{money(draft.embroidery.ratePerThousandStitches, ratePerThousandStitches=>setDraft({...draft,embroidery:{...draft.embroidery,ratePerThousandStitches}}))}</label>
        <label className="ae-field"><span>Digitizing fee</span>{money(draft.embroidery.digitizingFee, digitizingFee=>setDraft({...draft,embroidery:{...draft.embroidery,digitizingFee}}))}</label>
        <label className="ae-field"><span>Minimum / location</span>{money(draft.embroidery.minimumPerLocation, minimumPerLocation=>setDraft({...draft,embroidery:{...draft.embroidery,minimumPerLocation}}))}</label>
        <label className="ae-field"><span>Setup / location</span>{money(draft.embroidery.setupPerLocation, setupPerLocation=>setDraft({...draft,embroidery:{...draft.embroidery,setupPerLocation}}))}</label>
        <label className="ae-switch" style={{alignSelf:"end",minHeight:40}}><input type="checkbox" checked={draft.embroidery.active} onChange={(e)=>setDraft({...draft,embroidery:{...draft.embroidery,active:e.target.checked}})}/><span>Embroidery {draft.embroidery.active ? "ON" : "OFF"}</span></label>
      </div>
    </section>

    <section className="ae-pricing-section">
      <header><p className="ae-kicker">DTF</p><h2>Direct-to-film pricing</h2><p>PrintFlow calculates actual artwork area from the designer.</p></header>
      <div className="ae-field-grid">
        <label className="ae-field"><span>Minimum quantity</span><input type="number" min="1" value={draft.dtf.minimumQuantity} onChange={(e)=>setDraft({...draft,dtf:{...draft.dtf,minimumQuantity:Math.max(1,num(e.target.value))}})}/></label>
        <label className="ae-field"><span>Rate / square inch</span>{money(draft.dtf.ratePerSquareInch, ratePerSquareInch=>setDraft({...draft,dtf:{...draft.dtf,ratePerSquareInch}}))}</label>
        <label className="ae-field"><span>Press fee / location</span>{money(draft.dtf.pressFeePerLocation, pressFeePerLocation=>setDraft({...draft,dtf:{...draft.dtf,pressFeePerLocation}}))}</label>
        <label className="ae-field"><span>Minimum / location</span>{money(draft.dtf.minimumPerLocation, minimumPerLocation=>setDraft({...draft,dtf:{...draft.dtf,minimumPerLocation}}))}</label>
        <label className="ae-field"><span>DTF setup</span>{money(draft.dtf.setupFee, setupFee=>setDraft({...draft,dtf:{...draft.dtf,setupFee}}))}</label>
        <label className="ae-switch" style={{alignSelf:"end",minHeight:40}}><input type="checkbox" checked={draft.dtf.active} onChange={(e)=>setDraft({...draft,dtf:{...draft.dtf,active:e.target.checked}})}/><span>DTF {draft.dtf.active ? "ON" : "OFF"}</span></label>
      </div>
    </section>

    <section className="ae-pricing-section">
      <header><p className="ae-kicker">RUSH POLICY</p><h2>Current website rush charges</h2><p>These are enforced by the Advanced order API so customers cannot bypass them.</p></header>
      <div className="ae-stat-grid" style={{margin:0}}>
        <article className="ae-stat"><span>15–10 days</span><strong>$50</strong><small>Rush charge</small></article>
        <article className="ae-stat"><span>Under 10 days</span><strong>$100</strong><small>Rush charge</small></article>
      </div>
    </section>

    <div className="ae-savebar">
      <span>{message || (dirty ? "You have unsaved pricing changes." : "Pricing is up to date.")}</span>
      <button className="ae-button red" disabled={busy || !dirty} onClick={save}>{busy ? "Saving…" : "Save pricing"}</button>
    </div>
  </div>;
}
