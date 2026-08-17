import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Brand pricing has moved to Retail Economics at /api/admin/brand-retail." },
    { status: 410 }
  );
}
