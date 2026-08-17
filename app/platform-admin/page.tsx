import PlatformAdminDashboard from "@/components/PlatformAdminDashboard";
import { getPlatformAdminContext } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

const PLAN_LIMITS: Record<string, number | null> = { starter: 75, growth: 300, scale: null };

function daysBetween(a: Date, b: Date) {
  return Math.max(0, (a.getTime() - b.getTime()) / 86400000);
}

function cadenceFor(orders: any[], planCode: string) {
  const now = new Date();
  const start30 = new Date(now.getTime() - 30 * 86400000);
  const start60 = new Date(now.getTime() - 60 * 86400000);
  const start90 = new Date(now.getTime() - 90 * 86400000);
  const last30Orders = orders.filter((item) => new Date(item.created_at) >= start30);
  const previous30Orders = orders.filter((item) => new Date(item.created_at) >= start60 && new Date(item.created_at) < start30);
  const last90Orders = orders.filter((item) => new Date(item.created_at) >= start90);
  const sorted = [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const gaps = sorted.slice(1).map((item, index) => daysBetween(new Date(item.created_at), new Date(sorted[index].created_at)));
  const averageDaysBetween = gaps.length ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : null;
  const lastOrderAt = sorted.at(-1)?.created_at || null;
  const daysSinceLastOrder = lastOrderAt ? Math.floor(daysBetween(now, new Date(lastOrderAt))) : null;
  const paidLast30 = last30Orders.filter((item) => item.payment_status === "paid" || item.status === "paid");
  const paidVolume30 = paidLast30.reduce((sum, item) => sum + Number(item.paid_amount || item.package_price || 0), 0);
  const averageOrderValue = paidLast30.length ? paidVolume30 / paidLast30.length : 0;
  const growthRate = previous30Orders.length ? (last30Orders.length - previous30Orders.length) / previous30Orders.length : last30Orders.length ? 1 : 0;
  const monthlyLimit = PLAN_LIMITS[planCode] ?? 75;
  const utilization = monthlyLimit ? last30Orders.length / monthlyLimit : 0;
  const months = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const end = new Date(now.getFullYear(), now.getMonth() - (4 - index), 1);
    return { label: start.toLocaleDateString("en-US", { month: "short" }), count: orders.filter((item) => { const date = new Date(item.created_at); return date >= start && date < end; }).length };
  });
  return { last30: last30Orders.length, previous30: previous30Orders.length, last90: last90Orders.length, growthRate, utilization, averageDaysBetween, lastOrderAt, daysSinceLastOrder, averageOrderValue, paidVolume30, monthlyLimit, months };
}

function growthSignal(row: any) {
  const plan = row.subscription?.plan_code || "starter";
  const nextPlan = plan === "starter" ? "growth" : plan === "growth" ? "scale" : null;
  let score = 0;
  if (row.cadence.utilization >= .7) score += 45;
  else if (row.cadence.utilization >= .45) score += 25;
  if (row.cadence.growthRate >= .25) score += 25;
  if (row.cadence.last30 >= 15) score += 15;
  if (row.cadence.averageOrderValue >= 300) score += 10;
  if (row.readiness.products >= 10) score += 5;
  let segment = "healthy";
  let reason = "Account is operating within the current plan.";
  if (["past_due", "canceled"].includes(row.subscription?.status || "")) { segment = "retention"; reason = "Billing status needs immediate attention."; }
  else if (!row.readiness.onboarding || !row.readiness.payment || row.readiness.products === 0) { segment = "onboarding"; reason = "Setup assistance can help this account reach its first paid order."; }
  else if (nextPlan && score >= 50) { segment = "upgrade"; reason = `${Math.round(row.cadence.utilization * 100)}% of the monthly order allowance is in use with ${row.cadence.growthRate >= 0 ? "positive" : "slower"} order momentum.`; }
  else if (row.cadence.daysSinceLastOrder !== null && row.cadence.daysSinceLastOrder > 45 && row.orderCount > 0) { segment = "reengage"; reason = `No new order in ${row.cadence.daysSinceLastOrder} days.`; }
  return { score, segment, reason, recommendedPlan: segment === "upgrade" ? nextPlan : null };
}

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
    const planCode = subscription?.plan_code || "starter";
    const cadence = cadenceFor(orders, planCode);
    const row: any = {
      organization, shop, subscription,
      orderCount: orders.length,
      paidOrderCount: orders.filter((item: any) => item.payment_status === "paid" || item.status === "paid").length,
      revenue, memberCount: organizationMembers.length,
      ownerUserId: ownerMembership?.user_id || "",
      ownerEmail: owner?.email || "",
      ownerName: String(owner?.user_metadata?.full_name || ""),
      ownerCreatedAt: owner?.created_at || null,
      ownerLastSignInAt: owner?.last_sign_in_at || null,
      ownerEmailConfirmedAt: owner?.email_confirmed_at || null,
      readiness: { payment: connectedPayments.length > 0, supplier: connectedSuppliers.length > 0, pricing: (pricingProfiles || []).some((item: any) => item.organization_id === organization.id), products: activeProducts, onboarding: Boolean(shop?.onboarding_completed_at) },
      integrations: { payments: connectedPayments, suppliers: connectedSuppliers },
      notes: accountNotes, cadence
    };
    row.growth = growthSignal(row);
    return row;
  });

  return <PlatformAdminDashboard initialRows={rows} />;
}
