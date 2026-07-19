"use client";

import { useState } from "react";

export default function OrderBlanksButton({
  designId,
  enabled,
  testMode,
  alreadyOrdered,
  paymentStatus
}: {
  designId: string;
  enabled: boolean;
  testMode: boolean;
  alreadyOrdered: boolean;
  paymentStatus: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const paid = paymentStatus === "paid";

  async function order() {
    const paymentWarning = paid
      ? "Customer payment is confirmed."
      : "Customer payment has not been confirmed. You will be responsible for this supplier purchase even if the customer does not pay.";
    const modeWarning = testMode
      ? "S&S will create and cancel this as a test order."
      : "This will place a real wholesale order in your S&S account.";
    if (!confirm(`${paymentWarning}\n\n${modeWarning}\n\nContinue?`)) return;

    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${designId}/order-blanks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowBeforePayment: !paid })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to order blanks.");
    setMessage(`S&S order confirmed: ${(data.orderNumbers || []).join(", ") || "submitted"}`);
  }

  if (alreadyOrdered) return <div className="success-message">Blanks have been submitted to S&amp;S.</div>;

  return <div className="order-blanks-panel live-order-panel">
    {!paid && <div className="supplier-risk-note"><strong>Ordering before payment</strong><span>You can secure inventory now, but your shop accepts the payment risk.</span></div>}
    <button className="primary-button" disabled={!enabled || busy} onClick={order}>
      {busy ? "Submitting to S&S…" : testMode ? "Create S&S test order" : "Order blanks"}
    </button>
    {!enabled && <p>Connect S&amp;S, add supplier SKUs, and complete the delivery settings to order.</p>}
    {message && <div className={message.startsWith("S&S order") ? "success-message" : "error-message catalog-message"}>{message}</div>}
  </div>;
}
