"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const supabase = createSupabaseBrowser();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) return setError(authError.message);
    router.replace("/dashboard");
    router.refresh();
  }

  return <div className="auth-method-stack">
    <GoogleAuthButton next="/dashboard" label="Sign in with Google" />
    <div className="auth-divider"><span>or use email</span></div>
    <form onSubmit={submit} className="auth-form launch-auth-form">
      <label><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>
      <label><span>Password</span><input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
      {error && <div className="error-message">{error}</div>}
      <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </div>;
}
