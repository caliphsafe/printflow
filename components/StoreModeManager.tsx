"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandStorefrontMode, PlatformShopAccess, ShopAccountMode } from "@/lib/shop-mode";
import { isModeAllowed } from "@/lib/shop-mode";

type Props = {
  shopName: string;
  initialAccountMode: ShopAccountMode;
  initialStorefrontMode: BrandStorefrontMode;
  platformAccess: PlatformShopAccess;
};

const accountOptions: Array<{
  value: ShopAccountMode;
  title: string;
  description: string;
  points: string[];
}> = [
  {
    value: "custom",
    title: "Custom Print",
    description: "Customers choose garments, upload their own artwork, and build custom orders.",
    points: ["Customer artwork uploads", "Print-size controls", "Custom production workflow"]
  },
  {
    value: "brand",
    title: "Brand / Merch",
    description: "Customers choose garments and purchase from your predetermined design library.",
    points: ["Approved brand designs", "Light / dark artwork variants", "Locked production placement"]
  },
  {
    value: "hybrid",
    title: "Custom Print + Brand",
    description: "Operate both commerce experiences from the same PrintFlow account and shared catalog.",
    points: ["Two customer experiences", "One supplier catalog", "One order and production system"]
  }
];

const storefrontOptions: Array<{
  value: BrandStorefrontMode;
  title: string;
  description: string;
}> = [
  { value: "full", title: "Full storefront", description: "Use PrintFlow as a complete standalone Brand shopping page." },
  { value: "embed", title: "Seamless embed", description: "Use a compact Brand experience inside an existing website." },
  { value: "both", title: "Both", description: "Keep the full Brand storefront and website embed available." }
];

export default function StoreModeManager({
  shopName,
  initialAccountMode,
  initialStorefrontMode,
  platformAccess
}: Props) {
  const router = useRouter();
  const safeInitialMode = isModeAllowed(initialAccountMode, platformAccess)
    ? initialAccountMode
    : platformAccess.brandMerch
      ? "brand"
      : "custom";

  const [accountMode, setAccountMode] = useState<ShopAccountMode>(safeInitialMode);
  const [storefrontMode, setStorefrontMode] = useState(initialStorefrontMode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dirty = accountMode !== initialAccountMode || storefrontMode !== initialStorefrontMode;
  const brandEnabled = accountMode === "brand" || accountMode === "hybrid";
  const summary = useMemo(() => {
    if (accountMode === "brand") return "This workspace focuses on predetermined Brand/Merch commerce.";
    if (accountMode === "hybrid") return "Custom Print and Brand/Merch are both available from the same account.";
    return "This workspace focuses on customer-uploaded custom-print orders.";
  }, [accountMode]);

  async function save() {
    if (!dirty || busy || !isModeAllowed(accountMode, platformAccess)) return;
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/shop-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountMode, brandStorefrontMode: storefrontMode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update store mode.");

      setMessage("Store mode saved.");
      router.refresh();
      window.setTimeout(() => {
        window.location.href = accountMode === "brand" || accountMode === "hybrid" ? "/dashboard/designs" : "/dashboard";
      }, 400);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update store mode.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="admin-header store-mode-header">
        <div>
          <p className="eyebrow">STORE MODE</p>
          <h1>How should {shopName} use PrintFlow?</h1>
          <p>Choose between the commerce experiences enabled for this account. Platform access is managed by PrintFlow Admin.</p>
        </div>
      </header>

      <div className="store-mode-layout">
        <section className="admin-card store-mode-card">
          <div className="store-mode-section-heading">
            <div><span>1</span><div><h2>Commerce experience</h2><p>Products, suppliers, customers, pricing, and orders keep the same identities.</p></div></div>
          </div>

          <div className="store-mode-options">
            {accountOptions.map((option) => {
              const allowed = isModeAllowed(option.value, platformAccess);
              return (
                <button
                  type="button"
                  key={option.value}
                  disabled={!allowed}
                  className={`${accountMode === option.value ? "store-mode-option selected" : "store-mode-option"}${allowed ? "" : " locked"}`}
                  onClick={() => allowed && setAccountMode(option.value)}
                  aria-pressed={accountMode === option.value}
                >
                  <div className="store-mode-radio"><i/></div>
                  <div>
                    <div className="option-title-row">
                      <strong>{option.title}</strong>
                      {!allowed && <em>Not enabled</em>}
                    </div>
                    <p>{option.description}</p>
                    <ul>{option.points.map((point) => <li key={point}>{point}</li>)}</ul>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="access-summary">
            <span>Account access</span>
            <strong>
              {platformAccess.customPrint && platformAccess.brandMerch
                ? "Custom Print + Brand"
                : platformAccess.brandMerch
                  ? "Brand / Merch"
                  : "Custom Print"}
            </strong>
            <small>Contact PrintFlow Admin if this account needs another commerce capability enabled.</small>
          </div>
        </section>

        <section className={brandEnabled ? "admin-card store-mode-card" : "admin-card store-mode-card disabled-section"}>
          <div className="store-mode-section-heading">
            <div><span>2</span><div><h2>Brand storefront format</h2><p>Choose how the Brand/Merch experience will be published.</p></div></div>
            {!brandEnabled && <em>Brand mode required</em>}
          </div>

          <div className="storefront-mode-options">
            {storefrontOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                disabled={!brandEnabled}
                className={storefrontMode === option.value ? "storefront-mode-option selected" : "storefront-mode-option"}
                onClick={() => setStorefrontMode(option.value)}
              >
                <span>{storefrontMode === option.value ? "✓" : ""}</span>
                <div><strong>{option.title}</strong><p>{option.description}</p></div>
              </button>
            ))}
          </div>

          {brandEnabled && (
            <div className="store-mode-foundation-note">
              <strong>Brand publishing</strong>
              <p>The preference is saved now. Dedicated Brand full-store and seamless-embed customer routes are connected after the Design Library workflow is complete.</p>
            </div>
          )}
        </section>

        <aside className="admin-card store-mode-summary">
          <p className="section-kicker">CURRENT CHOICE</p>
          <h2>{accountOptions.find((option) => option.value === accountMode)?.title}</h2>
          <p>{summary}</p>
          {brandEnabled && <div><span>Brand publishing</span><strong>{storefrontOptions.find((option) => option.value === storefrontMode)?.title}</strong></div>}
          <div className="store-mode-summary-actions">
            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}
            <button className="primary-button" type="button" disabled={!dirty || busy} onClick={save}>
              {busy ? "Saving…" : dirty ? "Save store mode" : "Saved"}
            </button>
            <small>Changes affect this shop only. Existing orders are never converted or rewritten.</small>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .store-mode-header { max-width: 960px; }
        .store-mode-layout { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(290px,.55fr); gap:18px; align-items:start; }
        .store-mode-card { padding:24px; grid-column:1; }
        .store-mode-summary { grid-column:2; grid-row:1 / span 2; position:sticky; top:24px; padding:22px; }
        .store-mode-section-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:18px; }
        .store-mode-section-heading > div { display:flex; gap:12px; align-items:flex-start; }
        .store-mode-section-heading > div > span { display:grid; place-items:center; width:28px; height:28px; flex:0 0 28px; border-radius:999px; background:#111; color:#fff; font-size:12px; font-weight:800; }
        .store-mode-section-heading h2 { margin:0 0 4px; font-size:18px; }
        .store-mode-section-heading p { margin:0; color:#747474; font-size:12px; line-height:1.45; }
        .store-mode-section-heading em { padding:6px 9px; border-radius:999px; background:#f2f2ee; color:#777; font-size:10px; font-style:normal; font-weight:750; }
        .store-mode-options { display:grid; gap:10px; }
        .store-mode-option { width:100%; display:grid; grid-template-columns:26px minmax(0,1fr); gap:12px; padding:16px; border:1px solid #deded8; border-radius:14px; background:#fff; color:#171717; text-align:left; cursor:pointer; transition:.16s ease; }
        .store-mode-option:hover:not(:disabled) { border-color:#aaa; transform:translateY(-1px); }
        .store-mode-option.selected { border-color:#171717; box-shadow:inset 0 0 0 1px #171717; background:#fafaf7; }
        .store-mode-option.locked { opacity:.48; cursor:not-allowed; }
        .store-mode-radio { width:20px; height:20px; border:1px solid #aaa; border-radius:999px; display:grid; place-items:center; margin-top:1px; }
        .selected .store-mode-radio { border-color:#111; }
        .selected .store-mode-radio i { width:10px; height:10px; border-radius:999px; background:#111; }
        .option-title-row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .option-title-row em { font-style:normal; font-size:9px; color:#777; }
        .store-mode-option strong { display:block; margin-bottom:4px; font-size:14px; }
        .store-mode-option p { margin:0; color:#6e6e6e; font-size:11px; line-height:1.45; }
        .store-mode-option ul { display:flex; flex-wrap:wrap; gap:5px; margin:10px 0 0; padding:0; list-style:none; }
        .store-mode-option li { padding:4px 6px; border-radius:7px; background:#f1f1ed; color:#666; font-size:9px; }
        .access-summary { display:grid; gap:3px; margin-top:14px; padding:12px 14px; border-radius:11px; background:#f4f4ef; }
        .access-summary span { font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#777; }
        .access-summary strong { font-size:12px; }
        .access-summary small { font-size:9px; color:#777; line-height:1.4; }
        .storefront-mode-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
        .storefront-mode-option { min-width:0; padding:14px; border:1px solid #deded8; border-radius:12px; background:#fff; color:#171717; text-align:left; cursor:pointer; }
        .storefront-mode-option > span { display:grid; place-items:center; width:20px; height:20px; margin-bottom:10px; border-radius:6px; background:#f1f1ed; font-size:10px; }
        .storefront-mode-option strong { display:block; margin-bottom:4px; font-size:12px; }
        .storefront-mode-option p { margin:0; color:#747474; font-size:10px; line-height:1.4; }
        .storefront-mode-option.selected { border-color:#171717; background:#fafaf7; box-shadow:inset 0 0 0 1px #171717; }
        .storefront-mode-option.selected > span { background:#171717; color:#fff; }
        .storefront-mode-option:disabled { opacity:.46; cursor:not-allowed; }
        .disabled-section { background:#fafafa; }
        .store-mode-foundation-note { margin-top:14px; padding:12px 14px; border-radius:11px; background:#f4f4ef; }
        .store-mode-foundation-note strong { display:block; margin-bottom:3px; font-size:11px; }
        .store-mode-foundation-note p { margin:0; color:#6d6d6d; font-size:10px; line-height:1.45; }
        .store-mode-summary h2 { margin:5px 0 6px; font-size:20px; }
        .store-mode-summary > p:not(.section-kicker) { margin:0 0 18px; color:#707070; font-size:11px; line-height:1.5; }
        .store-mode-summary > div:not(.store-mode-summary-actions) { display:grid; gap:3px; padding:12px 0; border-top:1px solid #e8e8e3; }
        .store-mode-summary > div span { color:#777; font-size:9px; text-transform:uppercase; letter-spacing:.08em; }
        .store-mode-summary > div strong { font-size:12px; }
        .store-mode-summary-actions { display:grid; gap:10px; margin-top:16px; padding-top:16px; border-top:1px solid #e8e8e3; }
        .store-mode-summary-actions button { width:100%; }
        .store-mode-summary-actions small { color:#7b7b7b; font-size:9px; line-height:1.45; text-align:center; }
        @media (max-width:980px) {
          .store-mode-layout { grid-template-columns:1fr; }
          .store-mode-card,.store-mode-summary { grid-column:1; grid-row:auto; }
          .store-mode-summary { position:static; }
        }
        @media (max-width:640px) {
          .store-mode-card,.store-mode-summary { padding:17px; }
          .storefront-mode-options { grid-template-columns:1fr; }
          .store-mode-option { padding:13px; }
          .store-mode-section-heading { display:grid; }
        }
      `}</style>
    </>
  );
}
