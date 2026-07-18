import Link from "next/link";
import SignupForm from "@/components/SignupForm";

export default function SignupPage() {
  return <main className="launch-auth-shell">
    <Link href="/" className="launch-wordmark"><span>PF</span> PRINTFLOW</Link>
    <div className="launch-auth-layout">
      <section className="launch-auth-copy">
        <p className="launch-kicker">START SELLING CUSTOM APPAREL</p>
        <h1>Your storefront, pricing, suppliers, and production files—one flow.</h1>
        <p>Create your shop, connect live payments, import S&S products, and launch a branded ordering page.</p>
        <div className="launch-proof-list"><span>✓ Native Stripe or Square checkout</span><span>✓ Live S&S catalog and SKU mapping</span><span>✓ Production-ready artwork and mockups</span></div>
      </section>
      <section className="launch-auth-card"><div><small>ACCOUNT 1 OF 2</small><h2>Create your owner login</h2><p>You’ll configure the shop immediately after confirming your email.</p></div><SignupForm /></section>
    </div>
  </main>;
}
