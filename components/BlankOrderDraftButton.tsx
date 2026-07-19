"use client";

import Link from "next/link";
import { useState } from "react";

type ExistingCart = { estimated_total?: number; status?: string } | null;

export default function BlankOrderDraftButton({
  designId,
  enabled,
  existing
}: {
  designId: string;
  enabled: boolean;
  existing?: ExistingCart;
}) {
  const [busy, setBusy] = useState(false);
  const [cart, setCart] = useState(existing || null);
  const [message, setMessage] = useState("");

  async function addToCart() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${designId}/blank-draft`, { method: "POST" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to add the blanks to the supplier cart.");
    const carts = Array.isArray(data.carts) ? data.carts : [];
    const total = carts.reduce((sum: number, item: any) => sum + Number(item.estimated_total || 0), 0);
    setCart({ status: "cart", estimated_total: total });
    setMessage("Supplier items added to cart.");
  }

  if (cart) {
    return (
      <div className="supplier-cart-confirmation">
        <div><span>Supplier cart</span><strong>${Number(cart.estimated_total || 0).toFixed(2)} estimated blank cost</strong></div>
        <Link className="secondary-button" href="/dashboard/suppliers/cart">Supplier cart</Link>
      </div>
    );
  }

  return (
    <div className="order-blanks-panel">
      <button className="secondary-button" disabled={!enabled || busy} onClick={addToCart}>
        {busy ? "Adding…" : "Add blanks to supplier cart"}
      </button>
      {!enabled && <p>Supplier SKUs are required before the job can be added to the cart.</p>}
      {message && <div className={message.includes("added") ? "success-message" : "error-message catalog-message"}>{message}</div>}
    </div>
  );
}
