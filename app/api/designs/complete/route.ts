import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type CompletePayload = {
  designId: string;
};

export async function POST(request: Request) {
  try {
    const { designId } = (await request.json()) as CompletePayload;

    if (!designId) {
      return NextResponse.json(
        { error: "Missing design session." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { data: design, error } = await supabase
      .from("designs")
      .select("id, display_id, checkout_url, status")
      .eq("id", designId)
      .single();

    if (error || !design) {
      return NextResponse.json(
        { error: "Design session not found." },
        { status: 404 }
      );
    }

    if (design.status !== "draft") {
      return NextResponse.json(
        { error: "Design session has already been completed." },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabase
      .from("designs")
      .update({
        status: "awaiting_payment",
        submitted_at: new Date().toISOString()
      })
      .eq("id", design.id);

    if (updateError) {
      console.error(updateError);
      return NextResponse.json(
        { error: "Unable to finalize the design." },
        { status: 500 }
      );
    }

    const checkoutUrl = new URL(design.checkout_url);
    checkoutUrl.searchParams.set("designId", design.display_id);

    return NextResponse.json({
      displayId: design.display_id,
      checkoutUrl: checkoutUrl.toString()
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Unexpected error." },
      { status: 500 }
    );
  }
}
