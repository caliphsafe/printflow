import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import OnboardingWizard from "@/components/OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/signup");

  // Use the authenticated user only to establish identity, then use the server-only
  // admin client to inspect onboarding records. New shops are intentionally inactive
  // until onboarding is complete, so the public active-shop RLS policy cannot be used
  // to determine whether the shop was actually created.
  const admin = createSupabaseAdmin();
  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let shopSlug: string | undefined;
  let hasShop = false;

  if (membership) {
    const { data: shop } = await admin
      .from("shops")
      .select("slug,onboarding_completed_at")
      .eq("organization_id", membership.organization_id)
      .limit(1)
      .maybeSingle();

    if (shop?.onboarding_completed_at) redirect("/dashboard");

    hasShop = Boolean(shop);
    shopSlug = shop?.slug;
  }

  const selectedPlan = String(user.user_metadata?.selected_plan || "growth");
  const defaultBusinessName = String(user.user_metadata?.business_name || "");
  return <OnboardingWizard existing={{ hasShop, shopSlug }} selectedPlan={selectedPlan} defaultBusinessName={defaultBusinessName} />;
}
