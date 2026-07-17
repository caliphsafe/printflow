import { getAdminContext } from "@/lib/admin-data";
import SSActivewearIntegration from "@/components/SSActivewearIntegration";

export const dynamic = "force-dynamic";
export default async function IntegrationsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const [{ data: integration }, { data: supplier }] = await Promise.all([
    supabase.from("shop_integrations").select("checkout_provider, active, google_web_app_url, updated_at").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("supplier_connections").select("status,account_hint,settings,last_tested_at").eq("shop_id", shop.id).eq("provider", "ss-activewear").maybeSingle()
  ]);
  const connected = Boolean(integration?.active); const googleConnected = Boolean(integration?.google_web_app_url); const supplierConnected = supplier?.status === "connected";
  return <>
    <header className="admin-header"><div><p className="eyebrow">CONNECTIONS</p><h1>Integrations</h1><p>Each print shop connects its own checkout, file delivery and wholesale supplier accounts.</p></div></header>
    <section className="integration-summary"><div><span className="connection-orb connected"/><div><strong>{Number(connected)+Number(googleConnected)+Number(supplierConnected)} connected</strong><small>of 5 available integrations</small></div></div><p>Credentials are scoped to this shop and never exposed to the public designer.</p></section>
    <div className="integration-grid integration-grid-polished">
      <SSActivewearIntegration connected={supplierConnected} accountHint={supplier?.account_hint} initialSettings={supplier?.settings}/>
      <section className="admin-card integration-card"><div className="integration-logo">SQ</div><div className="card-heading"><div><h2>Squarespace Commerce</h2><p>Checkout provider</p></div><span className={connected?"status-pill connected":"status-pill"}>{connected?"Connected":"Setup needed"}</span></div><p>Handles checkout, taxes, shipping, discounts and payment receipts for the pilot.</p><div className="integration-meta"><span>Provider</span><strong>{integration?.checkout_provider || "squarespace"}</strong></div></section>
      <section className="admin-card integration-card"><div className="integration-logo google">GD</div><div className="card-heading"><div><h2>Google Drive + Sheets</h2><p>Order delivery</p></div><span className={googleConnected?"status-pill connected":"status-pill"}>{googleConnected?"Connected":"Setup needed"}</span></div><p>Receives paid-order artwork, previews and production information.</p><div className="integration-meta"><span>Destination</span><strong>{googleConnected?"Web app connected":"Not configured"}</strong></div></section>
      <section className="admin-card integration-card muted-card"><div className="integration-logo stripe">ST</div><div className="card-heading"><div><h2>Stripe Connect</h2><p>Native payments</p></div><span className="status-pill">Roadmap</span></div><p>Merchant onboarding and direct payouts.</p></section>
    </div>
  </>;
}
