import { NextResponse } from "next/server";

function isAllowedSupplierHost(hostname: string) {
  const host = hostname.toLowerCase();

  return (
    host === "ssactivewear.com" ||
    host.endsWith(".ssactivewear.com") ||
    host === "sanmar.com" ||
    host.endsWith(".sanmar.com")
  );
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");

  if (!raw) {
    return NextResponse.json(
      { error: "Missing image URL." },
      { status: 400 }
    );
  }

  try {
    const url = new URL(raw);

    if (url.protocol !== "https:" || !isAllowedSupplierHost(url.hostname)) {
      return NextResponse.json(
        { error: "Image host is not allowed." },
        { status: 403 }
      );
    }

    const response = await fetch(url, {
      next: { revalidate: 86400 },
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });

    if (!response.ok || !response.body) {
      return NextResponse.json(
        { error: "Image unavailable." },
        { status: 404 }
      );
    }

    return new NextResponse(response.body, {
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "image/jpeg",
        "Cache-Control":
          "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid image URL." },
      { status: 400 }
    );
  }
}
