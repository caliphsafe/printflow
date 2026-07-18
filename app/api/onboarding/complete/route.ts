import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin-data";

export async function POST() {
  const { supabase, shop } = await getAdminContext();
  if (!shop) return NextResponse.json({ error: "Create a shop first." }, { status: 400 });
  const now = new Date().toISOString();
  const { error } = await supabase.from("shops").update({ active: true, onboarding_completed_at: now, onboarding_state: { step: "complete", completedAt: now }, updated_at: now }).eq("id", shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
