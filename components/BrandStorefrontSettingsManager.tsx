"use client";

import { useMemo, useState } from "react";
import type { BrandStorefrontSettings } from "@/lib/brand-commerce";

export default function BrandStorefrontSettingsManager({
  initial
}: {
  initial: BrandStorefrontSettings;
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = useMemo(() => JSON.stringify(draft) !== saved, [draft, saved]);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/brand-commerce/storefront", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Brand storefront.");
      setDraft(data.storefront);
      setSaved(JSON.stringify(data.storefront));
      setMessage("Brand storefront saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save Brand storefront.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card brand-store-settings">
      <header>
        <div>
          <p className="section-kicker">BRAND PRESENTATION</p>
          <h2>Brand storefront identity</h2>
          <p>These settings belong to Brand / Merch only. Your Custom Print storefront keeps its own branding and copy.</p>
        </div>
      </header>

      <div className="brand-settings-grid">
        <label className="wide"><span>Brand logo URL</span><input value={draft.logoUrl || ""} onChange={(event) => setDraft({ ...draft, logoUrl: event.target.value })} placeholder="https://..." /></label>

        <label><span>Primary</span><div className="color-field"><input type="color" value={draft.primaryColor} onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })} /><input value={draft.primaryColor} onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })} /></div></label>
        <label><span>Text on primary</span><div className="color-field"><input type="color" value={draft.textColor} onChange={(event) => setDraft({ ...draft, textColor: event.target.value })} /><input value={draft.textColor} onChange={(event) => setDraft({ ...draft, textColor: event.target.value })} /></div></label>
        <label><span>Accent</span><div className="color-field"><input type="color" value={draft.accentColor} onChange={(event) => setDraft({ ...draft, accentColor: event.target.value })} /><input value={draft.accentColor} onChange={(event) => setDraft({ ...draft, accentColor: event.target.value })} /></div></label>
        <label><span>Surface</span><div className="color-field"><input type="color" value={draft.surfaceColor} onChange={(event) => setDraft({ ...draft, surfaceColor: event.target.value })} /><input value={draft.surfaceColor} onChange={(event) => setDraft({ ...draft, surfaceColor: event.target.value })} /></div></label>

        <label><span>Badge</span><input value={draft.heroBadge} onChange={(event) => setDraft({ ...draft, heroBadge: event.target.value })} /></label>
        <label><span>Headline</span><input value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} /></label>
        <label className="wide"><span>Introduction</span><textarea rows={3} value={draft.introduction} onChange={(event) => setDraft({ ...draft, introduction: event.target.value })} /></label>
        <label className="wide"><span>Trust message</span><input value={draft.trustMessage} onChange={(event) => setDraft({ ...draft, trustMessage: event.target.value })} /></label>
      </div>

      <div className="mini-preview" style={{ background: draft.surfaceColor }}>
        <div style={{ background: draft.primaryColor, color: draft.textColor }}>
          <span>{draft.heroBadge}</span>
          <strong>{draft.headline}</strong>
          <p>{draft.introduction}</p>
          <button style={{ background: draft.accentColor }}>Shop design</button>
        </div>
      </div>

      {message && <div className={message.includes("saved") ? "success-message" : "error-message"}>{message}</div>}

      {dirty && <div className="settings-save"><button className="primary-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Brand storefront"}</button></div>}

      <style jsx>{`
        .brand-store-settings{padding:20px}.brand-store-settings header h2{margin:4px 0}.brand-store-settings header p{margin:0;color:#777;max-width:720px}
        .brand-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}.brand-settings-grid label{display:grid;gap:4px}.brand-settings-grid label>span{font-size:8px;font-weight:800}.brand-settings-grid .wide{grid-column:1/-1}.color-field{display:grid;grid-template-columns:42px minmax(0,1fr);gap:5px}.color-field input[type=color]{width:42px;padding:2px}
        .mini-preview{margin-top:16px;padding:18px;border-radius:13px}.mini-preview>div{max-width:560px;padding:20px;border-radius:13px}.mini-preview span{display:block;font-size:7px;font-weight:850;letter-spacing:.1em}.mini-preview strong{display:block;margin-top:6px;font-size:28px;line-height:1}.mini-preview p{max-width:440px;font-size:9px;opacity:.8}.mini-preview button{border:0;border-radius:8px;padding:8px 10px;font-size:8px;font-weight:800}.settings-save{display:flex;justify-content:flex-end;margin-top:14px}
        @media(max-width:650px){.brand-settings-grid{grid-template-columns:1fr}.brand-settings-grid .wide{grid-column:auto}}
      `}</style>
    </section>
  );
}
