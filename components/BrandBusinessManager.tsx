"use client";

import { useMemo, useState } from "react";
import type { BrandBusinessProfile } from "@/lib/brand-retail";

type Tab = "identity" | "store" | "theme";

export default function BrandBusinessManager({
  initial,
  shopSlug
}: {
  initial: BrandBusinessProfile;
  shopSlug: string;
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<Tab>("identity");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = useMemo(() => JSON.stringify(draft) !== saved, [draft, saved]);

  function patchSettings(next: Partial<BrandBusinessProfile["settings"]>) {
    setDraft((current) => ({ ...current, settings: { ...current.settings, ...next } }));
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

      const next: BrandBusinessProfile = {
        id: data.profile.id,
        name: data.profile.name,
        settings: data.profile.settings
      };

      setDraft(next);
      setSaved(JSON.stringify(next));
      setMessage("Brand storefront settings saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save Brand settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="brand-settings-v4">
      <section className="brand-settings-editor">
        <div className="admin-card publish-card">
          <div>
            <p className="eyebrow">PUBLIC STOREFRONT</p>
            <strong>{draft.settings.active ? "Store is Live" : "Store is Draft"}</strong>
            <small>Preview the entire shopping experience before publishing. This does not affect the Print storefront.</small>
          </div>
          <div>
            <a href="/preview/brand" target="_blank" rel="noreferrer">Preview Store ↗</a>
            <label className="modern-switch">
              <input type="checkbox" checked={draft.settings.active} onChange={(event) => patchSettings({ active: event.target.checked })} />
              <span /><b>{draft.settings.active ? "Live" : "Draft"}</b>
            </label>
          </div>
        </div>

        <nav className="settings-tabs">
          <button className={tab === "identity" ? "active" : ""} onClick={() => setTab("identity")}><span>01</span><div><strong>Brand Identity</strong><small>Name & logo</small></div></button>
          <button className={tab === "store" ? "active" : ""} onClick={() => setTab("store")}><span>02</span><div><strong>Store Content</strong><small>Hero & messaging</small></div></button>
          <button className={tab === "theme" ? "active" : ""} onClick={() => setTab("theme")}><span>03</span><div><strong>Store Theme</strong><small>Color system</small></div></button>
        </nav>

        {tab === "identity" && (
          <section className="admin-card settings-section">
            <div className="section-heading">
              <span>01</span>
              <div><p className="eyebrow">BRAND IDENTITY</p><h2>How customers recognize the store</h2><p>This identity is used only by Brand / Merch.</p></div>
            </div>
            <div className="settings-form two">
              <label><span>Brand name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label><span>Logo URL</span><input value={draft.settings.logoUrl || ""} onChange={(event) => patchSettings({ logoUrl: event.target.value })} placeholder="https://…" /></label>
            </div>
          </section>
        )}

        {tab === "store" && (
          <section className="admin-card settings-section">
            <div className="section-heading">
              <span>02</span>
              <div><p className="eyebrow">SHOPPING EXPERIENCE</p><h2>Storefront messaging</h2><p>Keep the copy customer-facing. The actual product flow is always Garment → Design → Order.</p></div>
            </div>
            <div className="settings-form">
              <label><span>Small hero label</span><input value={draft.settings.heroBadge} onChange={(event) => patchSettings({ heroBadge: event.target.value })} /></label>
              <label><span>Main headline</span><input value={draft.settings.headline} onChange={(event) => patchSettings({ headline: event.target.value })} /></label>
              <label className="wide"><span>Store introduction</span><textarea rows={4} value={draft.settings.introduction} onChange={(event) => patchSettings({ introduction: event.target.value })} /></label>
              <label className="wide"><span>Announcement / trust bar</span><input value={draft.settings.trustMessage} onChange={(event) => patchSettings({ trustMessage: event.target.value })} /></label>
            </div>
            <div className="copy-guidance">
              <strong>Customer flow is intentionally simple.</strong>
              <span>Do not explain garment cost + design cost on the storefront. Customers see one final item price after choosing their design and placement.</span>
            </div>
          </section>
        )}

        {tab === "theme" && (
          <section className="admin-card settings-section">
            <div className="section-heading">
              <span>03</span>
              <div><p className="eyebrow">STORE THEME</p><h2>Webstore colors</h2><p>These colors apply to the full Brand store and compact embed only.</p></div>
            </div>
            <div className="theme-grid">
              {[
                ["primaryColor", "Buttons / primary"],
                ["textColor", "Text on primary"],
                ["accentColor", "Accent"],
                ["surfaceColor", "Store background"]
              ].map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <div>
                    <input type="color" value={(draft.settings as any)[key]} onChange={(event) => patchSettings({ [key]: event.target.value } as any)} />
                    <input value={(draft.settings as any)[key]} onChange={(event) => patchSettings({ [key]: event.target.value } as any)} />
                  </div>
                </label>
              ))}
            </div>
          </section>
        )}

        {message && <div className={message.includes("saved") ? "success-message" : "error-message"}>{message}</div>}
      </section>

      <aside className="admin-card store-direction-preview" style={{
        "--brand": draft.settings.primaryColor,
        "--brand-text": draft.settings.textColor,
        "--surface": draft.settings.surfaceColor
      } as React.CSSProperties}>
        <div className="preview-label"><p className="eyebrow">STORE DIRECTION</p><span>Customer view</span></div>
        <div className="mini-webstore">
          <div className="mini-announcement">{draft.settings.trustMessage}</div>
          <header>
            {draft.settings.logoUrl ? <img src={draft.settings.logoUrl} alt="" /> : <strong>{draft.name || "Brand"}</strong>}
            <nav><span>Shop</span><span>Build Your Own</span></nav>
          </header>
          <section>
            <small>{draft.settings.heroBadge}</small>
            <h2>{draft.settings.headline}</h2>
            <p>{draft.settings.introduction}</p>
            <button>Shop garments</button>
          </section>
          <div className="mini-products">
            {[1, 2, 3].map((item) => (
              <article key={item}>
                <div><span>DESIGN</span></div>
                <strong>{item === 1 ? "Heavyweight Tee" : item === 2 ? "Hoodie" : "Hat"}</strong>
                <small>Customize →</small>
              </article>
            ))}
          </div>
        </div>
        <a className="secondary-button" href="/preview/brand" target="_blank" rel="noreferrer">Open full preview ↗</a>
      </aside>

      {dirty && (
        <div className="brand-save-dock">
          <div><strong>Unsaved storefront changes</strong><small>Save to update the Brand webstore.</small></div>
          <button className="primary-button" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      )}

      <style jsx>{`
        .brand-settings-v4{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:12px;align-items:start}.brand-settings-editor{display:grid;gap:10px}.publish-card{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:14px}.publish-card strong,.publish-card small{display:block}.publish-card strong{margin:3px 0;font-size:12px}.publish-card small{font-size:7px;color:#777}.publish-card>div:last-child{display:flex;gap:10px;align-items:center}.publish-card a{font-size:8px;font-weight:850;color:#1f2947}
        .settings-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:5px;border:1px solid #e1e1dc;border-radius:11px;background:#f2f2ee}.settings-tabs button{display:grid;grid-template-columns:25px 1fr;gap:7px;align-items:center;padding:8px;border:0;border-radius:8px;background:transparent;color:#777;text-align:left}.settings-tabs button.active{background:#fff;color:#171717;box-shadow:0 3px 12px rgba(0,0,0,.05)}.settings-tabs button>span{display:grid;place-items:center;width:24px;height:24px;border-radius:99px;background:#ddd;font-size:7px;font-weight:900}.settings-tabs button.active>span{background:#1f2947;color:#fff}.settings-tabs strong,.settings-tabs small{display:block}.settings-tabs strong{font-size:8px}.settings-tabs small{font-size:6px}
        .settings-section{padding:18px}.section-heading{display:grid;grid-template-columns:30px 1fr;gap:9px;align-items:start;margin-bottom:15px}.section-heading>span{display:grid;place-items:center;width:28px;height:28px;border-radius:99px;background:#171717;color:#fff;font-size:7px;font-weight:900}.section-heading h2{margin:2px 0;font-size:16px}.section-heading p:not(.eyebrow){margin:0;color:#777;font-size:8px}.settings-form{display:grid;gap:8px}.settings-form.two{grid-template-columns:1fr 1fr}.settings-form label{display:grid;gap:4px}.settings-form label>span,.theme-grid label>span{font-size:7px;font-weight:800}.settings-form .wide{grid-column:1/-1}.copy-guidance{display:grid;gap:3px;margin-top:12px;padding:10px;border-radius:8px;background:#eef2fb}.copy-guidance strong{font-size:8px}.copy-guidance span{font-size:7px;color:#68718a}.theme-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.theme-grid label{display:grid;gap:4px}.theme-grid label>div{display:grid;grid-template-columns:42px 1fr;gap:5px}.theme-grid input[type=color]{padding:2px}
        .store-direction-preview{position:sticky;top:15px;padding:14px}.preview-label{display:flex;justify-content:space-between;align-items:center}.preview-label span{font-size:7px;color:#888}.mini-webstore{margin:10px 0;border:1px solid #ddd;background:var(--surface);overflow:hidden}.mini-announcement{padding:5px;background:var(--brand);color:var(--brand-text);text-align:center;font-size:5px}.mini-webstore header{display:flex;justify-content:space-between;align-items:center;padding:8px;background:#fff}.mini-webstore header img{max-width:80px;max-height:24px}.mini-webstore header nav{display:flex;gap:6px}.mini-webstore header nav span{font-size:5px}.mini-webstore>section{padding:24px 14px;background:#fff}.mini-webstore>section small{font-size:5px;color:var(--brand);font-weight:900;letter-spacing:.1em}.mini-webstore>section h2{margin:4px 0;font-size:27px;line-height:.9}.mini-webstore>section p{font-size:6px;color:#777;line-height:1.4}.mini-webstore>section button{padding:7px 9px;border:0;background:var(--brand);color:var(--brand-text);font-size:6px;font-weight:850}.mini-products{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:5px}.mini-products article{padding:4px;background:#fff}.mini-products article>div{display:grid;place-items:center;height:72px;background:#f0f0ec}.mini-products article>div span{font-size:5px;color:#999}.mini-products strong,.mini-products small{display:block}.mini-products strong{margin-top:4px;font-size:6px}.mini-products small{margin-top:2px;font-size:5px;color:#777}
        .brand-save-dock{position:fixed;right:24px;top:18px;z-index:95;display:flex;align-items:center;gap:14px;padding:9px 10px 9px 13px;border-radius:10px;background:#171717;color:#fff;box-shadow:0 13px 32px rgba(0,0,0,.2)}.brand-save-dock strong,.brand-save-dock small{display:block}.brand-save-dock strong{font-size:8px}.brand-save-dock small{font-size:6px;color:#aaa}
        @media(max-width:950px){.brand-settings-v4{grid-template-columns:1fr}.store-direction-preview{position:static}.brand-save-dock{left:10px;right:10px;top:auto;bottom:10px;justify-content:space-between}}@media(max-width:620px){.settings-tabs,.settings-form.two,.theme-grid{grid-template-columns:1fr}.settings-form .wide{grid-column:auto}}
      `}</style>
    </div>
  );
}
