"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function AdvancedAdminLoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) return setError(authError.message);
    router.replace("/advanced-admin");
    router.refresh();
  }

  return (
    <div className="ae-login-methods">
      <GoogleAuthButton next="/advanced-admin" label="Sign in with Google" />
      <div className="ae-login-divider"><span>or use email</span></div>
      <form onSubmit={submit} className="ae-login-form">
        <label><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label><span>Password</span><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <div className="ae-alert error">{error}</div>}
        <button className="ae-button primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
