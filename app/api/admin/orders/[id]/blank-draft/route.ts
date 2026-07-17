import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";
type Props={params:Promise<{id:string}>};
export async function POST(_request:Request,{params}:Props){
 const {id}=await params; const {supabase,membership,shop}=await getAdminContext(); if(!membership||!shop)return NextResponse.json({error:'No shop configured.'},{status:403});
 const {data:design}=await supabase.from('designs').select('id,status,supplier_items').eq('id',id).eq('shop_id',shop.id).single(); if(!design)return NextResponse.json({error:'Order not found.'},{status:404});
 if(design.status!=='paid')return NextResponse.json({error:'Payment must be confirmed before preparing blanks.'},{status:409});
 const items=Array.isArray(design.supplier_items)?design.supplier_items:[]; if(!items.length)return NextResponse.json({error:'No supplier SKUs are attached to this order.'},{status:409});
 const provider=String(items[0]?.provider||'demo'); const estimatedTotal=items.reduce((sum:number,x:any)=>sum+(Number(x.unitCost||0)*Number(x.quantity||0)),0);
 const {data,error}=await supabase.from('supplier_order_drafts').upsert({organization_id:membership.organization_id,shop_id:shop.id,design_id:design.id,provider,status:'ready',items,estimated_total:estimatedTotal,updated_at:new Date().toISOString()},{onConflict:'design_id,provider'}).select('*').single();
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({draft:data});
}
