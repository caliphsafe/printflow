"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function GoogleAuthButton({
  next = "/dashboard",
  plan = "growth",
  label = "Continue with Google"
}: {
  next?: string;
  plan?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startGoogle() {
    setBusy(true);
    setError("");
    try {
      const supabase = createSupabaseBrowser();
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", next);
      callback.searchParams.set("plan", plan);
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          queryParams: { prompt: "select_account" }
        }
      });
      if (authError) throw authError;
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : "Google sign-in could not start.");
    }
  }

  return <div className="google-auth-wrap">
    <button type="button" className="google-auth-button" onClick={startGoogle} disabled={busy}>
      <span className="google-auth-mark" aria-hidden="true">G</span>
      <span>{busy ? "Opening Google…" : label}</span>
    </button>
    {error && <div className="error-message compact">{error}</div>}
  </div>;
}
