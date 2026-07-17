"use client";
import { useState } from "react";
export default function OrderBlanksButton({designId,enabled,testMode,alreadyOrdered}:{designId:string;enabled:boolean;testMode:boolean;alreadyOrdered:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function order(){const warning=testMode?'Create a TEST S&S order? S&S says test orders are created and canceled automatically.':'PLACE A LIVE WHOLESALE ORDER with S&S now?';if(!confirm(warning))return;setBusy(true);setMessage('');const r=await fetch(`/api/admin/orders/${designId}/order-blanks`,{method:'POST'});const d=await r.json();setBusy(false);if(!r.ok)return setMessage(d.error||'Unable to order blanks.');setMessage(`S&S order confirmed: ${(d.orderNumbers||[]).join(', ')}`);}
 if(alreadyOrdered)return <div className="success-message">Blank order already submitted to S&amp;S.</div>;
 return <div className="order-blanks-panel"><button className="primary-button" disabled={!enabled||busy} onClick={order}>{busy?'Submitting to S&S…':testMode?'Create test blank order':'Order blanks from S&S'}</button>{!enabled&&<p>Available after payment is confirmed and the design contains imported S&amp;S SKUs.</p>}{message&&<div className={message.startsWith('S&S order')?'success-message':'error-message catalog-message'}>{message}</div>}</div>;
}
