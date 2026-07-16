const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeDesignDisplayId(prefix = "DSN") {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  const suffix = Array.from(bytes)
    .map((value) => ALPHABET[value % ALPHABET.length])
    .join("");

  return `${prefix}-${suffix}`;
}

export function safeExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "png";
  const allowed = new Set(["png", "jpg", "jpeg", "webp", "svg", "pdf"]);
  return allowed.has(extension) ? extension : "bin";
}
