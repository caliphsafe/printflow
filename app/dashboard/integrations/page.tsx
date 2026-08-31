import Link from "next/link";
import IntegrationCenter from "@/components/IntegrationCenter";
import { getAdminContext } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { supabase, shop } = await getAdminContext();

  if (!shop) return <p>No shop configured.</p>;

  const [{ data }, { data: ss }, { data: sanmar }] = await Promise.all([
    supabase
      .from("integration_connections")
      .select(
        "provider,category,status,account_label,configuration,last_tested_at,last_error"
      )
      .eq("shop_id", shop.id),

    supabase
      .from("supplier_connections")
      .select("provider,status,account_hint,last_tested_at,settings")
      .eq("shop_id", shop.id)
      .eq("provider", "ss-activewear")
      .maybeSingle(),

    supabase
      .from("supplier_connections")
      .select("provider,status,account_hint,last_tested_at,settings")
      .eq("shop_id", shop.id)
      .eq("provider", "sanmar")
      .maybeSingle()
  ]);

  const connections: any[] = [...(data || [])];

  if (ss) {
    connections.push({
      provider: "ss-activewear",
      category: "supplier",
      status: ss.status,
      account_label: ss.account_hint,
      configuration: ss.settings,
      last_tested_at: ss.last_tested_at,
      last_error: null
    });
  }

  // SanMar uses the supplier_connections table just like S&S. It must be
  // included here as a live supplier connection rather than being treated as
  // a roadmap integration.
  if (sanmar) {
    connections.push({
      provider: "sanmar",
      category: "supplier",
      status: sanmar.status,
      account_label: sanmar.account_hint,
      configuration: sanmar.settings,
      last_tested_at: sanmar.last_tested_at,
      last_error: null
    });
  }

  const liveCount = connections.filter(
    (item) => item.status === "connected"
  ).length;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">LIVE CONNECTION CENTER</p>
          <h1>Connected services</h1>
          <p>
            Connect payment and supplier accounts used by your storefront and
            order workflow. SanMar and S&amp;S both have live supplier catalog
            workflows.
          </p>
        </div>

        <Link className="secondary-button" href="/dashboard/suppliers">
          Suppliers
        </Link>
      </header>

      <section className="integration-summary production">
        <div>
          <span
            className={
              liveCount ? "connection-orb connected" : "connection-orb"
            }
          />

          <div>
            <strong>
              {liveCount} live connection{liveCount === 1 ? "" : "s"}
            </strong>
            <small>
              ready for real catalog or payment activity
            </small>
          </div>
        </div>

        <p>
          Stripe and Square create hosted checkout. S&amp;S and SanMar provide
          live supplier catalogs, account pricing, inventory, and product
          importing.
        </p>
      </section>

      <IntegrationCenter initialConnections={connections} />
    </>
  );
}
