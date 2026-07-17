import { decryptSecret } from "@/lib/crypto";

type ConnectionRow = {
  encrypted_account_number: string;
  encrypted_api_key: string;
  settings?: Record<string, unknown> | null;
};

const BASE_URL = "https://api.ssactivewear.com/v2";

export function ssCredentials(row: ConnectionRow) {
  return {
    accountNumber: decryptSecret(row.encrypted_account_number),
    apiKey: decryptSecret(row.encrypted_api_key)
  };
}

export async function ssRequest<T>(row: ConnectionRow, path: string, init: RequestInit = {}): Promise<T> {
  const { accountNumber, apiKey } = ssCredentials(row);
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountNumber}:${apiKey}`).toString("base64")}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data ? String((data as {message?: unknown}).message) : `S&S request failed (${response.status}).`;
    throw new Error(message);
  }
  return data as T;
}

export function field<T = unknown>(row: Record<string, unknown>, ...names: string[]): T | undefined {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) return row[name] as T;
    const match = Object.keys(row).find((key) => key.toLowerCase() === name.toLowerCase());
    if (match && row[match] !== undefined && row[match] !== null) return row[match] as T;
  }
}

export function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function safeImageUrl(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const absolute = text.startsWith("Images/") || text.startsWith("/Images/")
      ? `https://www.ssactivewear.com/${text.replace(/^\//, "")}`
      : text.startsWith("//") ? `https:${text}` : text;
    const url = new URL(absolute);
    return url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
}
