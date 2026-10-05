export type ProductImageChoice = {
  url: string;
  label?: string;
  classTypeId?: string;
};

export type NormalizedProductImageChoice = ProductImageChoice & {
  label: string;
};

function imageDescription(choice: ProductImageChoice) {
  return `${choice.label || ""} ${choice.url || ""}`.toLowerCase();
}

export function isModelProductImage(choice: ProductImageChoice) {
  return /\b(model|on[- ]?model|lifestyle|worn|wearing)\b/i.test(imageDescription(choice));
}

export function isSwatchProductImage(choice: ProductImageChoice) {
  return choice.classTypeId?.trim() === "1004" || /\b(swatch|color square|colour square)\b/i.test(imageDescription(choice));
}

export function isBackProductImage(choice: ProductImageChoice) {
  return choice.classTypeId?.trim() === "1008" || /\b(back|rear|reverse)\b/i.test(imageDescription(choice));
}

export function productImageChoiceKey(choice: ProductImageChoice & { colorName?: string }) {
  const label = choice.colorName && choice.label?.startsWith(`${choice.colorName} · `)
    ? choice.label.slice(choice.colorName.length + 3)
    : String(choice.label || "Product image");
  const classTypeId = String(choice.classTypeId || "").trim();
  const flatSide = classTypeId.match(/^flat-(front|back)$/i);
  if (flatSide) return `flat-${flatSide[1].toLowerCase()}`;

  // SanMar's Media Content class identifies a broad view (front/rear), while
  // the filename suffix distinguishes the individual shot (for example FS06).
  // Keeping both lets admins pick the exact shot and map that shot across colors.
  try {
    const filename = decodeURIComponent(new URL(choice.url).pathname.split("/").pop() || "");
    const shot = filename.match(/(?:^|[_-])(front|rear|back)[_-]([a-z]{1,5}\d{1,3})(?:\.[a-z0-9]+)?$/i);
    if (shot) return `${classTypeId || "view"}:${shot[1].toLowerCase()}:${shot[2].toLowerCase()}`;
  } catch {}

  return classTypeId || label.trim().toLowerCase().replace(/\s+/g, " ");
}

export function uniqueProductImageChoices(...groups: Array<ProductImageChoice[] | null | undefined>): NormalizedProductImageChoice[] {
  const choices = new Map<string, NormalizedProductImageChoice>();
  for (const choice of groups.flatMap((group) => group || [])) {
    const url = String(choice.url || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const next: NormalizedProductImageChoice = { ...choice, url, label: String(choice.label || "Product image").trim() || "Product image" };
    const previous = choices.get(url);
    if (!previous || imageLabelScore(next.label) > imageLabelScore(previous.label)) choices.set(url, next);
  }
  return Array.from(choices.values());
}

function imageLabelScore(label: string) {
  if (/current|selected/i.test(label)) return 0;
  if (/flat/i.test(label)) return 5;
  if (/model|lifestyle/i.test(label)) return 3;
  if (/front|back|side|detail|angle|primary|product image/i.test(label)) return 2;
  return 1;
}

/** Select an image in this order: flat, other non-model image, then model. */
export function defaultProductImage(choices: ProductImageChoice[], side: "front" | "back" = "front") {
  const usable = choices.filter((choice) => choice.url && !isSwatchProductImage(choice));
  let sideChoices = side === "back" ? usable.filter(isBackProductImage) : usable.filter((choice) => !isBackProductImage(choice));

  if (!sideChoices.length && side === "front") sideChoices = usable;
  if (!sideChoices.length) return "";

  const flat = sideChoices.find((choice) => /\bflat\b/i.test(choice.label || ""));
  if (flat) return flat.url;
  const primary = sideChoices.find((choice) => /\bprimary\b/i.test(choice.label || "") && !isModelProductImage(choice));
  if (primary) return primary.url;
  const nonModel = sideChoices.find((choice) => !isModelProductImage(choice));
  if (nonModel) return nonModel.url;
  return sideChoices[0].url;
}
