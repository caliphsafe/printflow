"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ShopAccountMode } from "@/lib/shop-mode";

const choices: Array<{ value: ShopAccountMode; number: string; title: string; text: string; detail: string }> = [
  {
    value: "custom",
    number: "01",
    title: "Run my print shop",
    text: "Customers choose garments, upload artwork, configure print options, and place custom orders.",
    detail: "Custom artwork · Screen print / DTF / embroidery · Production workflow"
  },
  {
    value: "brand",
    number: "02",
    title: "Run my brand",
    text: "Upload approved designs and let customers purchase them on garments you make available.",
    detail: "Design library · Light / dark variants · Full store + seamless embed"
  },
  {
    value: "hybrid",
    number: "03",
    title: "Run both",
    text: "Operate Custom Print and Brand/Merch experiences from one PrintFlow account.",
    detail: "Shared suppliers · Shared garments · One order and production system"
  }
];

export default function OnboardingPurposeGate() {
  const router = useRouter();
  const [busy, setBusy] = useState<ShopAccountMode | "">("");
  const [error, setError] = useState("");

  async function choose(accountMode: ShopAccountMode) {
    setBusy(accountMode);
    setError("");
    try {
      const response = await fetch("/api/onboarding/purpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountMode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save your choice.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save your choice.");
      setBusy("");
    }
  }

  return (
    <main className="onboarding-purpose-shell">
      <div className="onboarding-purpose-card">
        <header>
          <div className="launch-wordmark"><span>PF</span> PRINTFLOW</div>
          <p className="eyebrow">START WITH THE RIGHT WORKFLOW</p>
          <h1>How will you use PrintFlow?</h1>
          <p>Choose the commerce model for your first shop. The underlying products, suppliers, customers, and orders stay connected.</p>
        </header>

        <div className="onboarding-purpose-options">
          {choices.map((choice) => (
            <button key={choice.value} type="button" disabled={Boolean(busy)} onClick={() => choose(choice.value)}>
              <span>{choice.number}</span>
              <div>
                <strong>{choice.title}</strong>
                <p>{choice.text}</p>
                <small>{choice.detail}</small>
              </div>
              <b>{busy === choice.value ? "Saving…" : "Continue →"}</b>
            </button>
          ))}
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>

      <style jsx>{`
        .onboarding-purpose-shell { min-height:100dvh; display:grid; place-items:center; padding:24px; background:#f3f3ef; }
        .onboarding-purpose-card { width:min(1050px,100%); padding:32px; border:1px solid #e0e0da; border-radius:22px; background:#fff; box-shadow:0 20px 60px rgba(0,0,0,.06); }
        header { max-width:700px; margin-bottom:25px; }
        header h1 { margin:7px 0 8px; font-size:clamp(32px,5vw,52px); line-height:1; letter-spacing:-.045em; }
        header > p:last-child { margin:0; color:#6d6d6d; line-height:1.55; }
        .onboarding-purpose-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .onboarding-purpose-options button { display:grid; grid-template-columns:38px minmax(0,1fr); gap:13px; min-height:225px; padding:20px; border:1px solid #deded8; border-radius:16px; background:#fafaf7; color:#171717; text-align:left; cursor:pointer; }
        .onboarding-purpose-options button:hover:not(:disabled) { border-color:#171717; background:#fff; }
        .onboarding-purpose-options button > span { display:grid; place-items:center; width:34px; height:34px; border-radius:999px; background:#171717; color:#fff; font-size:10px; font-weight:800; }
        .onboarding-purpose-options strong { display:block; margin-bottom:7px; font-size:18px; }
        .onboarding-purpose-options p { margin:0; color:#686868; font-size:12px; line-height:1.5; }
        .onboarding-purpose-options small { display:block; margin-top:16px; color:#898989; font-size:9px; line-height:1.4; }
        .onboarding-purpose-options b { grid-column:2; align-self:end; font-size:11px; }
        @media(max-width:860px) { .onboarding-purpose-options { grid-template-columns:1fr; } .onboarding-purpose-options button { min-height:175px; } }
        @media(max-width:700px) { .onboarding-purpose-shell { padding:10px; } .onboarding-purpose-card { padding:20px; border-radius:17px; } }
      `}</style>
    </main>
  );
}
