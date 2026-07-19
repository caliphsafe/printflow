"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Item = {
  sku?: string;
  brandName?: string;
  styleName?: string;
  colorName?: string;
  sizeName?: string;
  quantity?: number;
  unitCost?: number;
};

type CartJob = {
  id: string;
  designId: string;
  provider: string;
  status: string;
  estimatedTotal: number;
  items: Item[];
  displayId: string;
  customerName: string;
  productName: string;
  paymentStatus: string;
  createdAt: string;
  ordered: boolean;
  orderNumbers: string[];
  imageUrl?: string;
};

type ProviderState = {
  connected: boolean;
  testMode?: boolean;
};

const providerNames: Record<string, string> = {
  "ss-activewear": "S&S Activewear",
  sanmar: "SanMar",
  manual: "Manual supplier"
};

function providerName(provider: string) {
  return providerNames[provider] || provider.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function imageSrc(url?: string) {
  if (!url) return "";
  return url.includes("ssactivewear.com") ? `/api/public/supplier-image?url=${encodeURIComponent(url)}` : url;
}

export default function SupplierCartManager({
  initialJobs,
  providerStates
}: {
  initialJobs: CartJob[];
  providerStates: Record<string, ProviderState>;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const providers = useMemo(() => Array.from(new Set(jobs.map((job) => job.provider))), [jobs]);
  const [activeProvider, setActiveProvider] = useState(providers[0] || "ss-activewear");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const visibleJobs = jobs.filter((job) => job.provider === activeProvider);
  const pieces = visibleJobs.reduce((sum, job) => sum + job.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
  const cost = visibleJobs.reduce((sum, job) => sum + Number(job.estimatedTotal || 0), 0);

  async function remove(job: CartJob) {
    if (!confirm(`Remove ${job.displayId} from the ${providerName(job.provider)} cart?`)) return;
    setBusyId(job.id);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${job.designId}/blank-draft`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: job.provider })
    });
    const data = await response.json();
    setBusyId("");
    if (!response.ok) return setMessage(data.error || "Unable to remove the job from the supplier cart.");
    setJobs((current) => current.filter((item) => item.id !== job.id));
  }

  async function place(job: CartJob) {
    const state = providerStates[job.provider];
    const paid = job.paymentStatus === "paid";
    const mode = state?.testMode ? "This creates an S&S test order." : "This places a real wholesale order in the connected S&S account.";
    const risk = paid ? "Customer payment is confirmed." : "Customer payment is not confirmed. Your shop accepts the supplier cost risk.";
    if (!confirm(`${risk}\n\n${mode}\n\nContinue?`)) return;

    setBusyId(job.id);
    setMessage("");
    const response = await fetch(`/api/admin/orders/${job.designId}/order-blanks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowBeforePayment: !paid })
    });
    const data = await response.json();
    setBusyId("");
    if (!response.ok) return setMessage(data.error || "Unable to submit the supplier order.");
    setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: "submitted", ordered: true, orderNumbers: data.orderNumbers || [] } : item));
    setMessage(`${job.displayId} was submitted to S&S.`);
  }

  if (!jobs.length) {
    return (
      <section className="admin-card supplier-cart-empty">
        <span>0</span>
        <h2>Your supplier cart is empty.</h2>
        <p>Open a customer order and add its blank requirements. PrintFlow will keep each supplier’s items separated automatically.</p>
        <Link className="primary-button" href="/dashboard/orders">Orders</Link>
      </section>
    );
  }

  return (
    <div className="supplier-cart-shell">
      <section className="supplier-cart-summary admin-card">
        <div><p className="section-kicker">PURCHASING</p><h2>{providerName(activeProvider)} cart</h2><p>Review exact SKUs before submitting the wholesale order through the connected supplier account.</p></div>
        <div className="supplier-cart-metrics"><span><small>Jobs</small><strong>{visibleJobs.length}</strong></span><span><small>Pieces</small><strong>{pieces}</strong></span><span><small>Estimated blanks</small><strong>${cost.toFixed(2)}</strong></span></div>
      </section>

      <nav className="supplier-cart-tabs" aria-label="Supplier carts">
        {providers.map((provider) => <button type="button" key={provider} className={provider === activeProvider ? "active" : ""} onClick={() => setActiveProvider(provider)}><span>{providerName(provider)}</span><small>{jobs.filter((job) => job.provider === provider && !job.ordered).length} active</small></button>)}
      </nav>

      {message && <div className="success-message supplier-cart-message">{message}</div>}

      <div className="supplier-cart-jobs">
        {visibleJobs.map((job) => {
          const state = providerStates[job.provider];
          const supported = job.provider === "ss-activewear";
          const ready = supported && state?.connected;
          return (
            <article className="admin-card supplier-cart-job" key={job.id}>
              <header>
                <div className="supplier-cart-product-summary">
                  <div className="supplier-cart-product-image">{job.imageUrl ? <img src={imageSrc(job.imageUrl)} alt={job.productName} /> : <span>PF</span>}</div>
                  <div><p className="section-kicker">{job.displayId}</p><h3>{job.productName}</h3><p>{job.customerName} · {job.paymentStatus === "paid" ? "Paid" : "Payment pending"}</p></div>
                </div>
                <div className="supplier-cart-job-total"><span>{job.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} pieces</span><strong>${job.estimatedTotal.toFixed(2)}</strong></div>
              </header>
              <div className="supplier-cart-lines">
                {job.items.map((item) => <div key={`${item.sku}-${item.sizeName}`}><span><strong>{item.brandName} {item.styleName}</strong><small>{item.colorName} · {item.sizeName} · {item.sku}</small></span><span><strong>{item.quantity} pcs</strong><small>${Number(item.unitCost || 0).toFixed(2)} each</small></span></div>)}
              </div>
              <footer>
                <Link className="ghost-button" href={`/dashboard/orders/${job.designId}`}>Order details</Link>
                {!job.ordered && <button type="button" className="text-button supplier-cart-remove" disabled={busyId === job.id} onClick={() => remove(job)}>Remove</button>}
                {job.ordered ? <div className="supplier-cart-ordered"><span>Submitted</span><strong>{job.orderNumbers.join(", ") || "Supplier order created"}</strong></div> : supported ? <button type="button" className="primary-button" disabled={!ready || busyId === job.id} onClick={() => place(job)}>{busyId === job.id ? "Submitting…" : state?.testMode ? "Create S&S test order" : "Order from S&S"}</button> : <button type="button" className="secondary-button" disabled>Ordering coming soon</button>}
              </footer>
              {!ready && supported && <p className="supplier-cart-inline-note">Connect S&S and complete the delivery settings before submitting this cart.</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
