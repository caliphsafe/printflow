import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Missing image URL." }, { status: 400 });
  try {
    const url = new URL(raw);
    const allowed = url.protocol === "https:" && (url.hostname === "ssactivewear.com" || url.hostname.endsWith(".ssactivewear.com"));
    if (!allowed) return NextResponse.json({ error: "Image host is not allowed." }, { status: 403 });
    const response = await fetch(url, { next: { revalidate: 86400 } });
    if (!response.ok) return NextResponse.json({ error: "Image unavailable." }, { status: 404 });
    return new NextResponse(response.body, { headers: { "Content-Type": response.headers.get("content-type") || "image/jpeg", "Cache-Control": "public, max-age=86400, s-maxage=86400" } });
  } catch { return NextResponse.json({ error: "Invalid image URL." }, { status: 400 }); }
}
