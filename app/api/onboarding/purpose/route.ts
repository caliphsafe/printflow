import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { ShopAccountMode } from "@/lib/shop-mode";

const allowed = new Set<ShopAccountMode>(["custom", "brand", "hybrid"]);

export async function POST(request: Request) {
  const auth = await createSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await request.json();
  const accountMode = String(body.accountMode || "") as ShopAccountMode;
  if (!allowed.has(accountMode)) return NextResponse.json({ error: "Choose a valid PrintFlow workflow." }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      printflow_account_mode: accountMode
    }
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, accountMode });
}
