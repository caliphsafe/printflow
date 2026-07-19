import AccountBillingManager from "@/components/AccountBillingManager";
import { getAdminContext } from "@/lib/admin-data";
import { platformBillingConfigured } from "@/lib/platform-billing";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { supabase, user, membership } = await getAdminContext();
  if (!membership) return <p>Account setup is incomplete.</p>;
  const [{ data: account }, { data: plans }] = await Promise.all([
    supabase.from("subscription_accounts").select("plan_code,status,current_period_end,provider_customer_id").eq("organization_id", membership.organization_id).maybeSingle(),
    supabase.from("subscription_plans").select("code,name,monthly_price,description,features,order_limit").eq("active", true).order("sort_order")
  ]);
  return <AccountBillingManager plans={(plans || []) as any} account={account as any} billingConfigured={platformBillingConfigured()} email={user.email || ""} />;
}
