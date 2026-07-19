import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function redirectOrigin(request: Request) {
  const url = new URL(request.url);
  if (process.env.NODE_ENV === "development") return url.origin;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  const requestedNext = safeNext(url.searchParams.get("next"));
  const plan = ["starter", "growth", "scale"].includes(String(url.searchParams.get("plan")))
    ? String(url.searchParams.get("plan"))
    : "growth";
  const origin = redirectOrigin(request);

  if (providerError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(providerError)}`);
  }

  const supabase = await createSupabaseServer();
  let authError: Error | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    authError = result.error;
  } else if (tokenHash && type) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any });
    authError = result.error;
  } else {
    authError = new Error("The sign-in link is incomplete or has expired.");
  }

  if (authError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(authError.message)}`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Your session could not be created. Please try again.")}`);

  await supabase.auth.updateUser({
    data: {
      ...(user.user_metadata || {}),
      selected_plan: user.user_metadata?.selected_plan || plan,
      onboarding_source: user.app_metadata?.provider || "email"
    }
  });

  const admin = createSupabaseAdmin();
  const { data: membership } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let destination = requestedNext;
  if (!membership && destination === "/dashboard") destination = "/onboarding";
  if (membership && destination === "/onboarding") {
    const { data: shop } = await admin
      .from("shops")
      .select("onboarding_completed_at")
      .eq("organization_id", membership.organization_id)
      .limit(1)
      .maybeSingle();
    if (shop?.onboarding_completed_at) destination = "/dashboard";
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
