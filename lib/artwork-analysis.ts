import sharp from "sharp";
import { artworkSampleDimensions, visibleArtworkBounds, type ArtworkSource } from "@/lib/artwork-dimensions";

/** Analyze a temporary derivative; the stored production file is never rewritten. */
export async function analyzeOriginalArtwork(buffer: Buffer): Promise<ArtworkSource> {
  const pipeline = sharp(buffer, { limitInputPixels: 268402689 }).autoOrient();
  const metadata = await pipeline.metadata();
  const swap = metadata.orientation && metadata.orientation >= 5;
  const width = (swap ? metadata.height : metadata.width) || 0;
  const height = (swap ? metadata.width : metadata.height) || 0;
  if (!width || !height) throw new Error("Unable to measure the original artwork.");
  const sample = artworkSampleDimensions(width, height);
  const { data, info } = await pipeline.resize(sample.width, sample.height, { fit: "fill", kernel: "nearest" })
    .toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width, height, bounds: visibleArtworkBounds(data, info.width, info.height) };
}
