"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandStorefrontMode, PlatformShopAccess, ShopAccountMode } from "@/lib/shop-mode";

type Props = {
  shopName: string;
  accountMode: ShopAccountMode;
  initialStorefrontMode: BrandStorefrontMode;
  platformAccess: PlatformShopAccess;
};

function accessLabel(access: PlatformShopAccess) {
  if (access.customPrint && access.brandMerch) return "Custom Print + Brand";
  if (access.brandMerch) return "Brand / Merch";
  return "Custom Print";
}

const storefrontOptions: Array<{ value: BrandStorefrontMode; title: string; description: string }> = [
  { value: "full", title: "Full storefront", description: "Use PrintFlow as a complete standalone Brand shopping page." },
  { value: "embed", title: "Seamless embed", description: "Use a compact Brand ordering experience inside your existing website." },
  { value: "both", title: "Both", description: "Keep the full Brand storefront and the seamless website embed available." }
];

export default function StoreModeManager({
  shopName,
  accountMode,
  initialStorefrontMode,
  platformAccess
}: Props) {
  const router = useRouter();
  const [storefrontMode, setStorefrontMode] = useState(initialStorefrontMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const brandEnabled = platformAccess.brandMerch;
  const dirty = storefrontMode !== initialStorefrontMode;

  async function save() {
    if (!dirty || busy || !brandEnabled) return;
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/shop-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandStorefrontMode: storefrontMode })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update Brand publishing.");

      setMessage("Brand publishing preference saved.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="admin-header store-mode-header">
        <div>
          <p className="eyebrow">STORE ACCESS</p>
          <h1>{shopName}</h1>
          <p>PrintFlow Admin controls which commerce systems are enabled. Both accounts use the dashboard workspace switcher to move between Print Shop and Brand / Merch without turning either side off.</p>
        </div>
      </header>

      <div className="store-mode-layout">
        <section className="admin-card access-card">
          <div className="section-head">
            <div><span>1</span><div><h2>Enabled commerce</h2><p>These capabilities are controlled at the platform level.</p></div></div>
          </div>

          <div className="capability-grid">
            <article className={platformAccess.customPrint ? "enabled" : ""}>
              <div><strong>Custom Print</strong><small>Customer-uploaded artwork and custom production orders.</small></div>
              <span>{platformAccess.customPrint ? "Enabled" : "Not enabled"}</span>
            </article>

            <article className={platformAccess.brandMerch ? "enabled" : ""}>
              <div><strong>Brand / Merch</strong><small>Predetermined designs on approved garments.</small></div>
              <span>{platformAccess.brandMerch ? "Enabled" : "Not enabled"}</span>
            </article>
          </div>

          <div className="access-summary">
            <span>Account type</span>
            <strong>{accessLabel(platformAccess)}</strong>
            {accountMode === "hybrid" && <small>Use the Print Shop / Brand & Merch switcher in the dashboard sidebar. Both customer storefronts remain available simultaneously.</small>}
          </div>
        </section>

        <section className={brandEnabled ? "admin-card publish-card" : "admin-card publish-card disabled"}>
          <div className="section-head">
            <div><span>2</span><div><h2>Brand publishing</h2><p>Choose how the Brand / Merch storefront is presented to customers.</p></div></div>
            {!brandEnabled && <em>Brand access required</em>}
          </div>

          <div className="storefront-options">
            {storefrontOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                disabled={!brandEnabled}
                className={storefrontMode === option.value ? "selected" : ""}
                onClick={() => setStorefrontMode(option.value)}
              >
                <span>{storefrontMode === option.value ? "✓" : ""}</span>
                <div><strong>{option.title}</strong><small>{option.description}</small></div>
              </button>
            ))}
          </div>

          {brandEnabled && (
            <div className="publish-links-note">
              <strong>Both routes stay available.</strong>
              <p>The preference controls how you intend to publish the Brand store. It does not delete or disable the other route.</p>
            </div>
          )}
        </section>

        <aside className="admin-card save-card">
          <p className="section-kicker">ACCOUNT</p>
          <h2>{accessLabel(platformAccess)}</h2>
          <p>{accountMode === "hybrid" ? "Two separate workspaces, one PrintFlow account." : brandEnabled ? "Brand commerce workspace." : "Custom Print workspace."}</p>

          {brandEnabled && (
            <div><span>Brand publishing</span><strong>{storefrontOptions.find((item) => item.value === storefrontMode)?.title}</strong></div>
          )}

          <div className="save-actions">
            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}
            <button className="primary-button" type="button" disabled={!dirty || busy || !brandEnabled} onClick={save}>
              {busy ? "Saving…" : dirty ? "Save publishing" : "Saved"}
            </button>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .store-mode-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr);gap:16px;align-items:start}
        .access-card,.publish-card{grid-column:1;padding:22px}
        .save-card{grid-column:2;grid-row:1/span 2;position:sticky;top:24px;padding:20px}
        .section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
        .section-head>div{display:flex;gap:10px;align-items:flex-start}
        .section-head>div>span{display:grid;place-items:center;width:27px;height:27px;flex:0 0 27px;border-radius:99px;background:#171717;color:#fff;font-size:9px;font-weight:850}
        .section-head h2{margin:0 0 3px;font-size:17px}.section-head p{margin:0;color:#777;font-size:10px}
        .section-head em{font-style:normal;font-size:8px;color:#777;background:#f2f2ee;padding:5px 7px;border-radius:99px}
        .capability-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .capability-grid article{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px;border:1px solid #e1e1dc;border-radius:11px;opacity:.55}
        .capability-grid article.enabled{opacity:1;border-color:#aaa;background:#fafaf7}
        .capability-grid strong{display:block;font-size:11px}.capability-grid small{display:block;margin-top:3px;color:#777;font-size:8px;line-height:1.4}.capability-grid article>span{font-size:8px;font-weight:800}
        .access-summary{display:grid;gap:3px;margin-top:12px;padding:11px 13px;border-radius:10px;background:#f4f4ef}.access-summary span{font-size:8px;color:#777;text-transform:uppercase;letter-spacing:.08em}.access-summary strong{font-size:12px}.access-summary small{font-size:8px;color:#777}
        .storefront-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.storefront-options button{min-width:0;padding:12px;border:1px solid #deded8;border-radius:10px;background:#fff;color:#171717;text-align:left}.storefront-options button.selected{border-color:#171717;box-shadow:inset 0 0 0 1px #171717;background:#fafaf7}.storefront-options button>span{display:grid;place-items:center;width:19px;height:19px;margin-bottom:8px;border-radius:6px;background:#f1f1ed;font-size:9px}.storefront-options button.selected>span{background:#171717;color:#fff}.storefront-options strong{display:block;font-size:10px}.storefront-options small{display:block;margin-top:3px;color:#777;font-size:8px;line-height:1.4}.publish-card.disabled{opacity:.55}
        .publish-links-note{margin-top:11px;padding:10px 12px;border-radius:9px;background:#f4f4ef}.publish-links-note strong{font-size:9px}.publish-links-note p{margin:2px 0 0;color:#777;font-size:8px}
        .save-card h2{margin:4px 0 5px}.save-card>p:not(.section-kicker){margin:0 0 16px;color:#777;font-size:9px}.save-card>div:not(.save-actions){display:grid;gap:3px;padding:11px 0;border-top:1px solid #e8e8e3}.save-card span{font-size:8px;color:#777;text-transform:uppercase}.save-card strong{font-size:11px}.save-actions{display:grid;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid #e8e8e3}
        @media(max-width:900px){.store-mode-layout{grid-template-columns:1fr}.access-card,.publish-card,.save-card{grid-column:1;grid-row:auto}.save-card{position:static}}
        @media(max-width:640px){.capability-grid,.storefront-options{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
