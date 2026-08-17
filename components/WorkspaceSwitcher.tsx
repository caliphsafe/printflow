"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WorkspaceSwitcher({ current }: { current: "print" | "brand" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function choose(workspace: "print" | "brand") {
    if (workspace === current || busy) return;
    setBusy(true);

    try {
      const response = await fetch("/api/admin/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace })
      });
      if (!response.ok) return;

      router.push(workspace === "brand" ? "/dashboard/brand" : "/dashboard/print");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-switcher-v2" aria-label="Choose PrintFlow business">
      <button type="button" disabled={busy} className={current === "print" ? "active print" : "print"} onClick={() => choose("print")}>
        <span>PRINT BUSINESS</span>
        <b>Print Shop</b>
        <small>Custom orders & production</small>
      </button>
      <button type="button" disabled={busy} className={current === "brand" ? "active brand" : "brand"} onClick={() => choose("brand")}>
        <span>RETAIL BUSINESS</span>
        <b>Brand / Merch</b>
        <small>Products, sales & margin</small>
      </button>
    </div>
  );
}
