import Link from "next/link";
import AdvancedAdminSquareConnection from "@/components/AdvancedAdminSquareConnection";
import SanMarIntegration from "@/components/SanMarIntegration";
import { getAdvancedAdminContext } from "@/lib/advanced-admin";

export const dynamic = "force-dynamic";

export default async function AdvancedSettings() {
  const { db, shop } = await getAdvancedAdminContext();
  const [{ data: square }, { data: sanmar }] = await Promise.all([
    db.from("integration_connections").select("status,account_label,configuration,last_tested_at,last_error").eq("shop_id",shop.id).eq("provider","square").maybeSingle(),
    db.from("supplier_connections").select("status,account_hint,settings,last_tested_at,last_error").eq("shop_id",shop.id).eq("provider","sanmar").maybeSingle()
  ]);

  return <>
    <header className="ae-page-head">
      <div className="copy"><p className="ae-kicker">SETTINGS</p><h1>The two connections that matter.</h1><p>Advanced customers see Advanced. SanMar supplies the garments and Square processes payment behind the scenes.</p></div>
    </header>

    <section className="ae-connection-grid">
      <AdvancedAdminSquareConnection connected={square?.status==="connected"} accountLabel={square?.account_label || undefined} environment={square?.configuration?.environment || undefined}/>
      <div className="ae-connection">
        <SanMarIntegration connected={sanmar?.status==="connected"} accountHint={sanmar?.account_hint || undefined}/>
        {sanmar?.status==="connected" && <Link className="ae-button primary" href="/advanced-admin/sanmar">Choose Advanced products →</Link>}
      </div>
    </section>

    <section className="ae-grid-equal" style={{marginTop:16}}>
      <article className="ae-card"><p className="ae-kicker">CUSTOMER STOREFRONT</p><h2>Advanced Custom Apparel</h2><p style={{fontSize:9,color:"var(--ae-muted)",lineHeight:1.6}}>The Advanced website embeds this shop's PrintFlow designer and pricing engine.</p><a className="ae-button" href="https://adv-emb-sp.vercel.app/order/custom/" target="_blank" rel="noreferrer">Open customer designer ↗</a></article>
      <article className="ae-card"><p className="ae-kicker">POWER TOOLS</p><h2>Need something advanced?</h2><p style={{fontSize:9,color:"var(--ae-muted)",lineHeight:1.6}}>The full PrintFlow dashboard still exists for rare setup and troubleshooting tasks, but normal Advanced staff do not need it.</p><Link className="ae-button" href="/dashboard">Open full PrintFlow tools</Link></article>
    </section>
  </>;
}
