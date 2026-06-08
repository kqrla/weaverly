// bead-canvas renderer
// ---------------------------------------------------------------
// renders a BeadworkArtifact as physical beads strung on cords.
// the cord is drawn first (the strand path), then beads are placed
// in assembly order. animation reveals one bead at a time — the
// way a beader actually threads a piece.

import type { BeadworkArtifact, Bead, BeadShape } from "@/lib/beadwork";

interface Props {
  artifact: BeadworkArtifact;
  revealed: number;    // how many beads (in assembly order) to draw
  size?: number;       // px square viewport for the renderer
  showCords?: boolean;
}

export function BeadCanvas({ artifact, revealed, size = 720, showCords = true }: Props) {
  const { width, height, beads, strands } = artifact;
  // we always render into a square-ish viewbox sized to the artifact's
  // intrinsic canvas so the export is byte-equivalent to the preview.
  const w = width;
  const h = height;
  const aspect = h / w;

  // assemble a per-strand "revealed up to" cap so the cord between
  // beads grows as those beads thread on, rather than appearing all
  // at once.
  const lastIndexPerStrand = new Map<number, number>();
  const visibleBeads: Bead[] = [];
  for (let i = 0; i < Math.min(revealed, beads.length); i++) {
    const b = beads[i];
    visibleBeads.push(b);
    lastIndexPerStrand.set(b.strand, b.orderOnStrand);
  }

  return (
    <div className="relative inline-block" style={{ width: size, height: size * aspect }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={size}
        height={size * aspect}
        role="img"
        aria-label={`beadwork · ${artifact.family}`}
        style={{
          background:
            "color-mix(in oklab, var(--color-background) 90%, var(--color-stripe) 10%)",
          display: "block",
        }}
      >
        {/* cords first, so beads always sit on top of the thread */}
        {showCords && strands.map((s) => {
          const cap = lastIndexPerStrand.get(s.id);
          if (cap === undefined && s.path.length > 1 && s.kind !== "mesh") return null;
          // mesh strands are simple two-point edges — render only when
          // both endpoints have been threaded.
          if (s.kind === "mesh") {
            // mesh strand only shows when both endpoints exist; we
            // approximate by checking if any visible bead matches its
            // endpoint coords. cheap and fine for this density.
            const [a, b] = s.path;
            const aSeen = visibleBeads.some((v) => Math.abs(v.x - a.x) < 0.5 && Math.abs(v.y - a.y) < 0.5);
            const bSeen = visibleBeads.some((v) => Math.abs(v.x - b.x) < 0.5 && Math.abs(v.y - b.y) < 0.5);
            if (!aSeen || !bSeen) return null;
            return (
              <line
                key={`cord-${s.id}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="var(--color-ink)"
                strokeOpacity={0.25}
                strokeWidth={0.8}
              />
            );
          }
          // linear / ring / branch / fringe cords: draw up to the
          // path index corresponding to the last revealed bead on
          // this strand.
          const upto = (cap ?? -1) + 2; // +1 for inclusive, +1 because path may include an anchor at index 0
          const points = s.path.slice(0, Math.max(2, Math.min(s.path.length, upto)));
          const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
          return (
            <path
              key={`cord-${s.id}`}
              d={d + (s.closed && points.length === s.path.length ? " Z" : "")}
              fill="none"
              stroke="var(--color-ink)"
              strokeOpacity={s.kind === "fringe" ? 0.4 : 0.5}
              strokeWidth={0.9}
              strokeLinecap="round"
            />
          );
        })}

        {/* beads on top */}
        {visibleBeads.map((b) => (
          <BeadShape3D key={b.id} bead={b} />
        ))}
      </svg>
    </div>
  );
}

// each bead is drawn as a subtle gradient sphere/drop/bugle. we keep
// the geometry simple so a 500-bead artifact stays cheap to render,
// but always with a highlight + shadow so the bead reads as a
// physical object instead of a flat dot.
function BeadShape3D({ bead }: { bead: Bead }) {
  const { x, y, size, color, shape, finish, opacity } = bead;
  const gradId = `g-${bead.id}`;
  const hl = finish === "matte" ? 0.15 : finish === "iridescent" ? 0.7 : 0.45;

  const gradient = (
    <defs>
      <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={hl} />
        <stop offset="40%" stopColor={color} stopOpacity={1} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.25} />
      </radialGradient>
    </defs>
  );

  switch (shape as BeadShape) {
    case "drop":
      // teardrop: wide at top, narrows to a point at bottom
      return (
        <g opacity={opacity}>
          {gradient}
          <path
            d={`M${x},${y - size * 1.4} C${x + size},${y - size * 0.6} ${x + size},${y + size * 0.4} ${x},${y + size * 1.1} C${x - size},${y + size * 0.4} ${x - size},${y - size * 0.6} ${x},${y - size * 1.4} Z`}
            fill={`url(#${gradId})`}
            stroke={color}
            strokeOpacity={0.4}
            strokeWidth={0.5}
          />
        </g>
      );
    case "bugle":
      return (
        <g opacity={opacity}>
          {gradient}
          <rect
            x={x - size * 1.6}
            y={y - size * 0.55}
            width={size * 3.2}
            height={size * 1.1}
            rx={size * 0.4}
            fill={`url(#${gradId})`}
            stroke={color}
            strokeOpacity={0.4}
            strokeWidth={0.5}
          />
        </g>
      );
    case "faceted": {
      // hexagonal facet silhouette
      const r = size;
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        pts.push(`${(x + Math.cos(a) * r).toFixed(2)},${(y + Math.sin(a) * r).toFixed(2)}`);
      }
      return (
        <g opacity={opacity}>
          {gradient}
          <polygon points={pts.join(" ")} fill={`url(#${gradId})`} stroke={color} strokeOpacity={0.5} strokeWidth={0.5} />
        </g>
      );
    }
    case "seed":
    case "round":
    case "pearl":
    default:
      return (
        <g opacity={opacity}>
          {gradient}
          <circle
            cx={x}
            cy={y}
            r={size}
            fill={`url(#${gradId})`}
            stroke={color}
            strokeOpacity={0.35}
            strokeWidth={0.4}
          />
        </g>
      );
  }
}
