"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = useMemo(() => password.length >= 8 && password === confirmPassword, [password, confirmPassword]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!valid) return setError("Use at least 8 characters and make sure both passwords match.");
    setBusy(true);
    const supabase = createSupabaseBrowser();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    router.replace("/onboarding");
    router.refresh();
  }

  return <form className="launch-auth-form" onSubmit={submit}>
    <label><span>Create password</span><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
    <label><span>Confirm password</span><input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat password" /></label>
    <div className={valid ? "password-status ready" : "password-status"}><i/><span>{valid ? "Passwords match" : "Use 8+ matching characters"}</span></div>
    {error && <div className="error-message">{error}</div>}
    <button className="launch-primary" disabled={busy}>{busy ? "Saving password…" : "Save password and continue"}</button>
  </form>;
}
