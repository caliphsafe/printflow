"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const planNames: Record<string, string> = { starter: "Starter", growth: "Growth", scale: "Scale" };

export default function SignupForm({ initialPlan = "growth" }: { initialPlan?: string }) {
  const router = useRouter();
  const plan = planNames[initialPlan] ? initialPlan : "growth";
  const [form, setForm] = useState({ name: "", businessName: "", email: "", password: "", confirmPassword: "" });
  const [verificationEmail, setVerificationEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const passwordReady = useMemo(() => form.password.length >= 8 && form.password === form.confirmPassword, [form.password, form.confirmPassword]);

  function callbackUrl() {
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", "/onboarding");
    callback.searchParams.set("plan", plan);
    return callback.toString();
  }

  useEffect(() => {
    if (!verificationEmail) return;
    const supabase = createSupabaseBrowser();
    const timer = window.setInterval(async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        window.clearInterval(timer);
        router.replace("/onboarding");
        router.refresh();
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [verificationEmail, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setNotice("");
    if (!passwordReady) return setError("Use at least 8 characters and make sure both passwords match.");
    setBusy(true);
    const supabase = createSupabaseBrowser();
    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: callbackUrl(),
        data: { full_name: form.name, business_name: form.businessName, selected_plan: plan }
      }
    });
    setBusy(false);
    if (authError) return setError(authError.message);
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
    } else {
      setVerificationEmail(form.email);
      setCooldown(60);
    }
  }

  async function resend() {
    if (!verificationEmail || cooldown > 0) return;
    setResending(true); setError(""); setNotice("");
    const supabase = createSupabaseBrowser();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: verificationEmail,
      options: { emailRedirectTo: callbackUrl() }
    });
    setResending(false);
    if (resendError) return setError(resendError.message);
    setNotice("A new confirmation email is on the way.");
    setCooldown(60);
  }

  async function checkVerification() {
    setBusy(true); setError("");
    const supabase = createSupabaseBrowser();
    const { data, error: userError } = await supabase.auth.getUser();
    setBusy(false);
    if (data.user) {
      router.replace("/onboarding");
      router.refresh();
      return;
    }
    setError(userError?.message || "We do not see a verified session yet. Open the newest email and use its confirmation button.");
  }

  if (verificationEmail) {
    return <div className="verification-panel" aria-live="polite">
      <div className="verification-icon">✉</div>
      <div><p className="eyebrow">CHECK YOUR INBOX</p><h3>Confirm {verificationEmail}</h3><p>Use the button in the newest PrintFlow email. It will securely return you to guided shop setup.</p></div>
      <ol className="verification-steps"><li>Check Inbox, Promotions, and Spam.</li><li>Open the newest PrintFlow confirmation.</li><li>Select the confirmation button to continue.</li></ol>
      {notice && <div className="launch-success-note">{notice}</div>}
      {error && <div className="error-message">{error}</div>}
      <button type="button" className="launch-primary" onClick={checkVerification} disabled={busy}>{busy ? "Checking…" : "I confirmed my email"}</button>
      <button type="button" className="launch-secondary" onClick={resend} disabled={resending || cooldown > 0}>{resending ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend confirmation email"}</button>
      <button type="button" className="text-button" onClick={() => { setVerificationEmail(""); setError(""); setNotice(""); }}>Use a different email</button>
      <small className="verification-support-note">For production delivery, the platform owner should connect a custom email provider in Supabase Authentication settings.</small>
    </div>;
  }

  return <div className="auth-method-stack">
    <GoogleAuthButton next="/onboarding" plan={plan} label="Create account with Google" />
    <div className="auth-divider"><span>or use work email</span></div>
    <form className="launch-auth-form optimized" onSubmit={submit}>
      <div className="signup-plan-chip"><span>Selected plan</span><strong>{planNames[plan]}</strong><Link href="/#pricing">Change</Link></div>
      <div className="signup-two-column"><label><span>Your name</span><input required autoComplete="name" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="Alex Morgan" /></label><label><span>Business name</span><input required autoComplete="organization" value={form.businessName} onChange={e => setForm(v => ({ ...v, businessName: e.target.value }))} placeholder="Morgan Print Co." /></label></div>
      <label><span>Work email</span><input required type="email" autoComplete="email" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} placeholder="you@printshop.com" /></label>
      <div className="signup-two-column"><label><span>Password</span><input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} placeholder="At least 8 characters" /></label><label><span>Confirm password</span><input required minLength={8} type="password" autoComplete="new-password" value={form.confirmPassword} onChange={e => setForm(v => ({ ...v, confirmPassword: e.target.value }))} placeholder="Repeat password" /></label></div>
      <div className={passwordReady ? "password-status ready" : "password-status"}><i /> <span>{passwordReady ? "Passwords match" : "Use 8+ matching characters"}</span></div>
      {error && <div className="error-message">{error}</div>}
      <button className="launch-primary" disabled={busy}>{busy ? "Creating your account…" : "Create account and continue"}</button>
      <p className="launch-auth-terms">By continuing, you agree to operate your storefront responsibly and use supplier and payment credentials you are authorized to access.</p>
      <p className="launch-auth-foot">Already have an account? <Link href="/login">Sign in</Link></p>
    </form>
  </div>;
}
