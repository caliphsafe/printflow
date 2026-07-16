"use client";

import { createClient } from "@supabase/supabase-js";
import { ChangeEvent, CSSProperties, useMemo, useState } from "react";
import type { ShopSettings } from "@/lib/types";

type Shop = { id: string; name: string; slug: string; active: boolean; settings: ShopSettings };
type Props = { initialShop: Shop; organizationName: string; appUrl: string };

export default function ShopSettingsEditor({ initialShop, organizationName, appUrl }: Props) {
  const [shop, setShop] = useState(initialShop);
  const [draft, setDraft] = useState(initialShop);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const embed = useMemo(() => `<script src="${appUrl}/embed.js" data-shop="${shop.slug}"></script>`, [appUrl, shop.slug]);
  const experience = draft.settings.customerExperience || {};
  const business = draft.settings.business || {};

  function patchSettings(section: "brand" | "business" | "customerExperience" | "upload", values: Record<string, unknown>) {
    setDraft(current => ({ ...current, settings: { ...current.settings, [section]: { ...(current.settings as any)[section], ...values } } }));
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(""); setMessage(""); setLogoBusy(true);
    try {
      const prepare = await fetch("/api/admin/settings/logo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }) });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Unable to upload logo.");
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("Public Supabase settings are missing.");
      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const result = await supabase.storage.from(prepared.bucket).uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (result.error) throw result.error;
      patchSettings("brand", { logoUrl: prepared.publicUrl });
      setMessage("Logo uploaded. Click Save changes to publish it.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to upload logo."); }
    finally { setLogoBusy(false); event.target.value = ""; }
  }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: draft.name,
        active: draft.active,
        brand: draft.settings.brand,
        business,
        customerExperience: experience,
        upload: draft.settings.upload
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save shop settings.");
      setShop(data.shop); setDraft(data.shop); setMessage("Shop settings published to the designer.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save shop settings."); }
    finally { setBusy(false); }
  }

  return <>
    <header className="admin-header"><div><p className="eyebrow">SHOP SETUP</p><h1>Brand your storefront</h1><p>Control how customers experience your embedded designer without editing database JSON.</p></div><a className="secondary-button" href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">Preview shop ↗</a></header>

    <div className="settings-editor-layout">
      <div className="settings-form-stack">
        <section className="admin-card settings-editor-card">
          <div className="card-heading"><div><p className="section-kicker">IDENTITY</p><h2>Company profile</h2></div><label className="toggle-row"><input type="checkbox" checked={draft.active} onChange={e=>setDraft(c=>({...c,active:e.target.checked}))}/><span>Storefront active</span></label></div>
          <div className="settings-fields two-column-fields">
            <label><span>Shop name</span><input value={draft.name} onChange={e=>setDraft(c=>({...c,name:e.target.value}))}/></label>
            <label><span>Organization</span><input value={organizationName} disabled/></label>
            <label><span>Contact email</span><input type="email" value={business.contactEmail || ""} onChange={e=>patchSettings("business",{contactEmail:e.target.value})}/></label>
            <label><span>Phone</span><input value={business.phone || ""} onChange={e=>patchSettings("business",{phone:e.target.value})}/></label>
            <label className="full-field"><span>Business address</span><textarea rows={2} value={business.address || ""} onChange={e=>patchSettings("business",{address:e.target.value})}/></label>
          </div>
        </section>

        <section className="admin-card settings-editor-card">
          <div><p className="section-kicker">BRANDING</p><h2>Logo and colors</h2><p>These values update the public designer header and buttons.</p></div>
          <div className="brand-editor-grid">
            <div className="logo-upload-card">
              <div className="logo-preview">{draft.settings.brand.logoUrl ? <img src={draft.settings.brand.logoUrl} alt="Shop logo preview"/> : <span>{draft.name.slice(0,1).toUpperCase()}</span>}</div>
              <label className="secondary-button upload-logo-button"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadLogo}/>{logoBusy ? "Uploading…" : "Upload logo"}</label>
              {draft.settings.brand.logoUrl && <button className="text-button compact-text-button" type="button" onClick={()=>patchSettings("brand",{logoUrl:""})}>Remove logo</button>}
            </div>
            <div className="settings-fields">
              <label><span>Primary color</span><div className="color-input-row"><input type="color" value={draft.settings.brand.primaryColor} onChange={e=>patchSettings("brand",{primaryColor:e.target.value})}/><input value={draft.settings.brand.primaryColor} onChange={e=>patchSettings("brand",{primaryColor:e.target.value})}/></div></label>
              <label><span>Button/text color</span><div className="color-input-row"><input type="color" value={draft.settings.brand.textColor} onChange={e=>patchSettings("brand",{textColor:e.target.value})}/><input value={draft.settings.brand.textColor} onChange={e=>patchSettings("brand",{textColor:e.target.value})}/></div></label>
            </div>
          </div>
        </section>

        <section className="admin-card settings-editor-card">
          <div><p className="section-kicker">CUSTOMER EXPERIENCE</p><h2>Designer messaging</h2><p>Set expectations before artwork reaches production.</p></div>
          <div className="settings-fields">
            <label><span>Designer headline</span><input value={experience.headline || ""} onChange={e=>patchSettings("customerExperience",{headline:e.target.value})}/></label>
            <label><span>Introduction</span><textarea rows={3} value={experience.introduction || ""} onChange={e=>patchSettings("customerExperience",{introduction:e.target.value})}/></label>
            <label><span>Artwork upload instructions</span><textarea rows={3} value={experience.uploadInstructions || ""} onChange={e=>patchSettings("customerExperience",{uploadInstructions:e.target.value})}/></label>
            <label><span>Turnaround time</span><input value={experience.turnaroundTime || ""} onChange={e=>patchSettings("customerExperience",{turnaroundTime:e.target.value})}/></label>
            <label><span>Artwork disclaimer</span><textarea rows={3} value={experience.artworkDisclaimer || ""} onChange={e=>patchSettings("customerExperience",{artworkDisclaimer:e.target.value})}/></label>
            <label><span>Saved-design confirmation</span><textarea rows={2} value={experience.confirmationMessage || ""} onChange={e=>patchSettings("customerExperience",{confirmationMessage:e.target.value})}/></label>
            <label><span>Maximum upload size (MB)</span><input type="number" min="1" max="25" value={Math.round(draft.settings.upload.maxBytes/1024/1024)} onChange={e=>patchSettings("upload",{maxBytes:Number(e.target.value)*1024*1024})}/></label>
          </div>
        </section>

        {error && <div className="error-message settings-message">{error}</div>}
        {message && <div className="success-message settings-message">{message}</div>}
        <div className="settings-save-bar"><div><strong>Ready to publish?</strong><span>Changes affect the hosted and embedded designer.</span></div><button className="primary-button settings-save-button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div>
      </div>

      <aside className="settings-preview-stack">
        <section className="admin-card live-brand-preview" style={{"--preview-brand":draft.settings.brand.primaryColor,"--preview-text":draft.settings.brand.textColor} as CSSProperties}>
          <p className="section-kicker">LIVE PREVIEW</p>
          <div className="mini-designer-header">
            {draft.settings.brand.logoUrl ? <img src={draft.settings.brand.logoUrl} alt=""/> : <span className="mini-logo-mark">{draft.name.slice(0,1).toUpperCase()}</span>}
            <h3>{experience.headline || "Design your custom shirts"}</h3>
            <p>{experience.introduction}</p>
            <button type="button">Save design & continue</button>
          </div>
        </section>
        <section className="admin-card embed-card"><p className="section-kicker">INSTALLATION</p><h2>One-line embed</h2><pre className="code-block polished-code">{embed}</pre><p className="small-muted">Shop slug: <code>{shop.slug}</code></p></section>
      </aside>
    </div>
  </>;
}
