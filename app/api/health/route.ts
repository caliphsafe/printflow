import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const environment = { supabaseUrl: Boolean(supabaseUrl), publishableKey: Boolean(publishableKey), secretKey: Boolean(secretKey), appUrl: Boolean(appUrl) };
  if (!supabaseUrl || !secretKey) return NextResponse.json({ ok: false, environment, database: null, message: "Required Supabase server variables are missing." }, { status: 500 });
  try {
    const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: shop, error } = await supabase.from("shops").select("id, slug, name, active").eq("slug", "demo-print-shop").maybeSingle();
    if (error) return NextResponse.json({ ok: false, environment, database: { connected: false, shopFound: false, error: error.message } }, { status: 500 });
    return NextResponse.json({ ok: Boolean(shop), environment, database: { connected: true, shopFound: Boolean(shop), shop } });
  } catch (error) {
    return NextResponse.json({ ok: false, environment, database: { connected: false, shopFound: false, error: error instanceof Error ? error.message : "Unknown health error" } }, { status: 500 });
  }
}
