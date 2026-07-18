import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase-server";
import OnboardingWizard from "@/components/OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signup");
  const { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
  let shopSlug: string | undefined;
  if (membership) {
    const { data: shop } = await supabase.from("shops").select("slug,onboarding_completed_at").eq("organization_id", membership.organization_id).limit(1).maybeSingle();
    if (shop?.onboarding_completed_at) redirect("/dashboard");
    shopSlug = shop?.slug;
  }
  return <OnboardingWizard existing={{ hasShop: Boolean(membership), shopSlug }} />;
}
