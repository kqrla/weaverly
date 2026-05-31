// weave-grid renderer
// ---------------------------------------------------------------
// renders a WeaveDraft as actual thread segments. for every cell we
// know whether the warp or the weft is on top — we draw a thread
// stub of that role at that intersection. the under-thread is drawn
// faintly so the cloth keeps its woven cross-grain visibly present,
// the way real fabric does.

import type { WeaveDraft, ThreadColor } from "@/lib/weaving";

interface Props {
  draft: WeaveDraft;
  revealed: number;           // cells revealed so far (row-major), drives the loom animation
  cellSize?: number;
  showLoomGrid?: boolean;
}

const COLOR_VAR: Record<ThreadColor["token"], string> = {
  ink: "var(--color-ink)",
  ember: "var(--color-ember)",
  stripe: "color-mix(in oklab, var(--color-stripe) 70%, var(--color-ink) 30%)",
  background: "var(--color-background)",
  accent: "color-mix(in oklab, var(--color-accent) 80%, var(--color-ink) 20%)",
};

export function WeaveGrid({ draft, revealed, cellSize = 16, showLoomGrid = false }: Props) {
  const { cols, rows, cell, warpColors, weftColors } = draft;
  const w = cols * cellSize;
  const h = rows * cellSize;

  // tiny inset so adjacent same-role cells visibly butt against each
  // other as a single float (which is what makes twills and satins
  // look like twills and satins).
  const inset = Math.max(0.5, cellSize * 0.04);

  return (
    <div className="relative inline-block">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        role="img"
        aria-label={`woven cloth · ${draft.weave}`}
        style={{
          background:
            "color-mix(in oklab, var(--color-background) 88%, var(--color-stripe) 12%)",
          display: "block",
        }}
      >
        {/* faint under-cloth — every warp end as a thin vertical line, so
            the cloth feels strung on a loom even where weft sits on top. */}
        {warpColors.map((c, x) => (
          <line
            key={`warp-bg-${x}`}
            x1={x * cellSize + cellSize / 2}
            x2={x * cellSize + cellSize / 2}
            y1={0}
            y2={h}
            stroke={COLOR_VAR[c.token]}
            strokeOpacity={0.18}
            strokeWidth={Math.max(0.6, cellSize * 0.08)}
          />
        ))}

        {/* the visible cloth — at each intersection, draw the thread on top
            as a fat stub the size of one cell. consecutive same-role cells
            form thread "floats" naturally. */}
        {cell.map((row, y) => {
          if (y * cols >= revealed) return null;
          return row.map((role, x) => {
            const i = y * cols + x;
            if (i >= revealed) return null;
            const cx = x * cellSize;
            const cy = y * cellSize;
            if (role === "warp") {
              const c = warpColors[x];
              const tw = cellSize * (0.55 + c.weight * 0.35);
              return (
                <rect
                  key={`c-${x}-${y}`}
                  x={cx + (cellSize - tw) / 2}
                  y={cy - inset}
                  width={tw}
                  height={cellSize + inset * 2}
                  fill={COLOR_VAR[c.token]}
                  rx={tw * 0.25}
                />
              );
            }
            const c = weftColors[y];
            const tw = cellSize * (0.55 + c.weight * 0.35);
            return (
              <rect
                key={`c-${x}-${y}`}
                x={cx - inset}
                y={cy + (cellSize - tw) / 2}
                width={cellSize + inset * 2}
                height={tw}
                fill={COLOR_VAR[c.token]}
                rx={tw * 0.25}
              />
            );
          });
        })}

        {/* optional loom-draft overlay — the grid of warp ends × weft picks.
            useful when previewing the draft as a punched card. */}
        {showLoomGrid && (
          <g>
            {Array.from({ length: cols + 1 }, (_, x) => (
              <line
                key={`gx${x}`}
                x1={x * cellSize}
                x2={x * cellSize}
                y1={0}
                y2={h}
                stroke="var(--color-ink)"
                strokeOpacity={0.08}
                strokeWidth={0.5}
              />
            ))}
            {Array.from({ length: rows + 1 }, (_, y) => (
              <line
                key={`gy${y}`}
                x1={0}
                x2={w}
                y1={y * cellSize}
                y2={y * cellSize}
                stroke="var(--color-ink)"
                strokeOpacity={0.08}
                strokeWidth={0.5}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
