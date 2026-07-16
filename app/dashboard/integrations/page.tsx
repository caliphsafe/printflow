import { getAdminContext } from "@/lib/admin-data";

export default async function IntegrationsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const { data: integration } = await supabase.from("shop_integrations").select("checkout_provider, active, google_web_app_url, updated_at").eq("shop_id", shop.id).maybeSingle();
  const connected = Boolean(integration?.active);
  const googleConnected = Boolean(integration?.google_web_app_url);

  return <>
    <header className="admin-header"><div><p className="eyebrow">CONNECTIONS</p><h1>Integrations</h1><p>Connect checkout and fulfillment services while PrintFlow remains the central order layer.</p></div></header>
    <section className="integration-summary"><div><span className="connection-orb connected"/><div><strong>{Number(connected)+Number(googleConnected)} connected</strong><small>of 4 available integrations</small></div></div><p>Squarespace and Google power the pilot. Native payment providers will become account-level adapters later.</p></section>
    <div className="integration-grid integration-grid-polished">
      <section className="admin-card integration-card"><div className="integration-logo">SQ</div><div className="card-heading"><div><h2>Squarespace Commerce</h2><p>Checkout provider</p></div><span className={connected?"status-pill connected":"status-pill"}>{connected?"Connected":"Setup needed"}</span></div><p>Handles checkout, taxes, shipping, discounts and payment receipts for the pilot.</p><div className="integration-meta"><span>Provider</span><strong>{integration?.checkout_provider || "squarespace"}</strong></div></section>
      <section className="admin-card integration-card"><div className="integration-logo google">GD</div><div className="card-heading"><div><h2>Google Drive + Sheets</h2><p>Order delivery</p></div><span className={googleConnected?"status-pill connected":"status-pill"}>{googleConnected?"Connected":"Setup needed"}</span></div><p>Receives paid-order artwork, previews and production information inside the printer’s Google account.</p><div className="integration-meta"><span>Destination</span><strong>{googleConnected?"Web app connected":"Not configured"}</strong></div></section>
      <section className="admin-card integration-card muted-card"><div className="integration-logo stripe">ST</div><div className="card-heading"><div><h2>Stripe Connect</h2><p>Native payments</p></div><span className="status-pill">Roadmap</span></div><p>Merchant onboarding, direct payouts and subscription-ready checkout for the SaaS release.</p><div className="integration-meta"><span>Availability</span><strong>Coming later</strong></div></section>
      <section className="admin-card integration-card muted-card"><div className="integration-logo square">SP</div><div className="card-heading"><div><h2>Square + Shopify</h2><p>Commerce adapters</p></div><span className="status-pill">Roadmap</span></div><p>Additional checkout adapters can be enabled without rebuilding the designer experience.</p><div className="integration-meta"><span>Availability</span><strong>Coming later</strong></div></section>
    </div>
  </>;
}
