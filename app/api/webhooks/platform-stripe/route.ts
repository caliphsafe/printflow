import { NextResponse } from "next/server";
import { handlePlatformStripeWebhook } from "@/lib/platform-billing";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  try {
    await handlePlatformStripeWebhook(rawBody, signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process billing update." }, { status: 400 });
  }
}
