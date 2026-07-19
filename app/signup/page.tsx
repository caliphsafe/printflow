import Link from "next/link";
import SignupForm from "@/components/SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return <main className="launch-auth-shell glass-auth-shell">
    <Link href="/" className="launch-wordmark"><span>PF</span> PRINTFLOW</Link>
    <div className="launch-auth-layout">
      <section className="launch-auth-copy"><p className="launch-kicker">START YOUR PRINTFLOW SHOP</p><h1>Go from account creation to a branded ordering storefront in one guided setup.</h1><p>We’ll help you create the shop, connect payment and supplier accounts, review pricing, and publish your customer experience.</p><div className="launch-proof-list"><span>✓ 14-day trial</span><span>✓ Guided setup checklist</span><span>✓ Secure encrypted connections</span><span>✓ Keep full control of pricing and supplier purchasing</span></div></section>
      <section className="launch-auth-card glass-panel"><div><small>STEP 1 OF 2</small><h2>Create the owner account</h2><p>After email confirmation, shop setup continues automatically.</p></div><SignupForm initialPlan={plan} /></section>
    </div>
  </main>;
}
