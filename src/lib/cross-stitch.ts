// cross-stitch engine
// ---------------------------------------------------------------
// dedicated generator for the cross-stitch / embroidery mode.
//
// philosophy:
//   the output must read as a physical textile chart, not a glyph cloud.
//   every stitch occupies one cell of a discrete aida lattice. nothing
//   is placed off-grid, nothing is "scattered". patterns are composed
//   from textile primitives: borders, repeating motif tiles, anchored
//   shapes filled with x-stitches, backstitch outlines, french knots.
//
// a viewer should believe the chart is stitchable. coordinates are
// integer cell indices. there is no subpixel placement, ever.

import { hashSeed, type StyleKey, resolveShape, SHAPES } from "./weaverly";

// each cell is a single textile primitive. these are the only things
// a stitcher can do at one intersection of the cloth.
export type StitchKind =
  | "empty"        // no thread, bare cloth
  | "full"         // x stitch (two diagonals)
  | "half-fwd"     // / half stitch
  | "half-back"    // \ half stitch
  | "back-h"       // horizontal backstitch on the cell row
  | "back-v"       // vertical backstitch on the cell column
  | "knot";        // french knot (small bead)

export type ThreadColor = "ink" | "ember" | "stripe";

export interface StitchCell {
  kind: StitchKind;
  color: ThreadColor;
}

export interface CrossStitchOptions {
  text: string;
  cols: number;
  rows: number;
  density: number;          // 0..1 — biases motif fill and knot scatter inside the shape
  symmetry: "none" | "mirror-x" | "mirror-y" | "quad";
  borderStyle?: BorderStyle;
  // optional ai-supplied silhouette mask. when present (and the word
  // doesn't already match a built-in SHAPE), this drives the central
  // motif instead of the procedural sampler. rows are square strings
  // of '0' / '1' characters — same grammar as the engine's lattice.
  bitmap?: { size: number; rows: string[] } | null;
}

export type BorderStyle = "none" | "running" | "diamond" | "wave" | "scallop";

export interface CrossStitchChart {
  cells: StitchCell[][];   // [row][col]
  cols: number;
  rows: number;
  shapeKey: string | null;
  borderStyle: BorderStyle;
  source: "shape" | "bitmap" | "procedural";
}

// --- prng (local copy so this file is self-contained) ----------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EMPTY: StitchCell = { kind: "empty", color: "ink" };

function makeGrid(cols: number, rows: number): StitchCell[][] {
  const g: StitchCell[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: StitchCell[] = [];
    for (let x = 0; x < cols; x++) row.push({ ...EMPTY });
    g.push(row);
  }
  return g;
}

// --- borders ---------------------------------------------------------
// textile borders that wrap the field. they propagate cell-by-cell, no
// freeform placement. each border is a 1-d repeating period stitched
// onto the outer perimeter rings.

function stampBorder(
  cells: StitchCell[][], style: BorderStyle, color: ThreadColor,
) {
  const rows = cells.length;
  const cols = cells[0].length;
  if (style === "none") return;

  // outer ring is always a clean backstitch frame — gives the chart a hem.
  for (let x = 0; x < cols; x++) {
    cells[0][x] = { kind: "back-h", color };
    cells[rows - 1][x] = { kind: "back-h", color };
  }
  for (let y = 0; y < rows; y++) {
    cells[y][0] = { kind: "back-v", color };
    cells[y][cols - 1] = { kind: "back-v", color };
  }

  if (rows < 7 || cols < 7) return;
  // inner motif ring, two cells in
  const period = style === "diamond" ? 4 : style === "scallop" ? 6 : style === "wave" ? 4 : 2;
  for (let x = 2; x < cols - 2; x++) {
    cells[2][x] = borderCell(style, x - 2, period, color);
    cells[rows - 3][x] = borderCell(style, x - 2, period, color);
  }
  for (let y = 2; y < rows - 2; y++) {
    cells[y][2] = borderCell(style, y - 2, period, color);
    cells[y][cols - 3] = borderCell(style, y - 2, period, color);
  }
}

function borderCell(style: BorderStyle, i: number, period: number, color: ThreadColor): StitchCell {
  const phase = i % period;
  switch (style) {
    case "running":
      return phase === 0 ? { kind: "full", color } : { kind: "empty", color };
    case "diamond":
      // ✕ at corners of period, half-stitches between → reads as small diamonds
      if (phase === 0) return { kind: "full", color };
      if (phase === 1) return { kind: "half-fwd", color };
      if (phase === 2) return { kind: "knot", color };
      return { kind: "half-back", color };
    case "wave":
      if (phase === 0 || phase === 2) return { kind: "half-fwd", color };
      return { kind: "half-back", color };
    case "scallop":
      if (phase === 0) return { kind: "full", color };
      if (phase === 3) return { kind: "knot", color };
      return { kind: "empty", color };
    default:
      return { kind: "empty", color };
  }
}

// --- motif tiling ----------------------------------------------------
// fill negative space with a small repeating motif. the motif is a tiny
// fixed bitmap stamped on a lattice — this is what gives the chart its
// woven cadence.

type Motif = { w: number; h: number; cells: StitchKind[] };

const SMALL_MOTIFS: Motif[] = [
  // tiny isolated x — sparse seed
  { w: 1, h: 1, cells: ["full"] },
  // diamond knot
  {
    w: 3, h: 3,
    cells: [
      "empty", "half-fwd", "empty",
      "half-fwd", "full", "half-back",
      "empty", "half-back", "empty",
    ],
  },
  // alternating dots
  {
    w: 2, h: 2,
    cells: ["full", "empty", "empty", "knot"],
  },
];

function stampTiledMotif(
  cells: StitchCell[][], motif: Motif, period: number, color: ThreadColor,
  inset: number,
) {
  const rows = cells.length;
  const cols = cells[0].length;
  for (let y = inset; y < rows - inset; y += period) {
    for (let x = inset; x < cols - inset; x += period) {
      for (let my = 0; my < motif.h; my++) {
        for (let mx = 0; mx < motif.w; mx++) {
          const gy = y + my;
          const gx = x + mx;
          if (gy >= rows - inset || gx >= cols - inset) continue;
          if (cells[gy][gx].kind !== "empty") continue; // never overwrite
          const k = motif.cells[my * motif.w + mx];
          if (k === "empty") continue;
          cells[gy][gx] = { kind: k, color };
        }
      }
    }
  }
}

// --- shape rasterisation --------------------------------------------
// when the seed word resolves to a SHAPE, fill it with x-stitches
// snapped to the lattice. each cell is either entirely inside the
// shape or entirely outside — no antialiasing, no subpixel sampling.

function stampShape(
  cells: StitchCell[][], shape: (x: number, y: number) => number,
  inset: number, color: ThreadColor, density: number, seed: number,
  symmetry: CrossStitchOptions["symmetry"],
) {
  const rows = cells.length;
  const cols = cells[0].length;
  const innerCols = cols - inset * 2;
  const innerRows = rows - inset * 2;
  // walk every inner cell, fold via symmetry so the chart is genuinely
  // symmetric at the lattice level (not just visually).
  const halfX = Math.ceil(innerCols / 2);
  const halfY = Math.ceil(innerRows / 2);
  for (let y = 0; y < innerRows; y++) {
    for (let x = 0; x < innerCols; x++) {
      let sx = x, sy = y;
      if ((symmetry === "mirror-x" || symmetry === "quad") && x >= halfX) sx = innerCols - 1 - x;
      if ((symmetry === "mirror-y" || symmetry === "quad") && y >= halfY) sy = innerRows - 1 - y;
      // sample at the cell centre
      const nx = (sx + 0.5) / innerCols * 2 - 1;
      const ny = (sy + 0.5) / innerRows * 2 - 1;
      if (shape(nx, ny * 0.95) <= 0) continue;
      const gx = inset + x;
      const gy = inset + y;
      if (cells[gy][gx].kind !== "empty") continue;
      // density biases interior fill — at low density we leave some cells
      // bare so the shape reads as a stitched outline+fill, not a solid block.
      const rng = mulberry32(seed ^ (sx * 73856093) ^ (sy * 19349663))();
      if (rng > 0.25 + density * 0.75) continue;
      // edge cells become french knots (anchor points), interior is full x
      const isEdge = nearShapeEdge(shape, nx, ny, innerCols, innerRows);
      cells[gy][gx] = {
        kind: isEdge && rng < 0.35 ? "knot" : "full",
        color,
      };
    }
  }
}

function nearShapeEdge(
  shape: (x: number, y: number) => number, nx: number, ny: number,
  cols: number, rows: number,
): boolean {
  const dx = 2 / cols;
  const dy = 2 / rows;
  // neighbour samples — if any is outside, this is a perimeter cell.
  const here = shape(nx, ny * 0.95) > 0;
  if (!here) return false;
  return (
    shape(nx + dx, ny * 0.95) <= 0 ||
    shape(nx - dx, ny * 0.95) <= 0 ||
    shape(nx, (ny + dy) * 0.95) <= 0 ||
    shape(nx, (ny - dy) * 0.95) <= 0
  );
}

// --- procedural fallback --------------------------------------------
// when no shape is recognised, weave a pure motif sampler. it should
// still feel like a chart someone could stitch — bands, repeats, hems.

function stampProceduralSampler(
  cells: StitchCell[][], seed: number, density: number, color: ThreadColor,
  inset: number,
) {
  const rows = cells.length;
  const cols = cells[0].length;
  const rng = mulberry32(seed);
  // horizontal bands of alternating motifs
  const bandHeight = 3 + Math.floor(rng() * 3);
  for (let y = inset; y < rows - inset; y += bandHeight) {
    const motifIndex = Math.floor(rng() * SMALL_MOTIFS.length);
    const motif = SMALL_MOTIFS[motifIndex];
    const period = Math.max(motif.w + 1, 3);
    for (let x = inset; x < cols - inset; x += period) {
      for (let my = 0; my < motif.h; my++) {
        for (let mx = 0; mx < motif.w; mx++) {
          const gy = y + my;
          const gx = x + mx;
          if (gy >= rows - inset || gx >= cols - inset) continue;
          if (cells[gy][gx].kind !== "empty") continue;
          const k = motif.cells[my * motif.w + mx];
          if (k === "empty") continue;
          // density gate — sparser at low density, denser at high
          if (mulberry32(seed ^ (gx * 374761393) ^ (gy * 668265263))() > 0.3 + density * 0.7) continue;
          cells[gy][gx] = { kind: k, color };
        }
      }
    }
  }
}

// --- public api ------------------------------------------------------

export function generateCrossStitch(opts: CrossStitchOptions): CrossStitchChart {
  const cells = makeGrid(opts.cols, opts.rows);
  const seed = hashSeed(opts.text || "weaverly");
  const shapeKey = resolveShape(opts.text);
  const borderStyle: BorderStyle = opts.borderStyle ?? pickBorderStyle(seed);

  // 1. hem — outer + inner ring borders
  stampBorder(cells, borderStyle, "ink");

  // 2. background motif sampler — thin lattice of accent stitches in
  //    the negative space, anchored to a fixed period so the rhythm
  //    is visible at a glance.
  const motif = SMALL_MOTIFS[seed % SMALL_MOTIFS.length];
  const period = 4 + (seed % 3);
  stampTiledMotif(cells, motif, period, "stripe", 4);

  // 3. central content — shape if matched, sampler bands otherwise
  if (shapeKey && SHAPES[shapeKey]) {
    stampShape(cells, SHAPES[shapeKey], 4, "ember", opts.density, seed, opts.symmetry);
  } else {
    stampProceduralSampler(cells, seed, opts.density, "ember", 4);
  }

  return {
    cells,
    cols: opts.cols,
    rows: opts.rows,
    shapeKey,
    borderStyle,
  };
}

function pickBorderStyle(seed: number): BorderStyle {
  const list: BorderStyle[] = ["running", "diamond", "wave", "scallop"];
  return list[seed % list.length];
}

// flat ordering of cells for reveal animation. row-major so the
// stitcher's hand moves left-to-right, top-to-bottom — the same way
// you'd actually stitch a chart.
export function flattenCells(chart: CrossStitchChart): { x: number; y: number; cell: StitchCell }[] {
  const out: { x: number; y: number; cell: StitchCell }[] = [];
  for (let y = 0; y < chart.rows; y++) {
    for (let x = 0; x < chart.cols; x++) {
      out.push({ x, y, cell: chart.cells[y][x] });
    }
  }
  return out;
}

// keep a re-export of StyleKey so callers don't need two imports.
export type { StyleKey };
