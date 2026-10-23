import type { PointerEventHandler } from "react";
import type { ArtworkPlacement } from "@/lib/types";
import type { ArtworkSource } from "@/lib/artwork-dimensions";

export default function ArtworkImage({ src, placement, source, onPointerDown }: {
  src: string; placement: ArtworkPlacement; source?: ArtworkSource | null;
  onPointerDown?: PointerEventHandler<SVGSVGElement>;
}) {
  const width = source?.width || 1, height = source?.height || 1;
  const bounds = source?.bounds || { x: 0, y: 0, width: 1, height: 1 };
  return <svg x={placement.x} y={placement.y} width={placement.width} height={placement.height}
    viewBox={`${bounds.x * width} ${bounds.y * height} ${bounds.width * width} ${bounds.height * height}`}
    preserveAspectRatio="none" overflow="hidden" onPointerDown={onPointerDown} style={{ cursor: onPointerDown ? "move" : undefined }}>
    <image href={src} x="0" y="0" width={width} height={height} preserveAspectRatio="none" />
  </svg>;
}
