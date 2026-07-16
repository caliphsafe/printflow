import { getAdminContext } from "@/lib/admin-data";

export default async function IntegrationsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;

  const { data: integration } = await supabase
    .from("shop_integrations")
    .select("checkout_provider, active, google_web_app_url, updated_at")
    .eq("shop_id", shop.id)
    .maybeSingle();

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">CONNECTIONS</p>
          <h1>Integrations</h1>
          <p>The pilot uses Squarespace checkout and Google delivery. The schema already separates providers so Stripe, Square and Shopify can be added as adapters.</p>
        </div>
      </header>

      <div className="integration-grid">
        <section className="admin-card integration-card">
          <div className="card-heading"><h2>Squarespace</h2><span className="status-pill">{integration?.active ? "Connected" : "Not connected"}</span></div>
          <p>Checkout, taxes, shipping, discounts and payment receipts.</p>
          <small>Provider: {integration?.checkout_provider || "squarespace"}</small>
        </section>
        <section className="admin-card integration-card">
          <div className="card-heading"><h2>Google Drive + Sheets</h2><span className="status-pill">{integration?.google_web_app_url ? "Connected" : "Not connected"}</span></div>
          <p>Receives paid-order artwork, mockups and production information.</p>
        </section>
        <section className="admin-card integration-card muted-card">
          <div className="card-heading"><h2>Stripe Connect</h2><span className="status-pill">Future</span></div>
          <p>Native merchant onboarding and direct payments for the SaaS release.</p>
        </section>
        <section className="admin-card integration-card muted-card">
          <div className="card-heading"><h2>Square / Shopify</h2><span className="status-pill">Future</span></div>
          <p>Additional checkout adapters can be enabled without replacing the designer.</p>
        </section>
      </div>
    </>
  );
}
