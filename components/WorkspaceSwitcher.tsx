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
      router.push(workspace === "brand" ? "/dashboard/designs" : "/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-switcher" aria-label="PrintFlow workspace">
      <button type="button" disabled={busy} className={current === "print" ? "active" : ""} onClick={() => choose("print")}>
        <span>PRINT</span><b>Print Shop</b>
      </button>
      <button type="button" disabled={busy} className={current === "brand" ? "active" : ""} onClick={() => choose("brand")}>
        <span>BRAND</span><b>Brand / Merch</b>
      </button>
    </div>
  );
}
