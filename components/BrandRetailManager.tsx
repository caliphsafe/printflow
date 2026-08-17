"use client";

import { useMemo, useState } from "react";
import {
  calculateBrandEconomics,
  recommendedRetailPrice,
  type BrandRetailProfile
} from "@/lib/brand-retail";
import type { BrandLockedPlacement } from "@/lib/brand-types";

const samplePlacement: BrandLockedPlacement = {
  enabled: true,
  side: "front",
  printSize: "full",
  decorationMethod: "Screen Print",
  widthInches: 11,
  heightInches: 14,
  surcharge: 0,
  placement: { x: 250, y: 220, width: 300, height: 360, rotation: 0 }
};

export default function BrandRetailManager({
  initial,
  sampleGarmentCost,
  sampleGarmentName
}: {
  initial: BrandRetailProfile;
  sampleGarmentCost: number;
  sampleGarmentName: string;
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = useMemo(() => JSON.stringify(draft) !== saved, [draft, saved]);

  const sampleFixed = Math.max(0, sampleGarmentCost) +
    draft.screenPrint.basePerItem +
    draft.packagingCostPerItem +
    draft.fulfillmentCostPerItem;

  const sampleRetail = recommendedRetailPrice({
    fixedUnitCost: sampleFixed,
    targetMarginPercent: draft.defaultTargetMarginPercent,
    paymentReservePercent: draft.paymentReservePercent,
    ending: draft.priceEnding
  });

  const sampleEconomics = calculateBrandEconomics({
    profile: draft,
    supplierCost: sampleGarmentCost,
    placement: samplePlacement,
    retailPrice: sampleRetail,
    inkColors: 1
  });

  function patch(next: Partial<BrandRetailProfile>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/brand-retail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Retail Economics.");

      setDraft(data.profile);
      setSaved(JSON.stringify(data.profile));
      setMessage("Retail Economics saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save Retail Economics.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="retail-economics-layout">
      <div className="retail-sections">
        <section className="admin-card retail-section">
          <SectionHeading number="1" kicker="RETAIL STRATEGY" title="How you want to sell" text="Set the margin target PrintFlow uses when recommending prices for new Brand products." />
          <div className="retail-form-grid">
            <NumberField label="Default target margin" value={draft.defaultTargetMarginPercent} suffix="%" onChange={(value) => patch({ defaultTargetMarginPercent: value })} />
            <label>
              <span>Recommended price ending</span>
              <select value={draft.priceEnding} onChange={(event) => patch({ priceEnding: event.target.value as BrandRetailProfile["priceEnding"] })}>
                <option value="whole">$32.00 · whole dollar</option>
                <option value="99">$31.99 · .99</option>
                <option value="95">$31.95 · .95</option>
              </select>
            </label>
            <label>
              <span>Currency</span>
              <input value={draft.currency} maxLength={3} onChange={(event) => patch({ currency: event.target.value.toUpperCase() })} />
            </label>
          </div>
        </section>

        <section className="admin-card retail-section">
          <SectionHeading number="2" kicker="SELLING COSTS" title="Costs around every sale" text="These are Brand retail costs, not Print Shop setup charges." />
          <div className="retail-form-grid">
            <NumberField label="Packaging / item" value={draft.packagingCostPerItem} prefix="$" onChange={(value) => patch({ packagingCostPerItem: value })} />
            <NumberField label="Fulfillment handling / item" value={draft.fulfillmentCostPerItem} prefix="$" onChange={(value) => patch({ fulfillmentCostPerItem: value })} />
            <NumberField label="Payment reserve" value={draft.paymentReservePercent} suffix="%" onChange={(value) => patch({ paymentReservePercent: value })} />
          </div>
        </section>

        <section className="admin-card retail-section">
          <SectionHeading number="3" kicker="PRODUCTION COST MODEL" title="What it costs you to decorate a piece" text="These values estimate COGS for Brand products. They are not customer-facing print rates." />

          <div className="cost-method-grid">
            <article>
              <div><span>SCREEN PRINT</span><h3>Per-piece cost</h3><p>Estimate the production cost of an approved screen-printed Brand product.</p></div>
              <NumberField label="1-color base / item" value={draft.screenPrint.basePerItem} prefix="$" onChange={(value) => patch({ screenPrint: { ...draft.screenPrint, basePerItem: value } })} />
              <NumberField label="Each extra color / item" value={draft.screenPrint.extraColorPerItem} prefix="$" onChange={(value) => patch({ screenPrint: { ...draft.screenPrint, extraColorPerItem: value } })} />
            </article>

            <article>
              <div><span>DTF</span><h3>Area + press cost</h3><p>Estimate DTF using the locked physical artwork size.</p></div>
              <NumberField label="Transfer / sq. in." value={draft.dtf.ratePerSquareInch} prefix="$" step=".001" onChange={(value) => patch({ dtf: { ...draft.dtf, ratePerSquareInch: value } })} />
              <NumberField label="Press labor / item" value={draft.dtf.pressLaborPerItem} prefix="$" onChange={(value) => patch({ dtf: { ...draft.dtf, pressLaborPerItem: value } })} />
            </article>

            <article>
              <div><span>EMBROIDERY</span><h3>Stitch cost</h3><p>Estimate embroidery from the approved design's stitch count.</p></div>
              <NumberField label="Cost / 1,000 stitches" value={draft.embroidery.ratePerThousandStitches} prefix="$" onChange={(value) => patch({ embroidery: { ...draft.embroidery, ratePerThousandStitches: value } })} />
              <NumberField label="Minimum embroidery / item" value={draft.embroidery.minimumPerItem} prefix="$" onChange={(value) => patch({ embroidery: { ...draft.embroidery, minimumPerItem: value } })} />
            </article>
          </div>
        </section>

        {message && <div className={message.includes("saved") ? "success-message" : "error-message"}>{message}</div>}
      </div>

      <aside className="admin-card retail-example">
        <p className="eyebrow">RETAIL EXAMPLE</p>
        <h2>From cost to shelf</h2>
        <p>Retail pricing starts with what the product actually costs the Brand—not the Print Shop quote table.</p>

        <div className="example-product">
          <span>{sampleGarmentName}</span>
          <strong>${sampleRetail.toFixed(2)}</strong>
          <small>Recommended retail</small>
        </div>

        <div className="economics-lines">
          <div><span>Supplier blank</span><b>${sampleEconomics.supplierCost.toFixed(2)}</b></div>
          <div><span>Production</span><b>${sampleEconomics.productionCost.toFixed(2)}</b></div>
          <div><span>Packaging</span><b>${sampleEconomics.packagingCost.toFixed(2)}</b></div>
          <div><span>Fulfillment</span><b>${sampleEconomics.fulfillmentCost.toFixed(2)}</b></div>
          <div><span>Payment reserve</span><b>${sampleEconomics.paymentReserve.toFixed(2)}</b></div>
          <div className="cost"><span>Estimated total cost</span><b>${sampleEconomics.totalEstimatedCost.toFixed(2)}</b></div>
          <div className="profit"><span>Estimated gross profit</span><b>${sampleEconomics.grossProfit.toFixed(2)}</b></div>
        </div>

        <div className="margin-figure"><span>Estimated margin</span><strong>{sampleEconomics.marginPercent.toFixed(1)}%</strong></div>
        <small className="retail-note">Every finished Brand Product can override its retail price or use the target-margin recommendation.</small>
      </aside>

      {dirty && (
        <div className="brand-save-dock">
          <div><strong>Unsaved Retail Economics</strong><small>Print Shop pricing is completely separate.</small></div>
          <button className="primary-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Retail Economics"}</button>
        </div>
      )}

      <style jsx>{`
        .retail-economics-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px;align-items:start}.retail-sections{display:grid;gap:12px}.retail-section,.retail-example{padding:20px}
        .retail-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.retail-form-grid>label{display:grid;gap:5px}.retail-form-grid>label>span{font-size:8px;font-weight:800}
        .cost-method-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.cost-method-grid article{display:grid;gap:9px;padding:13px;border:1px solid #e1e1dc;border-radius:11px}.cost-method-grid article>div>span{font-size:7px;font-weight:850;letter-spacing:.1em;color:#777}.cost-method-grid h3{margin:3px 0;font-size:13px}.cost-method-grid p{margin:0;color:#777;font-size:8px;line-height:1.45}
        .retail-example{position:sticky;top:20px}.retail-example>h2{margin:3px 0 5px}.retail-example>p:not(.eyebrow){margin:0;color:#777;font-size:9px;line-height:1.45}.example-product{display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin:16px 0;padding:14px;border-radius:12px;background:#171717;color:#fff}.example-product span{font-size:8px;color:#aaa}.example-product strong{grid-row:1/span 2;grid-column:2;font-size:25px}.example-product small{font-size:7px;color:#aaa}.economics-lines{display:grid;gap:7px}.economics-lines>div{display:flex;justify-content:space-between;gap:12px;padding-bottom:7px;border-bottom:1px solid #eee;font-size:9px}.economics-lines .cost{font-weight:800}.economics-lines .profit{color:#288552}.margin-figure{display:flex;align-items:end;justify-content:space-between;margin-top:12px;padding:12px;border-radius:10px;background:#f4f4ef}.margin-figure span{font-size:8px;color:#777}.margin-figure strong{font-size:22px}.retail-note{display:block;margin-top:8px;color:#777;font-size:7px;line-height:1.4}
        .brand-save-dock{position:fixed;right:28px;top:18px;z-index:90;display:flex;align-items:center;gap:16px;padding:9px 10px 9px 13px;border-radius:12px;background:#171717;color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.2)}.brand-save-dock strong,.brand-save-dock small{display:block}.brand-save-dock strong{font-size:9px}.brand-save-dock small{font-size:7px;color:#aaa}
        @media(max-width:1000px){.retail-economics-layout{grid-template-columns:1fr}.retail-example{position:static}.cost-method-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:700px){.retail-form-grid,.cost-method-grid{grid-template-columns:1fr}.brand-save-dock{left:10px;right:10px;top:auto;bottom:10px;justify-content:space-between}}
      `}</style>
    </div>
  );
}

function SectionHeading({ number, kicker, title, text }: { number: string; kicker: string; title: string; text: string }) {
  return <div className="section-heading"><span>{number}</span><div><p className="eyebrow">{kicker}</p><h2>{title}</h2><p>{text}</p></div><style jsx>{`.section-heading{display:flex;gap:10px;align-items:flex-start;margin-bottom:15px}.section-heading>span{display:grid;place-items:center;width:27px;height:27px;flex:0 0 27px;border-radius:99px;background:#171717;color:#fff;font-size:8px;font-weight:850}.section-heading h2{margin:2px 0 3px}.section-heading p:not(.eyebrow){margin:0;color:#777;font-size:9px}`}</style></div>;
}

function NumberField({ label, value, prefix, suffix, step = ".01", onChange }: { label: string; value: number; prefix?: string; suffix?: string; step?: string; onChange: (value: number) => void }) {
  return <label className="number-field"><span>{label}</span><div>{prefix && <i>{prefix}</i>}<input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} />{suffix && <b>{suffix}</b>}</div><style jsx>{`.number-field{display:grid;gap:5px}.number-field>span{font-size:8px;font-weight:800}.number-field>div{display:grid;grid-template-columns:${prefix ? "28px " : ""}1fr${suffix ? " 30px" : ""};align-items:center}.number-field i,.number-field b{display:grid;place-items:center;height:100%;font-size:9px;font-style:normal;background:#f1f1ed;border:1px solid #ddd}.number-field i{border-radius:7px 0 0 7px}.number-field b{border-radius:0 7px 7px 0}.number-field input{min-width:0;width:100%;box-sizing:border-box}`}</style></label>;
}
