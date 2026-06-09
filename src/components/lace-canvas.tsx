// lace-canvas renderer
// ---------------------------------------------------------------
// renders a LaceGraph as a real network of threads and loops. every
// edge is drawn as either a straight or curved thread; every node is
// a loop / knot / petal / leaf with its own glyph. growth animation
// is driven by `revealed` — edges whose buildIndex is below the
// threshold are drawn, the rest are held back so the lace appears to
// bloom outward.

import type { LaceGraph, LaceNode } from "@/lib/lace";

interface Props {
  graph: LaceGraph;
  revealed: number;        // how many edges to draw, in build order
  size?: number;           // px, square
  showNodes?: boolean;
}

export function LaceCanvas({ graph, revealed, size = 560, showNodes = true }: Props) {
  // map normalized coords (-1..1) into the svg viewBox with a small margin.
  const margin = 30;
  const inner = size - margin * 2;
  const to = (n: LaceNode) => ({
    x: margin + ((n.x + 1) / 2) * inner,
    y: margin + ((n.y + 1) / 2) * inner,
    r: n.radius * inner,
  });

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

  const visibleEdges = graph.edges
    .slice()
    .sort((a, b) => a.buildIndex - b.buildIndex)
    .slice(0, revealed);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={`lace network · ${graph.family}`}
      style={{
        background:
          "color-mix(in oklab, var(--color-background) 90%, var(--color-stripe) 10%)",
        display: "block",
      }}
    >
      {/* threads first, so loops/knots sit on top of their connections */}
      <g
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeOpacity={0.85}
      >
        {visibleEdges.map((e, i) => {
          const a = nodesById.get(e.a);
          const c = nodesById.get(e.b);
          if (!a || !c) return null;
          const A = to(a);
          const C = to(c);
          const stroke =
            e.kind === "loop-link"
              ? { strokeOpacity: 0.7, strokeWidth: 1.3 }
              : e.kind === "branch"
                ? { strokeOpacity: 0.5, strokeWidth: 0.85 }
                : e.kind === "stem"
                  ? { strokeOpacity: 0.9, strokeWidth: 1.5 }
                  : e.kind === "arc"
                    ? { strokeOpacity: 0.75, strokeWidth: 1.0 }
                    : e.kind === "scallop"
                      ? { strokeOpacity: 0.85, strokeWidth: 1.2 }
                      : e.kind === "motif-link"
                        ? { strokeOpacity: 0.6, strokeWidth: 0.7 }
                        : { strokeOpacity: 0.8, strokeWidth: 1.0 };
          if (e.c1 && e.c2) {
            const C1 = {
              x: margin + ((e.c1.x + 1) / 2) * inner,
              y: margin + ((e.c1.y + 1) / 2) * inner,
            };
            const C2 = {
              x: margin + ((e.c2.x + 1) / 2) * inner,
              y: margin + ((e.c2.y + 1) / 2) * inner,
            };
            return (
              <path
                key={i}
                d={`M${A.x},${A.y} C${C1.x},${C1.y} ${C2.x},${C2.y} ${C.x},${C.y}`}
                {...stroke}
              />
            );
          }
          return (
            <line key={i} x1={A.x} y1={A.y} x2={C.x} y2={C.y} {...stroke} />
          );
        })}
      </g>

      {/* nodes — only draw those that have already been "reached" by a
          revealed edge, so the lace truly grows outward */}
      {showNodes && (
        <g>
          {(() => {
            const reached = new Set<number>();
            for (const e of visibleEdges) {
              reached.add(e.a);
              reached.add(e.b);
            }
            return graph.nodes
              .filter((n) => reached.has(n.id) || n.kind === "center")
              .map((n) => {
                const N = to(n);
                if (n.kind === "loop") {
                  // a crochet loop: small open ring
                  return (
                    <circle
                      key={n.id}
                      cx={N.x}
                      cy={N.y}
                      r={N.r}
                      fill="none"
                      stroke="var(--color-ink)"
                      strokeWidth={1.2}
                    />
                  );
                }
                if (n.kind === "petal") {
                  // small almond petal pointing outward from origin
                  const ang = Math.atan2(n.y, n.x);
                  const ux = Math.cos(ang);
                  const uy = Math.sin(ang);
                  const len = N.r * 2.2;
                  const wid = N.r * 0.9;
                  const tipX = N.x + ux * len;
                  const tipY = N.y + uy * len;
                  const baseX = N.x - ux * len * 0.2;
                  const baseY = N.y - uy * len * 0.2;
                  const px = -uy * wid;
                  const py = ux * wid;
                  return (
                    <path
                      key={n.id}
                      d={`M${baseX},${baseY} Q${N.x + px},${N.y + py} ${tipX},${tipY} Q${N.x - px},${N.y - py} ${baseX},${baseY} Z`}
                      fill="color-mix(in oklab, var(--color-ember) 70%, var(--color-background))"
                      stroke="var(--color-ink)"
                      strokeWidth={0.8}
                    />
                  );
                }
                if (n.kind === "leaf") {
                  return (
                    <circle
                      key={n.id}
                      cx={N.x}
                      cy={N.y}
                      r={N.r}
                      fill="color-mix(in oklab, var(--color-stripe) 60%, var(--color-background))"
                      stroke="var(--color-ink)"
                      strokeWidth={0.8}
                    />
                  );
                }
                if (n.kind === "center") {
                  return (
                    <g key={n.id}>
                      <circle
                        cx={N.x}
                        cy={N.y}
                        r={N.r}
                        fill="none"
                        stroke="var(--color-ink)"
                        strokeWidth={1.2}
                      />
                      <circle cx={N.x} cy={N.y} r={N.r * 0.4} fill="var(--color-ember)" />
                    </g>
                  );
                }
                // knot / junction — solid dot
                return (
                  <circle
                    key={n.id}
                    cx={N.x}
                    cy={N.y}
                    r={Math.max(1.2, N.r * 0.7)}
                    fill="var(--color-ink)"
                  />
                );
              });
          })()}
        </g>
      )}
    </svg>
  );
}
