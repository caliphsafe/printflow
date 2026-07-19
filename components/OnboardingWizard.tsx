"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Existing = { hasShop: boolean; shopSlug?: string; onboardingState?: any };
type Status = {
  paymentConnected: boolean;
  paymentProviders?: string[];
  supplierConnected: boolean;
  supplierProviders?: string[];
  pricingConfigured: boolean;
  productCount: number;
  storefrontActive: boolean;
  shopSlug?: string;
  onboardingState?: any;
};

type PricingState = {
  garmentMarkupPercent: number;
  orderSetupFee: number;
  designOptimizationFee: number;
  screenPrinting: boolean;
  dtf: boolean;
  embroidery: boolean;
};

const steps = [
  { key: "business", label: "Business", title: "Create your business workspace", summary: "Add the information customers and staff will recognize.", time: "2 minutes" },
  { key: "payments", label: "Payments", title: "Connect customer payments", summary: "Choose Stripe or Square so completed orders can be paid securely.", time: "3–5 minutes" },
  { key: "supplier", label: "Supplier", title: "Connect your blank supplier", summary: "Use S&S for live products, account pricing, inventory, and ordering.", time: "3 minutes" },
  { key: "pricing", label: "Pricing", title: "Set the pricing foundation", summary: "Set the numbers that protect margin and support every quote.", time: "4 minutes" },
  { key: "products", label: "Products", title: "Add products customers can order", summary: "Import supplier garments or create specialty products manually.", time: "5–10 minutes" },
  { key: "storefront", label: "Storefront", title: "Shape the customer experience", summary: "Choose brand colors and clear customer-facing language.", time: "3 minutes" },
  { key: "launch", label: "Launch", title: "Review launch readiness", summary: "Publish now or finish any remaining items from the dashboard.", time: "1 minute" }
];

function InfoTip({ text }: { text: string }) {
  return <span className="onboarding-tooltip" tabIndex={0} aria-label={text} data-tooltip={text}>?</span>;
}

function CoachCard({ title, children }: { title: string; children: ReactNode }) {
  return <aside className="onboarding-coach-card"><span className="onboarding-coach-icon">i</span><div><strong>{title}</strong>{children}</div></aside>;
}

function CredentialGuide({ title, steps: guideSteps, note, href, linkLabel }: { title: string; steps: string[]; note?: string; href?: string; linkLabel?: string }) {
  return <details className="credential-guide">
    <summary><span>How to get your {title} credentials</span><b>View steps</b></summary>
    <div><ol>{guideSteps.map((item) => <li key={item}>{item}</li>)}</ol>{note && <p>{note}</p>}{href && <a href={href} target="_blank" rel="noreferrer">{linkLabel || `Go to ${title}`} ↗</a>}</div>
  </details>;
}

export default function OnboardingWizard({
  existing,
  selectedPlan = "growth",
  defaultBusinessName = "",
  defaultOwnerName = "",
  defaultEmail = ""
}: {
  existing: Existing;
  selectedPlan?: string;
  defaultBusinessName?: string;
  defaultOwnerName?: string;
  defaultEmail?: string;
}) {
  const router = useRouter();
  const savedStepIndex = Math.max(0, steps.findIndex((item) => item.key === existing.onboardingState?.step));
  const [hasShop, setHasShop] = useState(existing.hasShop);
  const [step, setStep] = useState(existing.hasShop ? Math.max(2, savedStepIndex + 1) : 1);
  const [shop, setShop] = useState({
    ownerName: defaultOwnerName,
    businessName: defaultBusinessName,
    slug: existing.shopSlug || "",
    contactEmail: defaultEmail,
    phone: "",
    address: "",
    primaryColor: "#171717",
    accentColor: "#d8ff5f",
    headline: "",
    introduction: "",
    planCode: selectedPlan
  });
  const [stripe, setStripe] = useState("");
  const [square, setSquare] = useState({ accessToken: "", environment: "sandbox" });
  const [ss, setSs] = useState({ accountNumber: "", apiKey: "" });
  const [pricing, setPricing] = useState<PricingState>({ garmentMarkupPercent: 10, orderSetupFee: 60, designOptimizationFee: 100, screenPrinting: true, dtf: true, embroidery: true });
  const [status, setStatus] = useState<Status>({ paymentConnected: false, supplierConnected: false, pricingConfigured: false, productCount: 0, storefrontActive: false, shopSlug: existing.shopSlug });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeStep = steps[step - 1];
  const progress = Math.round((step / steps.length) * 100);
  const done = useMemo(() => [
    hasShop,
    status.paymentConnected,
    status.supplierConnected,
    status.pricingConfigured,
    status.productCount > 0,
    Boolean(shop.headline || existing.onboardingState?.storefrontSaved),
    false
  ], [hasShop, status, shop.headline, existing.onboardingState]);

  async function refreshStatus() {
    if (!hasShop) return;
    const response = await fetch("/api/onboarding/status", { cache: "no-store" });
    if (response.ok) {
      const next = await response.json();
      setStatus(next);
      if (next.shopSlug) setShop((value) => ({ ...value, slug: next.shopSlug }));
    }
  }

  useEffect(() => { void refreshStatus(); }, [hasShop]);
  useEffect(() => {
    const refresh = () => void refreshStatus();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [hasShop]);

  async function markStep(next: number, skipped?: string) {
    const bounded = Math.max(1, Math.min(steps.length, next));
    setStep(bounded); setError(""); setNotice("");
    if (!hasShop) return;
    await fetch("/api/onboarding/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: steps[bounded - 1]?.key, skipped: skipped ? { [skipped]: true } : {} })
    }).catch(() => undefined);
  }

  async function bootstrap() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/onboarding/bootstrap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(shop) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create the business workspace.");
      setHasShop(true);
      setStatus((value) => ({ ...value, shopSlug: data.shop?.slug }));
      setShop((value) => ({ ...value, slug: data.shop?.slug || value.slug }));
      setNotice("Your business workspace is ready.");
      await markStep(2);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create the business workspace."); }
    finally { setBusy(false); }
  }

  async function connectPayment(provider: "stripe" | "square") {
    setBusy(true); setError(""); setNotice("");
    try {
      const credentials = provider === "stripe" ? { secretKey: stripe } : square;
      const response = await fetch("/api/admin/integrations/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, credentials }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to connect ${provider}.`);
      setStatus((value) => ({ ...value, paymentConnected: true, paymentProviders: [provider] }));
      setNotice(`${provider === "stripe" ? "Stripe" : "Square"} is verified and ready for checkout.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  async function connectSupplier() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/suppliers/ss/connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ss, testMode: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to connect S&S.");
      setStatus((value) => ({ ...value, supplierConnected: true, supplierProviders: ["ss-activewear"] }));
      setNotice("S&S is connected. Test-order mode stays on until you intentionally switch to live purchasing.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connection failed."); }
    finally { setBusy(false); }
  }

  async function savePricing() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/onboarding/pricing", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pricing) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the pricing foundation.");
      setStatus((value) => ({ ...value, pricingConfigured: true }));
      setNotice("Pricing foundation saved. You can refine each production method from the dashboard.");
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save pricing."); return false; }
    finally { setBusy(false); }
  }

  async function saveStorefront() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/onboarding/storefront", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ primaryColor: shop.primaryColor, accentColor: shop.accentColor, headline: shop.headline, introduction: shop.introduction, active: false }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the storefront.");
      setNotice("Storefront style saved. It remains private until you publish.");
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save the storefront."); return false; }
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

  return <div className="onboarding-shell onboarding-shell-v11">
    <aside className="onboarding-rail">
      <div className="launch-wordmark"><span>PF</span> PRINTFLOW</div>
      <div className="onboarding-progress-copy"><p>Guided launch setup</p><strong>{progress}% complete</strong><div><i style={{ width: `${progress}%` }}/></div></div>
      <nav aria-label="Onboarding steps">{steps.map((item, index) => <button type="button" key={item.key} className={step === index + 1 ? "active" : done[index] ? "complete" : ""} onClick={() => (hasShop || index === 0) ? void markStep(index + 1) : undefined}><i>{done[index] ? "✓" : index + 1}</i><span><b>{item.label}</b><small>{done[index] ? "Ready" : item.time}</small></span></button>)}</nav>
      <div className="onboarding-rail-note"><strong>Nothing is locked in.</strong><p>Skip any section and return from the dashboard when you have the information.</p></div>
    </aside>

    <main className="onboarding-main">
      <header className="onboarding-page-heading"><div><small>STEP {step} OF {steps.length} · {activeStep.time}</small><h1>{activeStep.title}</h1><p>{activeStep.summary}</p></div>{step > 1 && <button type="button" className="secondary-button" onClick={() => markStep(step - 1)}>Back</button>}</header>
      {error && <div className="error-message onboarding-message">{error}</div>}
      {notice && <div className="success-message onboarding-message">{notice}</div>}

      {step === 1 && <div className="onboarding-stage-layout"><section className="onboarding-card onboarding-primary-card">
        <div className="onboarding-plan-summary"><span>Selected plan</span><strong>{selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}</strong><small>Your trial starts when the workspace is created.</small></div>
        <div className="onboarding-section-heading"><div><p className="eyebrow">BUSINESS PROFILE</p><h2>Start with the basics</h2></div><span>Customers will see the shop name and contact information.</span></div>
        <div className="onboarding-grid">
          <label><span>Owner name <InfoTip text="The person responsible for the PrintFlow account. You can update this later."/></span><input value={shop.ownerName} onChange={(event) => setShop((value) => ({ ...value, ownerName: event.target.value }))} placeholder="Alex Morgan"/></label>
          <label><span>Business name <InfoTip text="Use the name customers recognize on invoices, checkout, and your storefront."/></span><input required value={shop.businessName} onChange={(event) => setShop((value) => ({ ...value, businessName: event.target.value }))} placeholder="Morgan Print Co."/></label>
          <label><span>Storefront address <InfoTip text="This becomes your customer link. Use a short version of the business name."/></span><div className="slug-input"><span>/s/</span><input value={shop.slug} onChange={(event) => setShop((value) => ({ ...value, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} placeholder="morgan-print-co"/></div></label>
          <label><span>Customer contact email</span><input type="email" value={shop.contactEmail} onChange={(event) => setShop((value) => ({ ...value, contactEmail: event.target.value }))} placeholder="orders@morganprint.com"/></label>
          <label><span>Business phone</span><input value={shop.phone} onChange={(event) => setShop((value) => ({ ...value, phone: event.target.value }))} placeholder="(555) 555-0142"/></label>
          <label><span>Business address</span><input value={shop.address} onChange={(event) => setShop((value) => ({ ...value, address: event.target.value }))} placeholder="123 Main Street, Boston, MA"/></label>
        </div>
        <div className="onboarding-example"><strong>Example</strong><p>Morgan Print Co. · /s/morgan-print-co · orders@morganprint.com</p></div>
        <div className="onboarding-actions"><button className="launch-primary" disabled={busy || !shop.businessName.trim()} onClick={bootstrap}>{busy ? "Creating workspace…" : "Create business workspace"}</button></div>
      </section><CoachCard title="Why this matters"><p>This information becomes the foundation for the storefront, receipts, order communication, and account support.</p><ul><li>Use a customer-facing business name.</li><li>Choose a short storefront address.</li><li>Use an inbox someone checks daily.</li></ul></CoachCard></div>}

      {step === 2 && <div className="onboarding-stage-layout"><section className="onboarding-stack onboarding-primary-card">
        <div className="onboarding-choice-grid">
          <article className="onboarding-card connection-setup-card guided-connection-card"><div className="connection-card-heading"><img src="/integrations/stripe.png" alt="Stripe"/><div><span className="live-dot"/><h2>Stripe</h2><p>Hosted checkout, payment confirmation, and automatic paid-order updates.</p></div></div><label><span>Secret key <InfoTip text="Start with a Stripe test key. Switch to a live key after completing a full test order."/></span><input type="password" value={stripe} onChange={(event) => setStripe(event.target.value)} placeholder="sk_test_… or sk_live_…"/></label><CredentialGuide title="Stripe" steps={["Sign in to Stripe and choose the correct business account.", "Turn on Test mode while validating PrintFlow.", "Go to Developers, then API keys.", "Reveal and copy the Secret key beginning with sk_test_ or sk_live_.", "Paste it here. PrintFlow verifies checkout and creates the payment update connection automatically."]} href="https://dashboard.stripe.com/apikeys" linkLabel="Stripe API keys"/><button className="launch-primary" disabled={busy || !stripe} onClick={() => connectPayment("stripe")}>{status.paymentProviders?.includes("stripe") ? "Stripe connected ✓" : "Connect Stripe"}</button></article>
          <article className="onboarding-card connection-setup-card guided-connection-card"><div className="connection-card-heading"><img src="/integrations/square.png" alt="Square"/><div><span className="live-dot"/><h2>Square</h2><p>Square-hosted payment links with payment confirmation.</p></div></div><label><span>Access token <InfoTip text="Use a Sandbox token for testing or a Production personal access token when ready to collect real payments."/></span><input type="password" value={square.accessToken} onChange={(event) => setSquare((value) => ({ ...value, accessToken: event.target.value }))} placeholder="Paste the access token"/></label><label><span>Environment</span><select value={square.environment} onChange={(event) => setSquare((value) => ({ ...value, environment: event.target.value }))}><option value="sandbox">Sandbox / test</option><option value="production">Production / live</option></select></label><CredentialGuide title="Square" steps={["Open the Square Developer Dashboard and select your application.", "Choose Credentials.", "For testing, copy the Sandbox access token.", "For launch, copy the Production access token for the connected business.", "Paste the token and select the matching environment here."]} href="https://developer.squareup.com/apps" linkLabel="Square applications"/><button className="launch-secondary" disabled={busy || !square.accessToken} onClick={() => connectPayment("square")}>{status.paymentProviders?.includes("square") ? "Square connected ✓" : "Connect Square"}</button></article>
        </div>
        <div className="onboarding-actions split"><button className="text-button" onClick={() => markStep(3, "payments")}>Skip and connect later</button><button className="launch-primary" onClick={() => markStep(3)}>Continue</button></div>
      </section><CoachCard title="Recommended approach"><p>Connect one payment provider now. Use test credentials first, place a complete order, and then replace them with live credentials.</p><div className="coach-checklist"><span>✓ Secure hosted checkout</span><span>✓ Automatic payment status</span><span>✓ No card data stored in PrintFlow</span></div></CoachCard></div>}

      {step === 3 && <div className="onboarding-stage-layout"><section className="onboarding-stack onboarding-primary-card"><article className="onboarding-card guided-supplier-card"><div className="connection-card-heading"><img src="/suppliers/ss-activewear.png" alt="S&S Activewear"/><div><p className="eyebrow">LIVE SUPPLIER</p><h2>S&amp;S Activewear</h2><p>Browse live styles, import exact SKU costs, review inventory, and submit wholesale blank orders.</p></div></div><div className="onboarding-grid"><label><span>Account number <InfoTip text="This is the S&S customer account number used to sign in and purchase blanks."/></span><input value={ss.accountNumber} onChange={(event) => setSs((value) => ({ ...value, accountNumber: event.target.value }))} placeholder="Your S&S account number"/></label><label><span>API key <InfoTip text="The API key is issued for your S&S account. It is different from your website password."/></span><input type="password" value={ss.apiKey} onChange={(event) => setSs((value) => ({ ...value, apiKey: event.target.value }))} placeholder="Paste the S&S API key"/></label></div><CredentialGuide title="S&S" steps={["Sign in to the S&S account used for purchasing blanks.", "Request or locate API access for the account.", "Copy the account number and issued API key.", "Paste both values here.", "PrintFlow starts in test-order mode so you can verify purchasing before placing live orders."]} href="https://api.ssactivewear.com" linkLabel="S&S API information"/><button className="launch-primary" disabled={busy || !ss.accountNumber || !ss.apiKey} onClick={connectSupplier}>{status.supplierConnected ? "S&S connected ✓" : "Connect S&S"}</button></article><div className="onboarding-actions split"><button className="text-button" onClick={() => markStep(4, "supplier")}>Skip and connect later</button><button className="launch-primary" onClick={() => markStep(4)}>Continue</button></div></section><CoachCard title="What the connection unlocks"><ul><li>Real account pricing by size and color</li><li>Current supplier inventory</li><li>Front and back garment images</li><li>Exact SKU purchasing from orders</li></ul><p>Keep test-order mode on until a supplier test order succeeds.</p></CoachCard></div>}

      {step === 4 && <div className="onboarding-stage-layout"><section className="onboarding-card onboarding-primary-card"><div className="onboarding-section-heading"><div><p className="eyebrow">PRICING FOUNDATION</p><h2>Start with safe defaults</h2></div><span>Detailed Screen Printing, DTF, and Embroidery rates can be refined later.</span></div><div className="onboarding-grid pricing-onboarding-grid"><label><span>Garment markup <InfoTip text="This percentage is added to the exact supplier blank cost before printing charges."/></span><div className="field-with-unit"><input inputMode="decimal" value={pricing.garmentMarkupPercent} onChange={(event) => setPricing((value) => ({ ...value, garmentMarkupPercent: Number(event.target.value) }))}/><b>%</b></div><small>Default recommendation: 10% or higher.</small></label><label><span>Order setup <InfoTip text="A one-time charge that covers job preparation, files, and production administration."/></span><div className="field-with-unit"><b>$</b><input inputMode="decimal" value={pricing.orderSetupFee} onChange={(event) => setPricing((value) => ({ ...value, orderSetupFee: Number(event.target.value) }))}/></div><small>Default: $60 per order.</small></label><label><span>Design optimization <InfoTip text="Optional service for customers who need artwork cleaned up or adjusted for production."/></span><div className="field-with-unit"><b>$</b><input inputMode="decimal" value={pricing.designOptimizationFee} onChange={(event) => setPricing((value) => ({ ...value, designOptimizationFee: Number(event.target.value) }))}/></div><small>Default: $100 when requested.</small></label></div><div className="onboarding-method-switches">{[["screenPrinting", "Screen Printing"], ["dtf", "DTF"], ["embroidery", "Embroidery"]].map(([key, label]) => <label className="form-check form-switch" key={key}><input className="form-check-input" type="checkbox" checked={(pricing as any)[key]} onChange={(event) => setPricing((value) => ({ ...value, [key]: event.target.checked }))}/><span className="form-check-label">Offer {label}</span></label>)}</div><div className="pricing-example-card"><span>Simple example</span><strong>$4.00 supplier blank + 10% markup = $4.40 garment price before printing</strong><p>Print method, quantity break, setup, design service, and add-ons are calculated after the garment.</p></div><div className="onboarding-actions split"><button className="text-button" onClick={() => markStep(5, "pricing")}>Use defaults for now</button><button className="launch-primary" disabled={busy} onClick={async () => { if (await savePricing()) await markStep(5); }}>{busy ? "Saving…" : "Save pricing foundation"}</button></div></section><CoachCard title="You are not setting every price yet"><p>This step establishes the shop-wide foundation. The full Pricing workspace includes quantity thresholds and method-specific production costs.</p><ul><li>Screen Printing: colors, screens, locations</li><li>DTF: area and press labor</li><li>Embroidery: stitches and digitizing</li></ul></CoachCard></div>}

      {step === 5 && <div className="onboarding-stage-layout"><section className="onboarding-card onboarding-product-step onboarding-primary-card"><div className="onboarding-readiness-feature"><span>{status.productCount}</span><div><h2>Active products</h2><p>A launch-ready product needs images, colors, sizes, cost information, print methods, and print zones.</p></div></div><div className="product-readiness-checklist"><span>1. Choose a garment</span><span>2. Select colors and sizes</span><span>3. Confirm front/back images</span><span>4. Set print zones</span><span>5. Activate the product</span></div><div className="onboarding-destination-grid"><Link href="/dashboard/suppliers/catalog" target="_blank"><b>Import from S&amp;S</b><span>Use real supplier styles, costs, inventory, and images.</span></Link><Link href="/dashboard/products" target="_blank"><b>Create a specialty product</b><span>Add a manual item that is not provided by a connected supplier.</span></Link></div><button className="secondary-button" onClick={refreshStatus}>Refresh product count</button><div className="onboarding-actions split"><button className="text-button" onClick={() => markStep(6, "products")}>Skip and add products later</button><button className="launch-primary" onClick={() => markStep(6)}>Continue</button></div></section><CoachCard title="Start small"><p>One fully configured product is better than a large unfinished catalog. Start with your most common T-shirt and the colors customers order most.</p><div className="onboarding-example"><strong>Good first product</strong><p>Gildan 5000 · Black, White, Navy · S–2XL · Front and Back</p></div></CoachCard></div>}

      {step === 6 && <div className="onboarding-stage-layout"><section className="onboarding-card onboarding-primary-card"><div className="onboarding-storefront-layout"><div className="onboarding-grid"><label><span>Primary color <InfoTip text="Used for major storefront areas and selected states."/></span><input type="color" value={shop.primaryColor} onChange={(event) => setShop((value) => ({ ...value, primaryColor: event.target.value }))}/></label><label><span>Accent color <InfoTip text="Used for buttons, badges, and highlights. Choose a color with strong contrast."/></span><input type="color" value={shop.accentColor} onChange={(event) => setShop((value) => ({ ...value, accentColor: event.target.value }))}/></label><label className="full"><span>Storefront headline</span><input value={shop.headline} onChange={(event) => setShop((value) => ({ ...value, headline: event.target.value }))} placeholder="Custom apparel, made simple."/></label><label className="full"><span>Introduction</span><textarea rows={4} value={shop.introduction} onChange={(event) => setShop((value) => ({ ...value, introduction: event.target.value }))} placeholder="Choose a garment, upload artwork, and order with confidence."/></label></div><div className="onboarding-mini-preview" style={{ background: shop.primaryColor, color: "#fff" }}><small>YOUR STOREFRONT</small><h2>{shop.headline || "Custom apparel, made simple."}</h2><p>{shop.introduction || "Choose a garment, upload artwork, and order with confidence."}</p><button style={{ background: shop.accentColor }}>Choose a product</button></div></div><div className="storefront-copy-examples"><strong>Helpful headline examples</strong><span>Custom team apparel without the back-and-forth.</span><span>Choose your garment. Upload your design. We handle production.</span></div><div className="onboarding-actions split"><button className="text-button" onClick={() => markStep(7, "storefront")}>Use the default style</button><button className="launch-primary" disabled={busy} onClick={async () => { if (await saveStorefront()) await markStep(7); }}>{busy ? "Saving…" : "Save storefront"}</button></div></section><CoachCard title="Keep the first screen clear"><p>Customers should understand what to do in a few seconds. Lead with the result, then let the product catalog do the work.</p><ul><li>Use one short headline.</li><li>Explain the process in one sentence.</li><li>Choose a high-contrast accent color.</li></ul></CoachCard></div>}

      {step === 7 && <div className="onboarding-stage-layout"><section className="onboarding-card launch-review-card onboarding-primary-card"><div className="launch-review-grid"><div className={hasShop ? "ready" : ""}><span>Business</span><strong>{hasShop ? "Ready" : "Required"}</strong></div><div className={status.paymentConnected ? "ready" : ""}><span>Payments</span><strong>{status.paymentConnected ? "Ready" : "Finish later"}</strong></div><div className={status.supplierConnected ? "ready" : ""}><span>Supplier</span><strong>{status.supplierConnected ? "Ready" : "Finish later"}</strong></div><div className={status.pricingConfigured ? "ready" : ""}><span>Pricing</span><strong>{status.pricingConfigured ? "Ready" : "Defaults installed"}</strong></div><div className={status.productCount > 0 ? "ready" : ""}><span>Products</span><strong>{status.productCount} active</strong></div><div className={shop.headline ? "ready" : ""}><span>Storefront</span><strong>{shop.headline ? "Customized" : "Default style"}</strong></div></div><div className="launch-next-list"><h2>Choose how to continue</h2><p>You can enter the dashboard at any time. Publishing requires at least one active product and a connected payment provider so customers never reach a dead end.</p></div><div className="launch-gap-actions">{!status.paymentConnected && <button onClick={() => markStep(2)}>Connect payments</button>}{status.productCount === 0 && <button onClick={() => markStep(5)}>Add a product</button>}{!status.supplierConnected && <button onClick={() => markStep(3)}>Connect supplier</button>}</div><div className="onboarding-actions launch-final-actions"><button className="launch-secondary" disabled={busy} onClick={() => complete(false)}>Enter dashboard and finish later</button><button className="launch-primary" disabled={busy || !status.paymentConnected || status.productCount === 0} onClick={() => complete(true)}>{busy ? "Finishing…" : "Publish storefront and enter dashboard"}</button></div></section><CoachCard title={status.paymentConnected && status.productCount > 0 ? "Ready to publish" : "Almost there"}><p>{status.paymentConnected && status.productCount > 0 ? "Your storefront has the minimum required pieces for customers to browse, customize, and pay." : "Complete the highlighted items before publishing. Everything else can be refined after launch."}</p><div className="coach-checklist"><span className={status.paymentConnected ? "done" : ""}>Payment connection</span><span className={status.productCount > 0 ? "done" : ""}>At least one product</span><span className={status.pricingConfigured ? "done" : ""}>Pricing foundation</span></div></CoachCard></div>}
    </main>
  </div>;
}
