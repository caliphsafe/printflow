export type ApiResponseData = Record<string, any>;

/**
 * Reads an API response without assuming Vercel/Next returned JSON.
 *
 * Application routes normally return JSON, but platform-level failures
 * (timeouts, crashes, deployment/runtime errors, auth/proxy failures) can be
 * plain text or HTML. Calling response.json() directly masks the real error
 * with a SyntaxError such as: Unexpected token 'A', "An error o"...
 */
export async function readApiResponse(response: Response): Promise<ApiResponseData> {
  const raw = await response.text();

  if (!raw.trim()) {
    return {
      ok: response.ok,
      error: response.ok
        ? ""
        : `Request failed with HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`
    };
  }

  try {
    return JSON.parse(raw) as ApiResponseData;
  } catch {
    const cleaned = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();

    return {
      ok: response.ok,
      error:
        cleaned ||
        `Request failed with HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`,
      nonJson: true,
      status: response.status,
      contentType: response.headers.get("content-type") || ""
    };
  }
}
