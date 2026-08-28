"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdvancedAdminSchoolProduct({ item }: { item: any }) {
  const router = useRouter();
  const [active, setActive] = useState(item.active !== false);
  const [price, setPrice] = useState(Number(item.price || 0));
  const [name, setName] = useState(item.name_override || item.catalog_products?.name || "");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const dirty = active !== item.active || price !== Number(item.price || 0) || name !== (item.name_override || item.catalog_products?.name || "");

  async function save(){
    setBusy(true); setMessage("");
    try{
      const response=await fetch(`/api/advanced-admin/school/${item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({active,price,name})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to save uniform item.");
      setMessage("Uniform item saved.");
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to save uniform item.");}
    finally{setBusy(false)}
  }

  const sizes = item.configuration?.sizes || item.catalog_products?.configuration?.sizes || [];
  return <article className="ae-card ae-product-card">
    <header><div><p className="ae-kicker">ESPIRITO SANTO</p><h3>{name}</h3><small>{sizes.length ? sizes.join(" · ") : "Preset sizes"}</small></div><label className="ae-switch"><input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)}/><span>{active?"LIVE":"HIDDEN"}</span></label></header>
    <label className="ae-field"><span>Customer-facing name</span><input value={name} onChange={(e)=>setName(e.target.value)}/></label>
    <label className="ae-field"><span>Price per item</span><div className="ae-money-wrap"><b>$</b><input type="number" min="0" step="0.01" value={price} onChange={(e)=>setPrice(Math.max(0,Number(e.target.value||0)))}/></div></label>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><small className={`ae-message ${message.includes("saved")?"success":"error"}`}>{message}</small><button className="ae-button primary" disabled={busy||!dirty} onClick={save}>{busy?"Saving…":"Save item"}</button></div>
  </article>;
}
