// ascii-canvas — renders a Pixel ASCII artifact as a strict monospace
// grid. every glyph occupies exactly one cell; no sub-pixel positioning,
// no decorative drift. animation reveals glyphs in their `order`, so
// classic families type top-to-bottom like a terminal and monograms
// bloom outward from the centre.

import { useMemo } from "react";
import type { AsciiArtifact } from "@/lib/ascii";

interface Props {
  artifact: AsciiArtifact;
  revealed: number;
  fontSize?: number;       // px
  cellWidth?: number;      // px override per cell (defaults to monospace ch)
  showGrid?: boolean;
  inkColor?: string;
  bgColor?: string;
}

export function AsciiCanvas({
  artifact,
  revealed,
  fontSize = 16,
  cellWidth,
  showGrid = false,
  inkColor = "var(--ink)",
  bgColor = "transparent",
}: Props) {
  const cw = cellWidth ?? Math.round(fontSize * 0.62);
  const ch = Math.round(fontSize * 1.05);

  const lines = useMemo(() => {
    const limit = Math.min(revealed, artifact.order.length);
    const mask: boolean[][] = Array.from({ length: artifact.rows }, () =>
      Array(artifact.cols).fill(false),
    );
    for (let i = 0; i < limit; i++) {
      const { x, y } = artifact.order[i];
      mask[y][x] = true;
    }
    return artifact.cells.map((row, y) =>
      row.map((g, x) => (mask[y][x] ? g : " ")).join(""),
    );
  }, [artifact, revealed]);

  return (
    <div
      className="relative inline-block"
      style={{
        background: bgColor,
        padding: "0.75rem",
      }}
    >
      {showGrid && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-3"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 0 1px, transparent 1px 100%), linear-gradient(to bottom, currentColor 0 1px, transparent 1px 100%)`,
            backgroundSize: `${cw}px ${ch}px`,
            color: inkColor,
            opacity: 0.08,
          }}
        />
      )}
      <pre
        className="m-0 font-mono"
        style={{
          color: inkColor,
          fontSize,
          lineHeight: `${ch}px`,
          letterSpacing: 0,
          fontVariantLigatures: "none",
          fontFeatureSettings: '"liga" 0, "calt" 0',
          whiteSpace: "pre",
        }}
      >
        {lines.join("\n")}
      </pre>
    </div>
  );
}
