import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return <main className="launch-auth-shell">
    <Link href="/" className="launch-wordmark"><span>PF</span> PRINTFLOW</Link>
    <div className="launch-auth-layout">
      <section className="launch-auth-copy"><p className="launch-kicker">WELCOME BACK</p><h1>Orders, pricing, suppliers, and production—all ready.</h1><p>Sign in to manage your storefront and process paid custom-apparel orders.</p></section>
      <section className="launch-auth-card"><div><small>SHOP OWNER LOGIN</small><h2>Sign in to PrintFlow</h2><p>Use the email and password connected to your shop.</p></div><LoginForm/><p className="launch-auth-foot">New to PrintFlow? <Link href="/signup">Create an account</Link></p></section>
    </div>
  </main>;
}
