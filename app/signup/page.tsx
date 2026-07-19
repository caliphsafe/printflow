import Link from "next/link";
import SignupForm from "@/components/SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return <main className="launch-auth-shell glass-auth-shell">
    <Link href="/" className="launch-wordmark"><span>PF</span> PRINTFLOW</Link>
    <div className="launch-auth-layout">
      <section className="launch-auth-copy"><p className="launch-kicker">START YOUR PRINTFLOW SHOP</p><h1>Go from signup to a ready-to-sell apparel storefront.</h1><p>Use Google for the fastest start or create an email account. Guided setup walks through your business, payments, supplier, pricing, products, and storefront.</p><div className="launch-proof-list"><span>✓ 14-day trial</span><span>✓ Google or email signup</span><span>✓ Guided setup with examples</span><span>✓ Secure supplier and payment connections</span></div></section>
      <section className="launch-auth-card glass-panel"><div><small>ACCOUNT CREATION</small><h2>Create the owner account</h2><p>Google continues immediately. Email signup uses a secure confirmation link.</p></div><SignupForm initialPlan={plan} /></section>
    </div>
  </main>;
}
