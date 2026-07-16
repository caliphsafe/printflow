import { getAdminContext } from "@/lib/admin-data";

export default async function SettingsPage(){
 const {shop,organization}=await getAdminContext();
 if(!shop) return <p>No shop configured.</p>;
 const appUrl=process.env.NEXT_PUBLIC_APP_URL || 'https://YOUR-VERCEL-DOMAIN.com';
 const embed=`<script src="${appUrl}/embed.js" data-shop="${shop.slug}"></script>`;
 return <>
  <header className="admin-header"><div><p className="eyebrow">SHOP SETUP</p><h1>{shop.name}</h1><p>Manage the identity and installation details for this PrintFlow storefront.</p></div><a className="secondary-button" href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">Preview shop ↗</a></header>
  <div className="settings-grid">
   <section className="admin-card settings-profile-card"><p className="section-kicker">WORKSPACE</p><div className="settings-shop-identity"><span>{shop.name.slice(0,1).toUpperCase()}</span><div><h2>{shop.name}</h2><p>{organization?.name || 'PrintFlow organization'}</p></div></div><div className="settings-detail-list"><div><span>Shop slug</span><code>{shop.slug}</code></div><div><span>Status</span><strong>{shop.active?'Active':'Inactive'}</strong></div><div><span>Public designer</span><a href={`/s/${shop.slug}`} target="_blank" rel="noreferrer">/s/{shop.slug} ↗</a></div></div></section>
   <section className="admin-card embed-card"><p className="section-kicker">INSTALLATION</p><h2>One-line embed</h2><p>Paste this script into a Squarespace Code Block or any website that accepts custom HTML.</p><pre className="code-block polished-code">{embed}</pre><div className="embed-note"><strong>How it works</strong><p>The script loads your hosted designer, keeps CSS isolated and resizes automatically inside the client website.</p></div></section>
  </div>
  <section className="admin-card raw-settings-card"><div className="card-heading"><div><p className="section-kicker">DEVELOPER VIEW</p><h2>Current shop configuration</h2></div><span className="status-pill">Read only</span></div><p>This JSON remains available for troubleshooting while the visual settings editor is being built.</p><pre className="code-block">{JSON.stringify(shop.settings,null,2)}</pre></section>
 </>;
}
