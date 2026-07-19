"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Existing = { hasShop: boolean; shopSlug?: string; onboardingState?: any };
type Status = { paymentConnected: boolean; supplierConnected: boolean; pricingConfigured: boolean; productCount: number; storefrontActive: boolean; shopSlug?: string };
const steps = ["Business", "Payments", "Supplier", "Pricing", "Products", "Storefront", "Launch"];

export default function OnboardingWizard({ existing, selectedPlan = "growth", defaultBusinessName = "" }: { existing: Existing; selectedPlan?: string; defaultBusinessName?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(existing.hasShop ? 2 : 1);
  const [shop, setShop] = useState({ businessName: defaultBusinessName, slug: existing.shopSlug || "", contactEmail: "", phone: "", primaryColor: "#171717", accentColor: "#d8ff5f", headline: "", introduction: "", planCode: selectedPlan });
  const [stripe, setStripe] = useState("");
  const [square, setSquare] = useState({ accessToken: "", environment: "production" });
  const [ss, setSs] = useState({ accountNumber: "", apiKey: "" });
  const [pricing, setPricing] = useState({ garmentMarkupPercent: 10, orderSetupFee: 60, designOptimizationFee: 100, screenPrinting: true, dtf: true, embroidery: true });
  const [status, setStatus] = useState<Status>({ paymentConnected: false, supplierConnected: false, pricingConfigured: false, productCount: 0, storefrontActive: false, shopSlug: existing.shopSlug });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshStatus() {
    if (!existing.hasShop && step === 1) return;
    const response = await fetch("/api/onboarding/status", { cache: "no-store" });
    if (response.ok) setStatus(await response.json());
  }
  useEffect(() => { void refreshStatus(); }, []);

  async function markStep(next: number, skipped?: string) {
    setStep(next); setError(""); setNotice("");
    await fetch("/api/onboarding/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: steps[next - 1]?.toLowerCase(), skipped: skipped ? { [skipped]: true } : {} }) }).catch(() => undefined);
  }

  async function bootstrap() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/onboarding/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(shop) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create shop.");
      setStatus((value) => ({ ...value, shopSlug: data.shop?.slug }));
      setNotice("Business workspace created.");
      await markStep(2); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create shop."); }
    finally { setBusy(false); }
  }

  async function connectPayment(provider: "stripe" | "square") {
    setBusy(true); setError(""); setNotice("");
    try {
      const credentials = provider === "stripe" ? { secretKey: stripe } : square;
      const response = await fetch("/api/admin/integrations/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, credentials }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to connect ${provider}.`);
      setStatus((value) => ({ ...value, paymentConnected: true })); setNotice(`${provider === "stripe" ? "Stripe" : "Square"} is ready for checkout.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  async function connectSupplier() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/suppliers/ss/connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ss, testMode: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to connect S&S.");
      setStatus((value) => ({ ...value, supplierConnected: true })); setNotice("S&S is connected. Test ordering remains on until you choose live mode.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  async function savePricing() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/onboarding/pricing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pricing) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save pricing foundation.");
      setStatus((value) => ({ ...value, pricingConfigured: true })); setNotice("Pricing foundation saved. Detailed method rates can be refined later.");
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save pricing."); return false; }
    finally { setBusy(false); }
  }

  async function saveStorefront() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/onboarding/storefront", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ primaryColor: shop.primaryColor, accentColor: shop.accentColor, headline: shop.headline, introduction: shop.introduction, active: false }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save storefront.");
      setNotice("Storefront styling saved. It remains private until you publish.");
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save storefront."); return false; }
    finally { setBusy(false); }
  }

  async function complete(publish: boolean) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/onboarding/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publish }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to finish setup.");
      router.replace("/dashboard"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to finish setup."); }
    finally { setBusy(false); }
  }

  const done = [existing.hasShop || step > 1, status.paymentConnected, status.supplierConnected, status.pricingConfigured, status.productCount > 0, Boolean(shop.headline), false];
  return <div className="onboarding-shell onboarding-shell-v10">
    <aside className="onboarding-rail"><div className="launch-wordmark"><span>PF</span> PRINTFLOW</div><p>Guided setup</p>{steps.map((label,index)=><button key={label} className={step===index+1?"active":done[index]?"complete":""} onClick={()=>existing.hasShop || index===0 ? void markStep(index+1):undefined}><i>{done[index]?"✓":index+1}</i><span>{label}</span></button>)}<div className="onboarding-rail-note"><strong>Save now. Refine later.</strong><p>Every section can be completed here or skipped and finished from the dashboard.</p></div></aside>
    <main className="onboarding-main">
      <header><small>SETUP {step} OF {steps.length}</small><h1>{["Create your business workspace","Connect customer payments","Connect your blank supplier","Set the pricing foundation","Add products customers can order","Shape the storefront","Review launch readiness"][step-1]}</h1><p>{["Start with the identity customers and staff will see.","Choose Stripe or Square. You can skip and connect later.","Connect S&S for live products, costs, inventory, and ordering.","Set the shop-wide numbers that every quote begins with.","Import live supplier products or create your own items.","Choose the message and color system customers see first.","Publish now or enter the dashboard and finish later."][step-1]}</p></header>
      {error && <div className="error-message">{error}</div>}{notice && <div className="success-message">{notice}</div>}

      {step===1 && <section className="onboarding-card"><div className="onboarding-plan-summary"><span>Selected plan</span><strong>{selectedPlan.charAt(0).toUpperCase()+selectedPlan.slice(1)}</strong><small>Your trial starts with the new workspace.</small></div><div className="onboarding-grid"><label><span>Business name</span><input required value={shop.businessName} onChange={e=>setShop(v=>({...v,businessName:e.target.value}))}/></label><label><span>Storefront address</span><div className="slug-input"><span>/s/</span><input value={shop.slug} onChange={e=>setShop(v=>({...v,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")}))}/></div></label><label><span>Customer contact email</span><input type="email" value={shop.contactEmail} onChange={e=>setShop(v=>({...v,contactEmail:e.target.value}))}/></label><label><span>Business phone</span><input value={shop.phone} onChange={e=>setShop(v=>({...v,phone:e.target.value}))}/></label></div><div className="onboarding-actions"><button className="launch-primary" disabled={busy||!shop.businessName} onClick={bootstrap}>{busy?"Creating…":"Create business workspace"}</button></div></section>}

      {step===2 && <section className="onboarding-stack"><div className="onboarding-choice-grid"><article className="onboarding-card connection-setup-card"><div><span className="live-dot"/><h2>Stripe</h2><p>Hosted checkout, payment confirmation, and order updates.</p></div><label><span>Secret key</span><input type="password" value={stripe} onChange={e=>setStripe(e.target.value)} placeholder="sk_test_… or sk_live_…"/></label><button className="launch-primary" disabled={busy||!stripe} onClick={()=>connectPayment("stripe")}>{status.paymentConnected?"Connected ✓":"Connect Stripe"}</button></article><article className="onboarding-card connection-setup-card"><div><span className="live-dot"/><h2>Square</h2><p>Hosted payment links and payment confirmation.</p></div><label><span>Access token</span><input type="password" value={square.accessToken} onChange={e=>setSquare(v=>({...v,accessToken:e.target.value}))}/></label><label><span>Environment</span><select value={square.environment} onChange={e=>setSquare(v=>({...v,environment:e.target.value}))}><option value="production">Production</option><option value="sandbox">Sandbox</option></select></label><button className="launch-secondary" disabled={busy||!square.accessToken} onClick={()=>connectPayment("square")}>{status.paymentConnected?"Connected ✓":"Connect Square"}</button></article></div><div className="onboarding-actions split"><button className="text-button" onClick={()=>markStep(3,"payments")}>Skip for now</button><button className="launch-primary" onClick={()=>markStep(3)}>Continue</button></div></section>}

      {step===3 && <section className="onboarding-stack"><article className="onboarding-card connection-setup-card supplier-onboarding-card"><img src="/suppliers/ss-activewear.png" alt="S&S Activewear"/><div><h2>S&amp;S Activewear</h2><p>Browse live styles, import exact SKU costs, and submit wholesale blank orders. New accounts begin in safe test-order mode.</p></div><div className="onboarding-grid"><label><span>Account number</span><input value={ss.accountNumber} onChange={e=>setSs(v=>({...v,accountNumber:e.target.value}))}/></label><label><span>API key</span><input type="password" value={ss.apiKey} onChange={e=>setSs(v=>({...v,apiKey:e.target.value}))}/></label></div><button className="launch-primary" disabled={busy||!ss.accountNumber||!ss.apiKey} onClick={connectSupplier}>{status.supplierConnected?"Connected ✓":"Connect S&S"}</button></article><div className="onboarding-actions split"><button className="text-button" onClick={()=>markStep(4,"supplier")}>Skip for now</button><button className="launch-primary" onClick={()=>markStep(4)}>Continue</button></div></section>}

      {step===4 && <section className="onboarding-card"><div className="onboarding-grid pricing-onboarding-grid"><label><span>Garment markup</span><div className="field-with-unit"><input type="number" value={pricing.garmentMarkupPercent} onChange={e=>setPricing(v=>({...v,garmentMarkupPercent:Number(e.target.value)}))}/><b>%</b></div><small>Added to the actual supplier blank cost.</small></label><label><span>Order setup</span><div className="field-with-unit"><b>$</b><input type="number" value={pricing.orderSetupFee} onChange={e=>setPricing(v=>({...v,orderSetupFee:Number(e.target.value)}))}/></div></label><label><span>Design optimization</span><div className="field-with-unit"><b>$</b><input type="number" value={pricing.designOptimizationFee} onChange={e=>setPricing(v=>({...v,designOptimizationFee:Number(e.target.value)}))}/></div></label></div><div className="onboarding-method-switches">{[["screenPrinting","Screen Printing"],["dtf","DTF"],["embroidery","Embroidery"]].map(([key,label])=><label className="form-check form-switch" key={key}><input className="form-check-input" type="checkbox" checked={(pricing as any)[key]} onChange={e=>setPricing(v=>({...v,[key]:e.target.checked}))}/><span className="form-check-label">Offer {label}</span></label>)}</div><div className="onboarding-actions split"><button className="text-button" onClick={()=>markStep(5,"pricing")}>Use defaults for now</button><button className="launch-primary" disabled={busy} onClick={async()=>{if (await savePricing()) await markStep(5);}}>{busy?"Saving…":"Save pricing foundation"}</button></div></section>}

      {step===5 && <section className="onboarding-card onboarding-product-step"><div className="onboarding-readiness-feature"><span>{status.productCount}</span><div><h2>Active products</h2><p>Products need garment images, colors, sizes, real costs, and print zones before customers can order.</p></div></div><div className="onboarding-destination-grid"><Link href="/dashboard/suppliers/catalog" target="_blank"><b>Import from S&amp;S</b><span>Choose real supplier styles and colors.</span></Link><Link href="/dashboard/products" target="_blank"><b>Create a product</b><span>Add a manual or specialty-supplier item.</span></Link></div><button className="secondary-button" onClick={refreshStatus}>Refresh product count</button><div className="onboarding-actions split"><button className="text-button" onClick={()=>markStep(6,"products")}>Skip for now</button><button className="launch-primary" onClick={()=>markStep(6)}>Continue</button></div></section>}

      {step===6 && <section className="onboarding-card"><div className="onboarding-storefront-layout"><div className="onboarding-grid"><label><span>Primary color</span><input type="color" value={shop.primaryColor} onChange={e=>setShop(v=>({...v,primaryColor:e.target.value}))}/></label><label><span>Accent color</span><input type="color" value={shop.accentColor} onChange={e=>setShop(v=>({...v,accentColor:e.target.value}))}/></label><label className="full"><span>Storefront headline</span><input value={shop.headline} onChange={e=>setShop(v=>({...v,headline:e.target.value}))} placeholder="Custom apparel, made simple."/></label><label className="full"><span>Introduction</span><textarea rows={3} value={shop.introduction} onChange={e=>setShop(v=>({...v,introduction:e.target.value}))} placeholder="Choose a garment, upload artwork, and receive a production-ready quote."/></label></div><div className="onboarding-mini-preview" style={{background:shop.primaryColor,color:"#fff"}}><small>YOUR STOREFRONT</small><h2>{shop.headline||"Custom apparel, made simple."}</h2><p>{shop.introduction||"Your customer experience updates as you type."}</p><button style={{background:shop.accentColor}}>Choose a product</button></div></div><div className="onboarding-actions split"><button className="text-button" onClick={()=>markStep(7,"storefront")}>Skip for now</button><button className="launch-primary" disabled={busy} onClick={async()=>{if (await saveStorefront()) await markStep(7);}}>{busy?"Saving…":"Save storefront"}</button></div></section>}

      {step===7 && <section className="onboarding-card launch-review-card"><div className="launch-review-grid"><div><span>Payments</span><strong>{status.paymentConnected?"Ready":"Finish later"}</strong></div><div><span>Supplier</span><strong>{status.supplierConnected?"Ready":"Finish later"}</strong></div><div><span>Pricing</span><strong>{status.pricingConfigured?"Ready":"Defaults installed"}</strong></div><div><span>Products</span><strong>{status.productCount} active</strong></div></div><div className="launch-next-list"><h2>Choose how to continue</h2><p>Publish only when products, pricing, and a payment provider have been reviewed. You can enter the dashboard now and finish any skipped section later.</p></div><div className="onboarding-actions launch-final-actions"><button className="launch-secondary" disabled={busy} onClick={()=>complete(false)}>Finish in dashboard</button><button className="launch-primary" disabled={busy||!status.paymentConnected||status.productCount===0} onClick={()=>complete(true)}>{busy?"Finishing…":"Publish and enter dashboard"}</button></div></section>}
    </main>
  </div>;
}
