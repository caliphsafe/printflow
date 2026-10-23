import { analyzeOriginalArtwork } from "@/lib/artwork-analysis";
import { artworkDimensions, matchingArtworkSource, validateArtworkPlacement, validateArtworkSource } from "@/lib/artwork-dimensions";
import type { PrintArea } from "@/lib/types";

type StoredSide = { originalPath: string; source?: unknown; placement: unknown; printArea: PrintArea };

/** Only new sizing-aware orders are verified; existing paid orders and legacy files stay unchanged. */
export async function verifyOrderArtwork(design: {
  design_configuration?: { artworkSizingVersion?: number; printLines?: Array<{ side: string; widthInches?: number; heightInches?: number; squareInches?: number }> };
  design_sides?: Record<string, StoredSide>;
}, download: (path: string) => Promise<Buffer>) {
  if (design.design_configuration?.artworkSizingVersion !== 2) return;
  const sides = Object.entries(design.design_sides || {});
  if (!sides.length) throw new Error("Artwork measurements are missing. Please submit the design again.");
  for (const [side, file] of sides) {
    const source = validateArtworkSource(file.source);
    const placement = validateArtworkPlacement(file.printArea, file.placement);
    const original = await analyzeOriginalArtwork(await download(file.originalPath));
    if (!matchingArtworkSource(source, original)) {
      throw new Error(`The ${side} original artwork does not match its measured preview. Please upload the file again.`);
    }
    const dimensions = artworkDimensions(file.printArea, placement);
    const line = design.design_configuration?.printLines?.find(line => line.side === side);
    if (!line || ["widthInches", "heightInches", "squareInches"].some(key => {
      const field = key as keyof typeof dimensions;
      return typeof line[field] !== "number" || Math.abs(dimensions[field] - line[field]!) > 0.00001;
    })) throw new Error(`The ${side} artwork measurements do not match the quote. Please submit the design again.`);
  }
}
