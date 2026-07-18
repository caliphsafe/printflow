import Link from "next/link";
import IntegrationCenter from "@/components/IntegrationCenter";
import { getAdminContext } from "@/lib/admin-data";

export const dynamic = "force-dynamic";
export default async function IntegrationsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const [{ data }, { data: ss }] = await Promise.all([
    supabase.from("integration_connections").select("provider,category,status,account_label,configuration,last_tested_at,last_error").eq("shop_id", shop.id),
    supabase.from("supplier_connections").select("provider,status,account_hint,last_tested_at,settings").eq("shop_id", shop.id).eq("provider", "ss-activewear").maybeSingle()
  ]);
  const connections: any[] = [...(data || [])];
  if (ss) connections.push({ provider: "ss-activewear", category: "supplier", status: ss.status, account_label: ss.account_hint, configuration: ss.settings, last_tested_at: ss.last_tested_at, last_error: null });
  const liveCount = connections.filter((item) => item.status === "connected").length;
  return <>
    <header className="admin-header"><div><p className="eyebrow">LIVE CONNECTION CENTER</p><h1>Integrations that actually work</h1><p>Connect a provider only when PrintFlow can use it end to end. Roadmap integrations are clearly disabled until their complete production workflow is ready.</p></div><Link className="secondary-button" href="/dashboard/suppliers">Open Supplier Hub</Link></header>
    <section className="integration-summary production"><div><span className={liveCount ? "connection-orb connected" : "connection-orb"}/><div><strong>{liveCount} live connection{liveCount === 1 ? "" : "s"}</strong><small>ready for real catalog or payment activity</small></div></div><p>Stripe and Square create native hosted checkout. S&S provides live catalog and ordering. Connectable means operational—not merely stored credentials.</p></section>
    <IntegrationCenter initialConnections={connections}/>
  </>;
}
