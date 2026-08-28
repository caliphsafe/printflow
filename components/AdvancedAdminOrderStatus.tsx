"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const statuses = [
  ["paid", "New / Paid"],
  ["artwork_review", "Artwork Review"],
  ["awaiting_approval", "Awaiting Approval"],
  ["approved", "Approved"],
  ["ready_for_production", "Ready for Production"],
  ["in_production", "In Production"],
  ["quality_control", "Quality Control"],
  ["ready", "Ready for Pickup"],
  ["shipped", "Shipped"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"]
];

export default function AdvancedAdminOrderStatus({ orderId, current }: { orderId: string; current: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/advanced-admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update order.");
      setMessage("Status updated.");
      setNote("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update order.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="ae-status-editor">
    <label><span>Production status</span><select value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <label><span>Optional internal note</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: Called customer, artwork approved by email." /></label>
    <button className="ae-button primary" disabled={busy || status === current} onClick={save}>{busy ? "Saving…" : "Update status"}</button>
    {message && <div className={`ae-message ${message.includes("updated") ? "success" : "error"}`}>{message}</div>}
  </div>;
}
