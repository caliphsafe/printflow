import SupplierHub from "@/components/SupplierHub";
import { getAdminContext } from "@/lib/admin-data";
export const dynamic='force-dynamic';
export default async function SuppliersPage(){const {supabase,shop}=await getAdminContext();if(!shop)return <p>No shop configured.</p>;const [{data:supplier},{data:products},{count:draftCount}]=await Promise.all([
 supabase.from('supplier_connections').select('status,account_hint,settings,last_tested_at').eq('shop_id',shop.id).eq('provider','ss-activewear').maybeSingle(),
 supabase.from('catalog_products').select('configuration').eq('shop_id',shop.id),
 supabase.from('supplier_order_drafts').select('*',{count:'exact',head:true}).eq('shop_id',shop.id).in('status',['draft','ready'])
]);return <><header className="admin-header"><div><p className="eyebrow">SUPPLIERS</p><h1>Supplier Hub</h1><p>Manage wholesale connections, import blanks and prepare purchasing from one place.</p></div></header><SupplierHub supplier={supplier} productCount={(products||[]).filter((p:any)=>p.configuration?.supplier).length} draftCount={draftCount||0}/></>}
