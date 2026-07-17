import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
import { ssRequest } from "@/lib/ss-activewear";
type Props={params:Promise<{id:string}>};
export async function POST(_request:Request,{params}:Props){
 const {id}=await params; const {supabase,membership,shop}=await getAdminContext(); if(!membership||!shop)return NextResponse.json({error:"No shop configured."},{status:403});
 const [{data:design},{data:connection},{data:existing}]=await Promise.all([
  supabase.from('designs').select('id,display_id,status,supplier_items').eq('id',id).eq('shop_id',shop.id).single(),
  supabase.from('supplier_connections').select('encrypted_account_number,encrypted_api_key,settings').eq('shop_id',shop.id).eq('provider','ss-activewear').single(),
  supabase.from('supplier_orders').select('id,external_order_numbers').eq('design_id',id).eq('provider','ss-activewear').maybeSingle()
 ]);
 if(!design)return NextResponse.json({error:'Order not found.'},{status:404});
 if(existing)return NextResponse.json({error:'Blanks have already been ordered for this design.'},{status:409});
 if(design.status!=='paid')return NextResponse.json({error:'Customer payment must be confirmed before ordering blanks.'},{status:409});
 if(!connection)return NextResponse.json({error:'Connect S&S Activewear under Integrations first.'},{status:409});
 const items=Array.isArray(design.supplier_items)?design.supplier_items:[]; if(!items.length)return NextResponse.json({error:'This design does not contain imported S&S SKUs.'},{status:409});
 const s:any=connection.settings||{}; const a=s.shippingAddress||{};
 if(!a.customer||!a.address||!a.city||!a.state||!a.zip)return NextResponse.json({error:'Complete the supplier delivery address under Integrations.'},{status:400});
 const payload={shippingAddress:{customer:a.customer,attn:a.attn||'',address:a.address,city:a.city,state:a.state,zip:a.zip,residential:a.residential===true},shippingMethod:String(s.shippingMethod||'1'),shipBlind:false,poNumber:`PF-${design.display_id}`,emailConfirmation:String(s.emailConfirmation||''),testOrder:s.testMode!==false,autoselectWarehouse:s.autoselectWarehouse!==false,rejectLineErrors:true,...(s.paymentProfile?.email&&s.paymentProfile?.profileID?{paymentProfile:s.paymentProfile}:{}),lines:items.map((x:any)=>({identifier:String(x.sku),qty:Number(x.quantity)}))};
 try{
  const response=await ssRequest<any[]>(connection,'/orders/',{method:'POST',body:JSON.stringify(payload)});
  const orders=Array.isArray(response)?response:[]; const orderNumbers=orders.map((x:any)=>String(x.orderNumber||'')).filter(Boolean);
  const {error}=await supabase.from('supplier_orders').insert({organization_id:membership.organization_id,shop_id:shop.id,design_id:design.id,provider:'ss-activewear',status:'confirmed',test_order:payload.testOrder,external_order_numbers:orderNumbers,request_payload:payload,response_payload:response});
  if(error)throw error; return NextResponse.json({ok:true,orderNumbers,testOrder:payload.testOrder});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to submit S&S order.'},{status:502});}
}
