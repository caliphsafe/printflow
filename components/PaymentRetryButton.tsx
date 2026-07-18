"use client";
import { useState } from "react";

export default function PaymentRetryButton({ displayId }: { displayId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function retry() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/payments/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to open checkout.");
      window.location.href = data.checkoutUrl;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to open checkout."); setBusy(false); }
  }
  return <div className="payment-retry-action"><button className="designer-primary" type="button" onClick={retry} disabled={busy}>{busy ? "Opening secure checkout…" : "Continue to secure payment"}</button>{error && <div className="error-message">{error}</div>}</div>;
}
