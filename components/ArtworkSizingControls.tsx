"use client";

import { useEffect, useState } from "react";
import { formatArtworkDimensions } from "@/lib/artwork-dimensions";
import type { PrintPricingLine } from "@/lib/types";

export default function ArtworkSizingControls({ line, maxWidth, maxHeight, onResize }: {
  line?: PrintPricingLine; maxWidth: number; maxHeight: number;
  onResize: (axis: "width" | "height", inches: number) => { widthInches: number; heightInches: number };
}) {
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setWidth(Number((line?.widthInches || 0).toFixed(2)).toString());
    setHeight(Number((line?.heightInches || 0).toFixed(2)).toString());
    setError("");
  }, [line?.side, line?.widthInches, line?.heightInches]);

  function commit(axis: "width" | "height", value: string) {
    const inches = Number(value);
    if (!value.trim() || !Number.isFinite(inches) || inches <= 0) {
      setError("Enter a size greater than zero.");
      return;
    }
    const actual = onResize(axis, inches);
    setWidth(Number(actual.widthInches.toFixed(2)).toString());
    setHeight(Number(actual.heightInches.toFixed(2)).toString());
    setError("");
  }

  if (!line?.measured) return <div className="artwork-sizing-card"><p>Upload your artwork to see its actual dimensions and decoration price.</p></div>;
  return <section className="artwork-sizing-card" aria-label="Actual artwork size">
    <strong>Your design: {formatArtworkDimensions(line)}</strong>
    <div className="artwork-dimension-inputs">
      <label>Width (in)<input type="number" inputMode="decimal" min="0.01" max={maxWidth} step="0.01" value={width}
        onChange={event => setWidth(event.target.value)} onBlur={() => commit("width", width)}
        onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
      <label>Height (in)<input type="number" inputMode="decimal" min="0.01" max={maxHeight} step="0.01" value={height}
        onChange={event => setHeight(event.target.value)} onBlur={() => commit("height", height)}
        onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
    </div>
    <small>Proportions stay locked. The design fits within {maxWidth}″ × {maxHeight}″. Transparent outer margins are excluded.</small>
    {error && <p role="alert">{error}</p>}
    <div className="artwork-live-price" aria-live="polite"><span>{line.side === "front" ? "Front" : "Back"} decoration / item</span><b>${line.unitPrice.toFixed(2)}</b></div>
    {line.method === "screen-print" && <small>{line.pricingSize === "heart" ? "Compact" : "Large"} price bracket · {line.inkColors} ink color{line.inkColors === 1 ? "" : "s"}.</small>}
    {line.estimatedStitches != null && <small>Estimated {line.estimatedStitches.toLocaleString()} stitches. The printer confirms the production stitch count.</small>}
    {line.minimumApplied && <small>The shop’s minimum location charge applies before quantity discounts.</small>}
    <small>Includes applicable quantity discounts. Garment and order setup are shown in the quote.</small>
  </section>;
}
