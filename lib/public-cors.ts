const DEFAULT_ALLOWED = [
  "https://www.advancedembroideryma.com",
  "https://advancedembroideryma.com"
];

export function publicCors(request: Request) {
  const configured = String(process.env.ADVANCED_ALLOWED_ORIGINS || "")
    .split(",").map((v) => v.trim()).filter(Boolean);
  const allowed = new Set([...DEFAULT_ALLOWED, ...configured]);
  const origin = request.headers.get("origin") || "";
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  const accepted = !origin || allowed.has(origin) || local;
  return {
    accepted,
    headers: {
      "Access-Control-Allow-Origin": origin && accepted ? origin : DEFAULT_ALLOWED[0],
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    }
  };
}
