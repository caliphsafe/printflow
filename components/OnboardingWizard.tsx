"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Existing = { hasShop: boolean; shopSlug?: string };

export default function OnboardingWizard({ existing }: { existing: Existing }) {
  const router = useRouter();
  const [step, setStep] = useState(existing.hasShop ? 2 : 1);
  const [shop, setShop] = useState({ businessName: "", slug: "", contactEmail: "", phone: "", primaryColor: "#171717", accentColor: "#d8ff5f", headline: "" });
  const [stripe, setStripe] = useState("");
  const [square, setSquare] = useState({ accessToken: "", environment: "production" });
  const [ss, setSs] = useState({ accountNumber: "", apiKey: "" });
  const [status, setStatus] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function bootstrap() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/onboarding/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(shop) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create shop.");
      setStatus(v=>({...v,shop:"Shop created"})); setStep(2); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create shop."); }
    finally { setBusy(false); }
  }

  async function connectPayment(provider: "stripe"|"square") {
    setBusy(true); setError("");
    try {
      const credentials = provider === "stripe" ? { secretKey: stripe } : square;
      const response = await fetch("/api/admin/integrations/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, credentials }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to connect ${provider}.`);
      setStatus(v=>({...v,payment:`${provider === "stripe" ? "Stripe" : "Square"} connected live`}));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  async function connectSupplier() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/suppliers/ss/connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ss, testMode: false }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to connect S&S.");
      setStatus(v=>({...v,supplier:"S&S connected live"}));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  async function launch() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/onboarding/complete", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to complete onboarding.");
      router.replace("/dashboard"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to launch."); }
    finally { setBusy(false); }
  }

  return <div className="onboarding-shell">
    <aside className="onboarding-rail"><div className="launch-wordmark"><span>PF</span> PRINTFLOW</div><p>Launch checklist</p>{["Shop identity","Live payments","Supplier catalog","Pricing & launch"].map((label,index)=><button key={label} className={step===index+1?"active":step>index+1?"complete":""} onClick={()=>existing.hasShop || index===0 ? setStep(index+1):undefined}><i>{step>index+1?"✓":index+1}</i><span>{label}</span></button>)}</aside>
    <main className="onboarding-main">
      <header><small>SETUP {step} OF 4</small><h1>{["Create the shop","Connect real checkout","Connect your supplier","Review and launch"][step-1]}</h1><p>{["Set the public identity customers will see.","Choose at least one hosted payment provider.","Import real products, prices, inventory, and SKUs.","Finish pricing, products, and storefront from the dashboard."][step-1]}</p></header>
      {error && <div className="error-message">{error}</div>}
      {step===1 && <section className="onboarding-card"><div className="onboarding-grid"><label><span>Business name</span><input required value={shop.businessName} onChange={e=>setShop(v=>({...v,businessName:e.target.value}))}/></label><label><span>Preferred shop URL</span><div className="slug-input"><span>/s/</span><input value={shop.slug} onChange={e=>setShop(v=>({...v,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))}/></div></label><label><span>Customer contact email</span><input type="email" value={shop.contactEmail} onChange={e=>setShop(v=>({...v,contactEmail:e.target.value}))}/></label><label><span>Phone</span><input value={shop.phone} onChange={e=>setShop(v=>({...v,phone:e.target.value}))}/></label><label><span>Primary color</span><input type="color" value={shop.primaryColor} onChange={e=>setShop(v=>({...v,primaryColor:e.target.value}))}/></label><label><span>Accent color</span><input type="color" value={shop.accentColor} onChange={e=>setShop(v=>({...v,accentColor:e.target.value}))}/></label><label className="full"><span>Storefront headline</span><input value={shop.headline} onChange={e=>setShop(v=>({...v,headline:e.target.value}))} placeholder="Create something great with us"/></label></div><div className="onboarding-actions"><button className="launch-primary" disabled={busy||!shop.businessName} onClick={bootstrap}>{busy?"Creating shop…":"Create shop and continue"}</button></div></section>}
      {step===2 && <section className="onboarding-stack"><article className="onboarding-card connection-setup-card"><div><span className="live-dot"/><h2>Stripe Checkout</h2><p>Use an `sk_test_` key while validating the workflow, then reconnect with `sk_live_` before launch. PrintFlow creates the webhook automatically.</p></div><label><span>Stripe secret key</span><input type="password" value={stripe} onChange={e=>setStripe(e.target.value)} placeholder="sk_live_…"/></label><button className="launch-primary" disabled={busy||!stripe} onClick={()=>connectPayment("stripe")}>{status.payment?.includes("Stripe")?"Stripe connected ✓":"Connect Stripe live"}</button></article><article className="onboarding-card connection-setup-card"><div><span className="live-dot"/><h2>Square Checkout</h2><p>Use a Square application personal access token. PrintFlow chooses an active location and creates the payment webhook.</p></div><label><span>Access token</span><input type="password" value={square.accessToken} onChange={e=>setSquare(v=>({...v,accessToken:e.target.value}))}/></label><label><span>Environment</span><select value={square.environment} onChange={e=>setSquare(v=>({...v,environment:e.target.value}))}><option value="production">Production</option><option value="sandbox">Sandbox</option></select></label><button className="launch-secondary" disabled={busy||!square.accessToken} onClick={()=>connectPayment("square")}>{status.payment?.includes("Square")?"Square connected ✓":"Connect Square"}</button></article><div className="onboarding-actions"><button className="launch-secondary" onClick={()=>setStep(3)}>Continue to supplier</button></div></section>}
      {step===3 && <section className="onboarding-stack"><article className="onboarding-card connection-setup-card"><div><span className="live-dot"/><h2>S&amp;S Activewear</h2><p>Connect the shop’s wholesale account to browse and import the live catalog. New onboarding uses live ordering mode—not demo mode.</p></div><div className="onboarding-grid"><label><span>Account number</span><input value={ss.accountNumber} onChange={e=>setSs(v=>({...v,accountNumber:e.target.value}))}/></label><label><span>API key</span><input type="password" value={ss.apiKey} onChange={e=>setSs(v=>({...v,apiKey:e.target.value}))}/></label></div><button className="launch-primary" disabled={busy||!ss.accountNumber||!ss.apiKey} onClick={connectSupplier}>{status.supplier?"S&S connected ✓":"Connect live S&S catalog"}</button></article><div className="onboarding-actions"><button className="launch-secondary" onClick={()=>setStep(4)}>Continue</button></div></section>}
      {step===4 && <section className="onboarding-card launch-review-card"><div className="launch-review-grid"><div><span>Shop</span><strong>{status.shop||"Created"}</strong></div><div><span>Payments</span><strong>{status.payment||"Complete in Integrations"}</strong></div><div><span>Supplier</span><strong>{status.supplier||"Complete in Suppliers"}</strong></div><div><span>Pricing</span><strong>Production defaults installed</strong></div></div><div className="launch-next-list"><h2>Next inside the dashboard</h2><p>1. Review method pricing and quantity breaks.</p><p>2. Import S&S products or create manual products.</p><p>3. Customize the storefront and publish it.</p></div><div className="onboarding-actions"><button className="launch-primary" disabled={busy} onClick={launch}>{busy?"Launching…":"Enter my dashboard"}</button></div></section>}
    </main>
  </div>;
}
