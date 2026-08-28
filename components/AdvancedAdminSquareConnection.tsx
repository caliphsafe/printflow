"use client";
import { useState } from "react";

export default function AdvancedAdminSquareConnection({ connected, accountLabel, environment }: { connected: boolean; accountLabel?: string; environment?: string }) {
  const [accessToken,setAccessToken]=useState("");
  const [mode,setMode]=useState(environment === "sandbox" ? "sandbox" : "production");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  async function connect(){
    setBusy(true); setMessage("");
    try{
      const response=await fetch("/api/admin/integrations/connections",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:"square",category:"payment",credentials:{accessToken,environment:mode}})});
      const data=await response.json();
      if(!response.ok||!data.ok)throw new Error(data.error||"Square connection failed.");
      setMessage("Square connected. Customer payments will update Advanced orders automatically.");
      setAccessToken("");
      location.reload();
    }catch(error){setMessage(error instanceof Error?error.message:"Square connection failed.");}
    finally{setBusy(false)}
  }

  return <article className="ae-card ae-connection">
    <header><div className="ae-provider"><span>SQ</span><div><h3>Square</h3><small>{connected ? accountLabel || "Connected account" : "Customer payments"}</small></div></div><em className={`ae-status ${connected?"paid":"failed"}`}>{connected ? environment === "sandbox" ? "sandbox" : "connected" : "setup needed"}</em></header>
    <p style={{fontSize:9,color:"var(--ae-muted)",lineHeight:1.6}}>Square handles customer checkout. PrintFlow verifies the location, creates the payment webhook and updates order payment status automatically.</p>
    <div className="integration-form">
      <label><span>{connected ? "New Square access token (only to replace connection)" : "Square access token"}</span><input type="password" value={accessToken} onChange={(e)=>setAccessToken(e.target.value)} placeholder={connected ? "Leave blank unless changing account" : "Paste token"}/></label>
      <label><span>Environment</span><select value={mode} onChange={(e)=>setMode(e.target.value)}><option value="production">Production / live</option><option value="sandbox">Sandbox / test</option></select></label>
    </div>
    {message&&<div className={message.includes("connected")?"success-message":"error-message"}>{message}</div>}
    <button className="ae-button primary" disabled={busy||!accessToken} onClick={connect}>{busy?"Verifying…":connected?"Replace Square connection":"Connect Square"}</button>
  </article>;
}
