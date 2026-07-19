"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const planNames: Record<string, string> = { starter: "Starter", growth: "Growth", scale: "Scale" };

export default function SignupForm({ initialPlan = "growth" }: { initialPlan?: string }) {
  const router = useRouter();
  const plan = planNames[initialPlan] ? initialPlan : "growth";
  const [form, setForm] = useState({ name: "", businessName: "", email: "", password: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const passwordReady = useMemo(() => form.password.length >= 8 && form.password === form.confirmPassword, [form.password, form.confirmPassword]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setNotice("");
    if (!passwordReady) return setError("Use at least 8 characters and make sure both passwords match.");
    setBusy(true);
    const supabase = createSupabaseBrowser();
    const redirectTo = `${window.location.origin}/onboarding`;
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: redirectTo, data: { full_name: form.name, business_name: form.businessName, selected_plan: plan } }
    });
    setBusy(false);
    if (authError) return setError(authError.message);
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
    } else {
      setNotice("Your account is ready. Confirm the email we sent you to continue setting up the shop.");
    }
  }

  return <form className="launch-auth-form optimized" onSubmit={submit}>
    <div className="signup-plan-chip"><span>Selected plan</span><strong>{planNames[plan]}</strong><Link href="/#pricing">Change</Link></div>
    <div className="signup-two-column"><label><span>Your name</span><input required autoComplete="name" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="Alex Morgan" /></label><label><span>Business name</span><input required autoComplete="organization" value={form.businessName} onChange={e => setForm(v => ({ ...v, businessName: e.target.value }))} placeholder="Morgan Print Co." /></label></div>
    <label><span>Work email</span><input required type="email" autoComplete="email" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} placeholder="you@printshop.com" /></label>
    <div className="signup-two-column"><label><span>Password</span><input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} placeholder="At least 8 characters" /></label><label><span>Confirm password</span><input required minLength={8} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={e => setForm(v => ({ ...v, confirmPassword: e.target.value }))} placeholder="Repeat password" /></label></div>
    <div className={passwordReady ? "password-status ready" : "password-status"}><i /> <span>{passwordReady ? "Passwords match" : "Use 8+ matching characters"}</span></div>
    {error && <div className="error-message">{error}</div>}
    {notice && <div className="launch-success-note">{notice}</div>}
    <button className="launch-primary" disabled={busy}>{busy ? "Creating your account…" : "Continue to shop setup"}</button>
    <p className="launch-auth-terms">By continuing, you agree to operate your storefront responsibly and use supplier and payment credentials you are authorized to access.</p>
    <p className="launch-auth-foot">Already have an account? <Link href="/login">Sign in</Link></p>
  </form>;
}
