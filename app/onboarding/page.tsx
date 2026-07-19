import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import OnboardingWizard from "@/components/OnboardingWizard";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const admin = createSupabaseAdmin();
  const { data: membership } = await admin.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
  let shopSlug: string | undefined;
  let onboardingState: any = {};
  let hasShop = false;

  if (membership) {
    const { data: shop } = await admin.from("shops").select("slug,onboarding_completed_at,onboarding_state").eq("organization_id", membership.organization_id).limit(1).maybeSingle();
    if (shop?.onboarding_completed_at) redirect("/dashboard");
    hasShop = Boolean(shop);
    shopSlug = shop?.slug;
    onboardingState = shop?.onboarding_state || {};
  }

  const params = await searchParams;
  const requestedPlan = String(params.plan || user.user_metadata?.selected_plan || "growth");
  const selectedPlan = ["starter", "growth", "scale"].includes(requestedPlan) ? requestedPlan : "growth";
  const defaultBusinessName = String(user.user_metadata?.business_name || "");
  const defaultOwnerName = String(user.user_metadata?.full_name || user.user_metadata?.name || "");
  return <OnboardingWizard existing={{ hasShop, shopSlug, onboardingState }} selectedPlan={selectedPlan} defaultBusinessName={defaultBusinessName} defaultOwnerName={defaultOwnerName} defaultEmail={user.email || ""}/>;
}
