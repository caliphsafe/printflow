import PlatformAdminDashboard from "@/components/PlatformAdminDashboard";
import { getPlatformAdminContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function PlatformAdminPage() {
  const { admin } = await getPlatformAdminContext();
  const [
    { data: organizations }, { data: shops }, { data: subscriptions }, { data: designs }, { data: members }, authUsers,
    { data: products }, { data: integrations }, { data: suppliers }, { data: pricingProfiles }, { data: notes }
  ] = await Promise.all([
    admin.from("organizations").select("id,name,slug,subscription_status,created_at").order("created_at", { ascending: false }),
    admin.from("shops").select("id,organization_id,name,slug,active,created_at,onboarding_completed_at,onboarding_state").order("created_at", { ascending: false }),
    admin.from("subscription_accounts").select("organization_id,plan_code,status,current_period_end"),
    admin.from("designs").select("id,organization_id,shop_id,status,payment_status,package_price,paid_amount,created_at"),
    admin.from("organization_members").select("organization_id,user_id,role"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("catalog_products").select("id,organization_id,shop_id,active"),
    admin.from("integration_connections").select("organization_id,shop_id,provider,status"),
    admin.from("supplier_connections").select("organization_id,shop_id,provider,status"),
    admin.from("shop_pricing_profiles").select("organization_id,shop_id"),
    admin.from("platform_account_notes").select("organization_id,note,created_by_email,created_at").order("created_at", { ascending: false })
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
    const activeProducts = (products || []).filter((item: any) => item.organization_id === organization.id && item.active).length;
    const connectedPayments = (integrations || []).filter((item: any) => item.organization_id === organization.id && item.status === "connected" && ["stripe", "square"].includes(item.provider)).map((item: any) => item.provider);
    const connectedSuppliers = (suppliers || []).filter((item: any) => item.organization_id === organization.id && item.status === "connected").map((item: any) => item.provider);
    const accountNotes = (notes || []).filter((item: any) => item.organization_id === organization.id).slice(0, 8);
    return {
      organization,
      shop,
      subscription,
      orderCount: orders.length,
      paidOrderCount: orders.filter((item: any) => item.payment_status === "paid" || item.status === "paid").length,
      revenue,
      memberCount: organizationMembers.length,
      ownerUserId: ownerMembership?.user_id || "",
      ownerEmail: owner?.email || "",
      ownerName: String(owner?.user_metadata?.full_name || ""),
      readiness: {
        payment: connectedPayments.length > 0,
        supplier: connectedSuppliers.length > 0,
        pricing: (pricingProfiles || []).some((item: any) => item.organization_id === organization.id),
        products: activeProducts,
        onboarding: Boolean(shop?.onboarding_completed_at)
      },
      integrations: { payments: connectedPayments, suppliers: connectedSuppliers },
      notes: accountNotes
    };
  });

  return <PlatformAdminDashboard initialRows={rows} />;
}
