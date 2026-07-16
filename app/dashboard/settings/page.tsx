import { getAdminContext } from "@/lib/admin-data";

export default async function SettingsPage(){
 const {shop}=await getAdminContext();
 if(!shop) return <p>No shop configured.</p>;
 return <><header className="admin-header"><div><p className="eyebrow">SHOP SETUP</p><h1>{shop.name}</h1><p>Configuration is stored per shop so the pilot can transition into self-service onboarding later.</p></div></header><section className="admin-card"><h2>Embed code</h2><p>Paste this into a Squarespace Code Block after deployment.</p><pre className="code-block">{`<script src="${process.env.NEXT_PUBLIC_APP_URL || 'https://YOUR-VERCEL-DOMAIN.com'}/embed.js" data-shop="${shop.slug}"></script>`}</pre><h2>Current configuration</h2><pre className="code-block">{JSON.stringify(shop.settings,null,2)}</pre></section></>;
}
