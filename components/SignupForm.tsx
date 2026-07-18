"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const supabase = createSupabaseBrowser();
    const redirectTo = `${window.location.origin}/onboarding`;
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: redirectTo, data: { full_name: form.name } }
    });
    setBusy(false);
    if (authError) return setError(authError.message);
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
    } else {
      setNotice("Check your email to confirm your account, then continue to shop setup.");
    }
  }

  return <form className="launch-auth-form" onSubmit={submit}>
    <label><span>Your name</span><input required autoComplete="name" value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} placeholder="Alex Morgan" /></label>
    <label><span>Work email</span><input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} placeholder="you@printshop.com" /></label>
    <label><span>Password</span><input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))} placeholder="At least 8 characters" /></label>
    {error && <div className="error-message">{error}</div>}
    {notice && <div className="launch-success-note">{notice}</div>}
    <button className="launch-primary" disabled={busy}>{busy ? "Creating account…" : "Create my PrintFlow account"}</button>
    <p className="launch-auth-foot">Already have an account? <Link href="/login">Sign in</Link></p>
  </form>;
}
