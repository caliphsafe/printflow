import type { ArtworkPlacement, PrintArea } from "@/lib/types";

export type ArtworkBounds = { x: number; y: number; width: number; height: number };
export type ArtworkSource = { width: number; height: number; bounds: ArtworkBounds };
export const ARTWORK_SAMPLE_SIZE = 2048;
export const FULL_ARTWORK_BOUNDS: ArtworkBounds = { x: 0, y: 0, width: 1, height: 1 };
const precise = (n: number) => Number(n.toFixed(6));
const positive = (n: unknown, fallback: number) => typeof n === "number" && Number.isFinite(n) && n > 0 ? n : fallback;

/** The admin's largest visual print box is the physical reference, including legacy zones. */
export function artworkZone(area: PrintArea) {
  const widthInches = positive(area.widthInches, 4);
  const heightInches = positive(area.heightInches, 4);
  const scale = Math.min(positive(area.artworkWidth, area.width) / widthInches, positive(area.artworkHeight, area.height) / heightInches);
  const width = Math.min(800, widthInches * scale);
  const height = Math.min(800, heightInches * scale);
  return {
    x: Math.max(0, Math.min(800 - width, area.defaultX ?? area.x)),
    y: Math.max(0, Math.min(800 - height, area.defaultY ?? area.y)),
    width, height, widthInches, heightInches
  };
}

export function artworkDimensions(area: PrintArea, placement?: ArtworkPlacement) {
  const zone = artworkZone(area);
  const width = placement ? placement.width / zone.width * zone.widthInches : zone.widthInches;
  const height = placement ? placement.height / zone.height * zone.heightInches : zone.heightInches;
  return { widthInches: precise(width), heightInches: precise(height), squareInches: precise(width * height) };
}

export function fitArtwork(placement: ArtworkPlacement, area: PrintArea): ArtworkPlacement {
  const zone = artworkZone(area);
  const ratio = Math.min(zone.width / placement.width, zone.height / placement.height, 1);
  const width = placement.width * ratio;
  const height = placement.height * ratio;
  return { x: Math.max(zone.x, Math.min(zone.x + zone.width - width, placement.x)),
    y: Math.max(zone.y, Math.min(zone.y + zone.height - height, placement.y)), width, height, rotation: 0 };
}

export function resizeArtwork(placement: ArtworkPlacement, area: PrintArea, axis: "width" | "height", inches: number) {
  const zone = artworkZone(area);
  const current = artworkDimensions(area, placement);
  const factor = inches / (axis === "width" ? current.widthInches : current.heightInches);
  return fitArtwork({ ...placement, width: placement.width * factor, height: placement.height * factor }, area);
}

export function validateArtworkPlacement(area: PrintArea, value: unknown): ArtworkPlacement {
  const p = value as ArtworkPlacement | undefined;
  if (!p || ![p.x, p.y, p.width, p.height, p.rotation].every(n => typeof n === "number" && Number.isFinite(n)) || p.width <= 0 || p.height <= 0 || p.rotation !== 0) {
    throw new Error("Artwork dimensions are invalid. Resize or upload your artwork again.");
  }
  const zone = artworkZone(area);
  const tolerance = 0.01; // Floating point noise on the 800 px canvas only.
  if (p.x < zone.x - tolerance || p.y < zone.y - tolerance || p.x + p.width > zone.x + zone.width + tolerance || p.y + p.height > zone.y + zone.height + tolerance) {
    throw new Error("Artwork must fit inside the configured print area.");
  }
  return fitArtwork({ x: p.x, y: p.y, width: p.width, height: p.height, rotation: 0 }, area);
}

export function validateArtworkSource(value: unknown): ArtworkSource {
  const source = value as ArtworkSource | undefined;
  const b = source?.bounds;
  if (!source || !b || ![source.width, source.height, b.x, b.y, b.width, b.height].every(n => typeof n === "number" && Number.isFinite(n)) ||
    source.width <= 0 || source.height <= 0 || b.x < 0 || b.y < 0 || b.width <= 0 || b.height <= 0 || b.x + b.width > 1.000001 || b.y + b.height > 1.000001) {
    throw new Error("Artwork measurements are missing or invalid. Upload the file again.");
  }
  return { width: source.width, height: source.height, bounds: { x: b.x, y: b.y, width: b.width, height: b.height } };
}

/** Bounding rectangle of all nontransparent pixels. White ink and internal gaps remain intact. */
export function visibleArtworkBounds(rgba: ArrayLike<number>, width: number, height: number): ArtworkBounds {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error("This artwork is fully transparent. Choose a file with a visible design.");
  return { x: left / width, y: top / height, width: (right - left + 1) / width, height: (bottom - top + 1) / height };
}

export function artworkSampleDimensions(width: number, height: number) {
  const scale = Math.min(1, ARTWORK_SAMPLE_SIZE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function artworkAspect(source: ArtworkSource) {
  return source.width * source.bounds.width / (source.height * source.bounds.height);
}

/** Match independently decoded uploads, allowing two sample pixels of rasterization variance. */
export function matchingArtworkSource(a: ArtworkSource, b: ArtworkSource) {
  const sample = artworkSampleDimensions(b.width, b.height);
  const toleranceX = 2 / sample.width, toleranceY = 2 / sample.height;
  return Math.abs(a.width / a.height - b.width / b.height) < 0.002 &&
    Math.abs(a.bounds.x - b.bounds.x) <= toleranceX && Math.abs(a.bounds.y - b.bounds.y) <= toleranceY &&
    Math.abs(a.bounds.width - b.bounds.width) <= toleranceX && Math.abs(a.bounds.height - b.bounds.height) <= toleranceY;
}

export function formatArtworkDimensions(value: { widthInches?: number; heightInches?: number; squareInches?: number }) {
  if (!value.widthInches || !value.heightInches) return "";
  const format = (n: number) => Number(n.toFixed(2)).toString();
  return `${format(value.widthInches)}″ × ${format(value.heightInches)}″ · ${format(value.squareInches ?? value.widthInches * value.heightInches)} sq in`;
}

export function roundPricingInput(value: number, decimals = 2) {
  return Number((Number.isFinite(value) ? Math.max(0, value) : 0).toFixed(decimals));
}
