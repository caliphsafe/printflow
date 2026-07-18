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

function errorMessage(data: unknown, status: number) {
  if (typeof data === "object" && data) {
    const record = data as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) return record.message;
    if (Array.isArray(record.errors)) {
      const messages = record.errors
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const entry = item as Record<string, unknown>;
          return [entry.field, entry.message].filter(Boolean).map(String).join(": ");
        })
        .filter(Boolean);
      if (messages.length) return messages.join(" · ");
    }
  }
  return `S&S request failed (${status}).`;
}

export async function ssRequest<T>(row: ConnectionRow, path: string, init: RequestInit = {}): Promise<T> {
  const { accountNumber, apiKey } = ssCredentials(row);
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    signal: init.signal || AbortSignal.timeout(30000),
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
  if (!response.ok) throw new Error(errorMessage(data, response.status));
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

export function safeImageUrl(value: unknown, size: "source" | "large" | "small" = "source") {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    let absolute = text.startsWith("Images/") || text.startsWith("/Images/")
      ? `https://www.ssactivewear.com/${text.replace(/^\//, "")}`
      : text.startsWith("//") ? `https:${text}` : text;
    if (size !== "source") {
      const token = size === "large" ? "_fl" : "_fs";
      absolute = absolute.replace(/_fm(?=\.[a-z0-9]+(?:\?|$))/i, token);
    }
    const url = new URL(absolute);
    return url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
}
