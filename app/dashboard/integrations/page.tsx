import Link from "next/link";
import IntegrationCenter from "@/components/IntegrationCenter";
import { getAdminContext } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return <p>No shop configured.</p>;
  const [{ data }, { data: ss }] = await Promise.all([
    supabase.from("integration_connections").select("provider,category,status,account_label,last_tested_at,last_error").eq("shop_id", shop.id),
    supabase.from("supplier_connections").select("provider,status,account_hint,last_tested_at").eq("shop_id", shop.id).eq("provider", "ss-activewear").maybeSingle()
  ]);
  const connections = [...(data || [])];
  if (ss) connections.push({ provider: "ss-activewear", category: "supplier", status: ss.status, account_label: ss.account_hint, last_tested_at: ss.last_tested_at, last_error: null });
  return <>
    <header className="admin-header"><div><p className="eyebrow">CONNECTION CENTER</p><h1>Integrations</h1><p>Manage payments, commerce, file delivery, and supplier credentials from one clean connection center.</p></div><Link className="secondary-button" href="/dashboard/suppliers">Open Supplier Hub</Link></header>
    <section className="integration-summary"><div><span className="connection-orb connected"/><div><strong>{connections.filter((item) => item.status === "connected").length} connected</strong><small>encrypted account connections</small></div></div><p>Every available connection is visible here. Supplier-specific catalog and ordering controls remain available inside Supplier Hub.</p></section>
    <IntegrationCenter initialConnections={connections}/>
  </>;
}
