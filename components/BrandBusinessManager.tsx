"use client";

import { useMemo, useState } from "react";
import type { BrandBusinessProfile } from "@/lib/brand-retail";

export default function BrandBusinessManager({
  initial,
  shopSlug
}: {
  initial: BrandBusinessProfile;
  shopSlug: string;
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = useMemo(() => JSON.stringify(draft) !== saved, [draft, saved]);

  function patchSettings(next: Partial<BrandBusinessProfile["settings"]>) {
    setDraft((current) => ({
      ...current,
      settings: { ...current.settings, ...next }
    }));
  }

  async function save() {
    if (!draft.name.trim() || busy) return;
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/brand-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Brand settings.");

      const next: BrandBusinessProfile = { id: data.profile.id, name: data.profile.name, settings: data.profile.settings };
      setDraft(next);
      setSaved(JSON.stringify(next));
      setMessage("Brand business settings saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save Brand settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-settings-grid">
      <section className="admin-card brand-settings-main">
        <div className="brand-publish-control">
          <div>
            <p className="eyebrow">BRAND STOREFRONT STATUS</p>
            <strong>{draft.settings.active ? "Brand store is live" : "Brand store is draft"}</strong>
            <small>This switch affects only /b/{shopSlug} and /e/{shopSlug}. The Print Shop storefront is independent.</small>
          </div>
          <label className="modern-switch">
            <input type="checkbox" checked={draft.settings.active} onChange={(event) => patchSettings({ active: event.target.checked })} />
            <span /><b>{draft.settings.active ? "Live" : "Draft"}</b>
          </label>
        </div>

        <div className="brand-section-heading">
          <span>1</span>
          <div>
            <p className="eyebrow">BRAND IDENTITY</p>
            <h2>Your retail business</h2>
            <p>This identity belongs to Brand / Merch only. It does not rename or recolor the Print Shop.</p>
          </div>
        </div>

        <div className="brand-settings-form">
          <label><span>Brand name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label><span>Logo URL</span><input value={draft.settings.logoUrl || ""} onChange={(event) => patchSettings({ logoUrl: event.target.value })} placeholder="https://…" /></label>
        </div>

        <div className="brand-section-heading second">
          <span>2</span>
          <div>
            <p className="eyebrow">RETAIL STOREFRONT</p>
            <h2>Brand presentation</h2>
            <p>These colors and messages apply only to the Brand storefront and Brand embed.</p>
          </div>
        </div>

        <div className="brand-color-form">
          {[
            ["primaryColor", "Primary"],
            ["textColor", "Text on primary"],
            ["accentColor", "Accent"],
            ["surfaceColor", "Store surface"]
          ].map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <div><input type="color" value={(draft.settings as any)[key]} onChange={(event) => patchSettings({ [key]: event.target.value } as any)} /><input value={(draft.settings as any)[key]} onChange={(event) => patchSettings({ [key]: event.target.value } as any)} /></div>
            </label>
          ))}
        </div>

        <div className="brand-copy-form">
          <label><span>Small label</span><input value={draft.settings.heroBadge} onChange={(event) => patchSettings({ heroBadge: event.target.value })} /></label>
          <label><span>Headline</span><input value={draft.settings.headline} onChange={(event) => patchSettings({ headline: event.target.value })} /></label>
          <label className="wide"><span>Introduction</span><textarea rows={3} value={draft.settings.introduction} onChange={(event) => patchSettings({ introduction: event.target.value })} /></label>
          <label className="wide"><span>Trust message</span><input value={draft.settings.trustMessage} onChange={(event) => patchSettings({ trustMessage: event.target.value })} /></label>
        </div>

        {message && <div className={message.includes("saved") ? "success-message" : "error-message"}>{message}</div>}
      </section>

      <aside className="admin-card brand-settings-preview" style={{
        "--brand": draft.settings.primaryColor,
        "--brand-text": draft.settings.textColor,
        "--brand-accent": draft.settings.accentColor,
        "--brand-surface": draft.settings.surfaceColor
      } as React.CSSProperties}>
        <p className="eyebrow">LIVE DIRECTION</p>
        <div className="mini-store">
          <header>
            {draft.settings.logoUrl ? <img src={draft.settings.logoUrl} alt="" /> : <strong>{draft.name || "Brand"}</strong>}
            <span>Shop</span>
          </header>
          <main>
            <small>{draft.settings.heroBadge}</small>
            <h2>{draft.settings.headline}</h2>
            <p>{draft.settings.introduction}</p>
            <button>Shop merchandise</button>
          </main>
        </div>
        <a className="secondary-button" href={`/b/${shopSlug}`} target="_blank" rel="noreferrer">Open Brand storefront ↗</a>
      </aside>

      {dirty && (
        <div className="brand-save-dock">
          <div><strong>Unsaved Brand settings</strong><small>Print Shop branding is not affected.</small></div>
          <button className="primary-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save Brand settings"}</button>
        </div>
      )}

      <style jsx>{`
        .brand-settings-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}
        .brand-settings-main,.brand-settings-preview{padding:20px}
        .brand-publish-control{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:20px;padding:13px;border-radius:11px;background:#f5f5f1}.brand-publish-control strong,.brand-publish-control small{display:block}.brand-publish-control strong{margin:2px 0;font-size:11px}.brand-publish-control small{font-size:7px;color:#777}
        .brand-section-heading{display:flex;gap:10px;align-items:flex-start;margin-bottom:14px}.brand-section-heading.second{margin-top:24px;padding-top:22px;border-top:1px solid #eee}
        .brand-section-heading>span{display:grid;place-items:center;width:27px;height:27px;flex:0 0 27px;border-radius:99px;background:#171717;color:#fff;font-size:8px;font-weight:850}
        .brand-section-heading h2{margin:2px 0 3px}.brand-section-heading p:not(.eyebrow){margin:0;color:#777;font-size:9px}
        .brand-settings-form,.brand-copy-form{display:grid;grid-template-columns:1fr 1fr;gap:9px}.brand-settings-form label,.brand-copy-form label,.brand-color-form label{display:grid;gap:5px}.brand-settings-form span,.brand-copy-form span,.brand-color-form span{font-size:8px;font-weight:800}.brand-copy-form .wide{grid-column:1/-1}
        .brand-color-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}.brand-color-form label>div{display:grid;grid-template-columns:42px 1fr;gap:5px}.brand-color-form input[type=color]{padding:2px}
        .brand-settings-preview{position:sticky;top:20px}.mini-store{overflow:hidden;border:1px solid #ddd;border-radius:14px;background:var(--brand-surface);margin:12px 0}.mini-store header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#fff}.mini-store header img{max-width:100px;max-height:28px}.mini-store header span{font-size:8px}.mini-store main{padding:28px 18px}.mini-store small{font-size:7px;font-weight:850;letter-spacing:.1em;color:var(--brand)}.mini-store h2{font-size:30px;line-height:.95;margin:7px 0}.mini-store p{font-size:9px;color:#666}.mini-store button{margin-top:8px;padding:10px 12px;border:0;border-radius:8px;background:var(--brand);color:var(--brand-text);font-weight:800}
        .brand-save-dock{position:fixed;right:28px;top:18px;z-index:90;display:flex;align-items:center;gap:16px;padding:9px 10px 9px 13px;border-radius:12px;background:#171717;color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.2)}.brand-save-dock strong,.brand-save-dock small{display:block}.brand-save-dock strong{font-size:9px}.brand-save-dock small{font-size:7px;color:#aaa}
        @media(max-width:900px){.brand-settings-grid{grid-template-columns:1fr}.brand-settings-preview{position:static}.brand-save-dock{left:10px;right:10px;top:auto;bottom:10px;justify-content:space-between}}
        @media(max-width:620px){.brand-settings-form,.brand-copy-form,.brand-color-form{grid-template-columns:1fr}.brand-copy-form .wide{grid-column:auto}}
      `}</style>
    </div>
  );
}
