import Link from "next/link";
import { redirect } from "next/navigation";
import SetPasswordForm from "@/components/SetPasswordForm";
import { createSupabaseServer } from "@/lib/supabase-server";

export default async function SetupPasswordPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <main className="launch-auth-shell glass-auth-shell">
    <Link href="/" className="launch-wordmark"><span>PF</span> PRINTFLOW</Link>
    <div className="launch-auth-layout compact-auth-layout">
      <section className="launch-auth-copy"><p className="launch-kicker">ACCOUNT INVITATION</p><h1>Your PrintFlow workspace is ready.</h1><p>Create a secure password, then follow the guided setup to prepare your storefront, pricing, supplier connection, and payment account.</p></section>
      <section className="launch-auth-card glass-panel"><div><small>FINAL ACCOUNT STEP</small><h2>Create your password</h2><p>{user.email}</p></div><SetPasswordForm/></section>
    </div>
  </main>;
}
