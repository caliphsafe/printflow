"use client";
import { useMemo, useState } from "react";
import FloatingSaveBar from "@/components/FloatingSaveBar";
import { useUnsavedChanges } from "@/components/useUnsavedChanges";

type Settings = {
  testMode?: boolean; shippingMethod?: string; autoselectWarehouse?: boolean; emailConfirmation?: string;
  shippingAddress?: { customer?: string; attn?: string; address?: string; city?: string; state?: string; zip?: string; residential?: boolean };
  paymentProfile?: { email?: string; profileID?: number } | null;
};

type Props = { connected: boolean; accountHint?: string | null; initialSettings?: Settings | null };
const emptyAddress = { customer:"",attn:"",address:"",city:"",state:"",zip:"",residential:false };

export default function SSActivewearIntegration({ connected: initialConnected, accountHint, initialSettings }: Props) {
 const [connected,setConnected]=useState(initialConnected); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 const [credentials,setCredentials]=useState({accountNumber:"",apiKey:""});
 const initialNormalized: Settings={testMode:initialSettings?.testMode ?? true,shippingMethod:initialSettings?.shippingMethod||"1",autoselectWarehouse:initialSettings?.autoselectWarehouse ?? true,emailConfirmation:initialSettings?.emailConfirmation||"",shippingAddress:{...emptyAddress,...(initialSettings?.shippingAddress||{})},paymentProfile:initialSettings?.paymentProfile||null};
 const [settings,setSettings]=useState<Settings>(initialNormalized); const [savedSettings,setSavedSettings]=useState(JSON.stringify(initialNormalized));
 const dirty=useMemo(()=>JSON.stringify(settings)!==savedSettings,[settings,savedSettings]);
 useUnsavedChanges(dirty);
 async function connect(){setBusy(true);setMessage("");const r=await fetch('/api/admin/suppliers/ss/connection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...credentials,...settings})});const d=await r.json();setBusy(false);if(!r.ok)return setMessage(d.error||'Unable to connect.');setConnected(true);setCredentials({accountNumber:"",apiKey:""});setMessage('S&S Activewear connected successfully.');}
 async function save(){setBusy(true);setMessage("");const r=await fetch('/api/admin/suppliers/ss/connection',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});const d=await r.json();setBusy(false);if(r.ok){setSavedSettings(JSON.stringify(settings));setMessage('Supplier settings saved.');}else setMessage(d.error||'Unable to save.');}
 async function disconnect(){if(!confirm('Disconnect S&S Activewear from this shop?'))return;setBusy(true);const r=await fetch('/api/admin/suppliers/ss/connection',{method:'DELETE'});setBusy(false);if(r.ok){setConnected(false);setMessage('S&S disconnected.');}}
 const address=settings.shippingAddress||emptyAddress;
 const patchAddress=(key:string,value:string|boolean)=>setSettings({...settings,shippingAddress:{...address,[key]:value}});
 return <section className="admin-card ss-integration-card">
  <div className="integration-logo ss-logo">S&amp;S</div>
  <div className="card-heading"><div><h2>S&amp;S Activewear</h2><p>Blank garment supplier</p></div><span className={connected?'status-pill connected':'status-pill'}>{connected?'Connected':'Setup needed'}</span></div>
  <p>Connect this shop’s own S&amp;S wholesale account to search live products, import colors and sizes, and submit real blank orders before or after customer payment.</p>
  {!connected ? <div className="supplier-connect-form">
   <label><span>S&amp;S account number</span><input value={credentials.accountNumber} onChange={e=>setCredentials({...credentials,accountNumber:e.target.value})} autoComplete="off"/></label>
   <label><span>API key</span><input type="password" value={credentials.apiKey} onChange={e=>setCredentials({...credentials,apiKey:e.target.value})} autoComplete="new-password"/></label>
   <p className="field-help">S&amp;S uses API credentials rather than OAuth. PrintFlow encrypts these values before storing them.</p>
   <button className="primary-button fit-button" disabled={busy} onClick={connect}>{busy?'Testing connection…':'Connect S&S account'}</button>
  </div> : <div className="supplier-settings-form">
   <div className="connection-banner"><span>Connected account</span><strong>{accountHint||'Credentials saved'}</strong></div>
   <div className="settings-two-col">
    <label><span>Order mode</span><select value={settings.testMode?'test':'live'} onChange={e=>setSettings({...settings,testMode:e.target.value==='test'})}><option value="test">Test orders (recommended)</option><option value="live">Live wholesale orders</option></select></label>
    <label><span>Shipping method</span><select value={settings.shippingMethod} onChange={e=>setSettings({...settings,shippingMethod:e.target.value})}><option value="1">Ground</option><option value="54">Cheapest ground option</option><option value="40">UPS Ground</option><option value="14">FedEx Ground</option><option value="6">Will Call / Pickup</option></select></label>
    <label><span>Confirmation email</span><input value={settings.emailConfirmation||''} onChange={e=>setSettings({...settings,emailConfirmation:e.target.value})}/></label>
    <label className="toggle-row supplier-toggle"><input type="checkbox" checked={settings.autoselectWarehouse!==false} onChange={e=>setSettings({...settings,autoselectWarehouse:e.target.checked})}/><span>Let S&amp;S optimize warehouses</span></label>
   </div>
   <h3>Default blank-order delivery address</h3>
   <div className="settings-two-col">
    <label><span>Company / recipient</span><input value={address.customer||''} onChange={e=>patchAddress('customer',e.target.value)}/></label>
    <label><span>Attention</span><input value={address.attn||''} onChange={e=>patchAddress('attn',e.target.value)}/></label>
    <label className="full-field"><span>Street address</span><input value={address.address||''} onChange={e=>patchAddress('address',e.target.value)}/></label>
    <label><span>City</span><input value={address.city||''} onChange={e=>patchAddress('city',e.target.value)}/></label>
    <label><span>State</span><input maxLength={2} value={address.state||''} onChange={e=>patchAddress('state',e.target.value.toUpperCase())}/></label>
    <label><span>ZIP</span><input value={address.zip||''} onChange={e=>patchAddress('zip',e.target.value)}/></label>
    <label className="toggle-row supplier-toggle"><input type="checkbox" checked={address.residential===true} onChange={e=>patchAddress('residential',e.target.checked)}/><span>Residential address</span></label>
   </div>
   <div className="integration-actions"><button className="secondary-button" disabled={busy} onClick={disconnect}>Disconnect</button></div>
  </div>}
  {message&&<div className={message.toLowerCase().includes('unable')?'error-message catalog-message':'success-message'}>{message}</div>}
  {connected && <FloatingSaveBar dirty={dirty} busy={busy} onSave={save} message="Save delivery, order mode, and supplier preferences." />}
 </section>;
}
