import PlatformAdminDashboard from "@/components/PlatformAdminDashboard";
import { getPlatformAdminContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  const { admin } = await getPlatformAdminContext();
  const [{ data: organizations }, { data: shops }, { data: subscriptions }, { data: designs }, { data: members }, authUsers] = await Promise.all([
    admin.from("organizations").select("id,name,slug,subscription_status,created_at").order("created_at", { ascending: false }),
    admin.from("shops").select("id,organization_id,name,slug,active,created_at,onboarding_completed_at").order("created_at", { ascending: false }),
    admin.from("subscription_accounts").select("organization_id,plan_code,status,current_period_end"),
    admin.from("designs").select("id,organization_id,shop_id,status,payment_status,package_price,paid_amount,created_at"),
    admin.from("organization_members").select("organization_id,user_id,role"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  ]);
  const usersById = new Map((authUsers.data?.users || []).map((user) => [user.id, user]));

  const rows = (organizations || []).map((organization: any) => {
    const shop = (shops || []).find((item: any) => item.organization_id === organization.id);
    const subscription = (subscriptions || []).find((item: any) => item.organization_id === organization.id);
    const orders = (designs || []).filter((item: any) => item.organization_id === organization.id);
    const revenue = orders.reduce((sum: number, item: any) => sum + Number(item.paid_amount || 0), 0);
    const organizationMembers = (members || []).filter((item: any) => item.organization_id === organization.id);
    const ownerMembership = organizationMembers.find((item: any) => item.role === "owner") || organizationMembers[0];
    const owner = ownerMembership ? usersById.get(ownerMembership.user_id) : undefined;
    return {
      organization,
      shop,
      subscription,
      orderCount: orders.length,
      revenue,
      memberCount: organizationMembers.length,
      ownerEmail: owner?.email || "",
      ownerName: String(owner?.user_metadata?.full_name || "")
    };
  });

  return <PlatformAdminDashboard initialRows={rows} />;
}
