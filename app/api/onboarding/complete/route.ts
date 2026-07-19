import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";

export async function POST(request: Request) {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "Create a shop first." }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const publish = body.publish === true;
  const { error } = await supabase.from("shops").update({ active: publish ? true : shop.active, onboarding_completed_at: now, onboarding_state: { ...(shop.onboarding_state || {}), step: "complete", completedAt: now, publishedAtCompletion: publish }, updated_at: now }).eq("id", shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, published: publish });
}
