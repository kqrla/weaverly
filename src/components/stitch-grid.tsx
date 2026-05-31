// stitch-grid renderer
// ---------------------------------------------------------------
// renders a CrossStitchChart as a real lattice. each cell is a
// fixed-size square outlined like aida cloth, with an svg stitch
// drawn inside. nothing here is procedural ascii — every stitch
// is a deliberate textile primitive snapped to integer coordinates.

import type { CrossStitchChart, StitchCell, ThreadColor } from "@/lib/cross-stitch";

interface Props {
  chart: CrossStitchChart;
  revealed: number;         // how many cells (row-major) to draw
  cellSize?: number;        // px per cell — controls perceived weave density
  showLattice?: boolean;
}

const COLOR_VAR: Record<ThreadColor, string> = {
  ink: "var(--color-ink)",
  ember: "var(--color-ember)",
  stripe: "color-mix(in oklab, var(--color-stripe) 70%, var(--color-ink) 30%)",
};

export function StitchGrid({ chart, revealed, cellSize = 22, showLattice = true }: Props) {
  const { cols, rows, cells } = chart;
  // svg width + height in px — the chart is a fixed pixel lattice.
  const w = cols * cellSize;
  const h = rows * cellSize;

  return (
    <div className="relative inline-block">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        // role + aria so screen readers can describe the chart as an embroidery diagram.
        role="img"
        aria-label="cross-stitch chart"
        style={{
          // a subtle warm-cream "cloth" background so the lattice reads as fabric.
          background:
            "color-mix(in oklab, var(--color-background) 92%, var(--color-stripe) 8%)",
          display: "block",
        }}
      >
        {showLattice && <Lattice cols={cols} rows={rows} cellSize={cellSize} />}
        {cells.map((row, y) =>
          row.map((cell, x) => {
            const i = y * cols + x;
            if (i >= revealed) return null;
            if (cell.kind === "empty") return null;
            return (
              <Stitch
                key={`${x}-${y}`}
                cell={cell}
                x={x * cellSize}
                y={y * cellSize}
                size={cellSize}
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}

// the aida cloth itself — a faint grid of every cell + slightly stronger
// 10x10 division lines, exactly like a printed pattern book.
function Lattice({ cols, rows, cellSize }: { cols: number; rows: number; cellSize: number }) {
  const w = cols * cellSize;
  const h = rows * cellSize;
  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= cols; x++) {
    const isMajor = x % 10 === 0;
    lines.push(
      <line
        key={`vx${x}`}
        x1={x * cellSize}
        x2={x * cellSize}
        y1={0}
        y2={h}
        stroke="var(--color-ink)"
        strokeOpacity={isMajor ? 0.35 : 0.12}
        strokeWidth={isMajor ? 0.9 : 0.5}
      />,
    );
  }
  for (let y = 0; y <= rows; y++) {
    const isMajor = y % 10 === 0;
    lines.push(
      <line
        key={`hy${y}`}
        x1={0}
        x2={w}
        y1={y * cellSize}
        y2={y * cellSize}
        stroke="var(--color-ink)"
        strokeOpacity={isMajor ? 0.35 : 0.12}
        strokeWidth={isMajor ? 0.9 : 0.5}
      />,
    );
  }
  return <g>{lines}</g>;
}

// one textile primitive, drawn at the correct cell offset. coordinates
// are integer pixels — every stitch is reproducible by hand at the same
// intersection on real cloth.
function Stitch({ cell, x, y, size }: { cell: StitchCell; x: number; y: number; size: number }) {
  const color = COLOR_VAR[cell.color];
  const pad = size * 0.15;
  const x0 = x + pad;
  const y0 = y + pad;
  const x1 = x + size - pad;
  const y1 = y + size - pad;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const sw = Math.max(1.2, size * 0.13);

  switch (cell.kind) {
    case "full":
      return (
        <g stroke={color} strokeWidth={sw} strokeLinecap="round">
          <line x1={x0} y1={y0} x2={x1} y2={y1} />
          <line x1={x0} y1={y1} x2={x1} y2={y0} />
        </g>
      );
    case "half-fwd":
      return <line x1={x0} y1={y1} x2={x1} y2={y0} stroke={color} strokeWidth={sw} strokeLinecap="round" />;
    case "half-back":
      return <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={color} strokeWidth={sw} strokeLinecap="round" />;
    case "back-h":
      return <line x1={x} y1={cy} x2={x + size} y2={cy} stroke={color} strokeWidth={sw * 0.85} strokeLinecap="round" />;
    case "back-v":
      return <line x1={cx} y1={y} x2={cx} y2={y + size} stroke={color} strokeWidth={sw * 0.85} strokeLinecap="round" />;
    case "knot":
      return <circle cx={cx} cy={cy} r={Math.max(1.5, size * 0.18)} fill={color} />;
    default:
      return null;
  }
}
