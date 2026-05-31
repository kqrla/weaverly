// weaving engine
// ---------------------------------------------------------------
// dedicated generator for the woven mode.
//
// philosophy:
//   the cloth must emerge from the simulation of an actual loom, not
//   from "placing symbols on a grid". we model two thread systems —
//   warp (vertical) and weft (horizontal) — and a loom draft that
//   decides, at every intersection, which thread is on top. that
//   over/under decision is the entire visible pattern.
//
// the pipeline is strictly:
//
//   seed word
//     -> deterministic prng + structural parameters
//     -> threading (which shaft each warp end is tied to)
//     -> tie-up (which shafts each treadle raises)
//     -> treadling (which treadle is used on each weft pick)
//     -> resolved cloth matrix [row][col] = "warp" | "weft"
//     -> thread colors & weights derived from the same seed
//
// the renderer (weave-grid.tsx) then draws thread segments, not glyphs.
// nothing here scatters, jitters, or floats — every visible mark is
// either a warp end or a weft pick at an integer cell on the cloth.

import { hashSeed } from "./weaverly";

export type WeaveType =
  | "plain"        // 1/1 over-under, the balanced base cloth
  | "twill"        // 2/2 diagonal float
  | "basket"       // 2/2 grouped plain weave
  | "satin"        // 5-end satin, long warp floats, smooth face
  | "herringbone"  // mirrored twill — reversing diagonals
  | "diamond"      // mirrored threading + treadling, ornamental
  | "jacquard";    // free per-cell control, seeded image-like cloth

export type ThreadRole = "warp" | "weft";

export interface ThreadColor {
  // semantic name maps to a css token in the renderer. we keep the
  // palette small and textile-y on purpose.
  token: "ink" | "ember" | "stripe" | "background" | "accent";
  // visual thickness in 0..1 of one cell. real yarn isn't uniform;
  // a slight per-thread variation reads as fiber, not pixels.
  weight: number;
}

export interface WeaveDraft {
  cols: number;            // number of warp ends
  rows: number;            // number of weft picks
  weave: WeaveType;
  shafts: number;
  treadles: number;

  // per-warp-end: which shaft this end is threaded through (0..shafts-1)
  threading: number[];
  // per-weft-pick: which treadle is pressed (0..treadles-1)
  treadling: number[];
  // tieup[treadle][shaft] = 1 means pressing that treadle lifts that shaft
  tieup: number[][];

  warpColors: ThreadColor[];
  weftColors: ThreadColor[];

  // cell[y][x] = which thread is visible at this intersection.
  // "warp" means the warp end is lifted over the weft (warp on top).
  // "weft" means the warp is down, weft on top.
  cell: ThreadRole[][];

  // diagnostics — surfaced in the ui so the seed feels legible.
  seedWord: string;
  warpSett: number;        // ends per "inch" — affects renderer cell aspect
  weftSett: number;        // picks per "inch"
}

// --- prng (local) -----------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- seed -> structural parameters -----------------------------------
// the same word always produces the same textile family. small spelling
// changes shift the seed and therefore the weave family + density.
export interface WeaveOptions {
  text: string;
  cols: number;
  rows: number;
  density: number;         // 0..1 — biases thread weight + sett
  weave?: WeaveType;       // optional override; "auto" if omitted
  symmetry: "none" | "mirror-x" | "mirror-y" | "quad";
}

const AUTO_WEAVES: WeaveType[] = [
  "plain", "twill", "basket", "satin", "herringbone", "diamond", "jacquard",
];

// hand-curated thread palettes. each entry is a tiny weft/warp story:
// what colour the cloth's framework is vs. what colour travels through it.
const PALETTES: { warp: ThreadColor["token"][]; weft: ThreadColor["token"][] }[] = [
  { warp: ["ink"], weft: ["ember", "stripe"] },
  { warp: ["ember", "ink"], weft: ["background", "accent"] },
  { warp: ["stripe", "ink"], weft: ["ember"] },
  { warp: ["ink", "ink", "ember"], weft: ["accent", "background"] },
  { warp: ["ember"], weft: ["ink", "stripe"] },
];

function pickWeave(rand: () => number, opts: WeaveOptions): WeaveType {
  if (opts.weave) return opts.weave;
  return AUTO_WEAVES[Math.floor(rand() * AUTO_WEAVES.length)];
}

// build the threading sequence for a given weave family. this is the
// punch-card equivalent: which heddle each warp end lives on.
function buildThreading(weave: WeaveType, cols: number, shafts: number, rand: () => number): number[] {
  const out: number[] = [];
  switch (weave) {
    case "plain": {
      for (let i = 0; i < cols; i++) out.push(i % 2);
      return out;
    }
    case "twill": {
      // straight draw 1,2,3,4,1,2,3,4...
      for (let i = 0; i < cols; i++) out.push(i % shafts);
      return out;
    }
    case "basket": {
      // pairs: 1,1,2,2,1,1,2,2...
      for (let i = 0; i < cols; i++) out.push(Math.floor(i / 2) % 2);
      return out;
    }
    case "satin": {
      // straight draw on 5 shafts
      for (let i = 0; i < cols; i++) out.push(i % shafts);
      return out;
    }
    case "herringbone": {
      // run up, run down — reversal length seeded so different words
      // produce visibly different chevron widths.
      const run = 4 + Math.floor(rand() * 5);
      let dir = 1;
      let v = 0;
      for (let i = 0; i < cols; i++) {
        out.push(v);
        v += dir;
        if (v >= shafts - 1) { v = shafts - 1; dir = -1; }
        else if (v <= 0 && i > 0) { v = 0; dir = 1; }
        // segment breakpoint to keep chevrons crisp
        if ((i + 1) % run === 0) dir = -dir;
      }
      return out;
    }
    case "diamond": {
      // straight up to mid, mirror back down — classic diamond draft
      const half = Math.ceil(shafts / 2);
      for (let i = 0; i < cols; i++) {
        const p = i % (2 * half - 2);
        out.push(p < half ? p : 2 * half - 2 - p);
      }
      return out;
    }
    case "jacquard": {
      // free per-end shaft assignment, but biased to clumps so we get
      // pattern blocks rather than noise.
      let cur = Math.floor(rand() * shafts);
      let runLeft = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < cols; i++) {
        if (runLeft <= 0) {
          cur = Math.floor(rand() * shafts);
          runLeft = 1 + Math.floor(rand() * 4);
        }
        out.push(cur);
        runLeft--;
      }
      return out;
    }
  }
}

// build a tie-up matrix for the weave family. real weavers describe a
// tie-up as a small square of dots; we encode it the same way.
function buildTieup(weave: WeaveType, shafts: number, treadles: number, rand: () => number): number[][] {
  const tieup: number[][] = Array.from({ length: treadles }, () => Array(shafts).fill(0));
  switch (weave) {
    case "plain": {
      tieup[0][0] = 1;
      tieup[1][1] = 1;
      return tieup;
    }
    case "twill":
    case "herringbone": {
      // 2/2 twill — each treadle lifts two adjacent shafts, stepped by 1.
      for (let t = 0; t < treadles; t++) {
        tieup[t][t % shafts] = 1;
        tieup[t][(t + 1) % shafts] = 1;
      }
      return tieup;
    }
    case "basket": {
      // groups of two shafts lifted together
      tieup[0][0] = 1; tieup[0][1] = 1;
      tieup[1][2 % shafts] = 1; tieup[1][3 % shafts] = 1;
      return tieup;
    }
    case "satin": {
      // 5-end satin: shaft offset of 2 each pick — characteristic scatter
      for (let t = 0; t < treadles; t++) tieup[t][(t * 2) % shafts] = 1;
      return tieup;
    }
    case "diamond": {
      // point twill tie-up
      for (let t = 0; t < treadles; t++) {
        tieup[t][t % shafts] = 1;
        tieup[t][(t + 1) % shafts] = 1;
      }
      return tieup;
    }
    case "jacquard": {
      // each "treadle" is just a random shaft mask — but at least one bit
      // set so the pick actually weaves.
      for (let t = 0; t < treadles; t++) {
        let any = false;
        for (let s = 0; s < shafts; s++) {
          if (rand() > 0.55) { tieup[t][s] = 1; any = true; }
        }
        if (!any) tieup[t][Math.floor(rand() * shafts)] = 1;
      }
      return tieup;
    }
  }
}

function buildTreadling(weave: WeaveType, rows: number, treadles: number, rand: () => number): number[] {
  const out: number[] = [];
  switch (weave) {
    case "plain": {
      for (let i = 0; i < rows; i++) out.push(i % 2);
      return out;
    }
    case "twill":
    case "satin": {
      for (let i = 0; i < rows; i++) out.push(i % treadles);
      return out;
    }
    case "basket": {
      for (let i = 0; i < rows; i++) out.push(Math.floor(i / 2) % 2);
      return out;
    }
    case "herringbone": {
      const run = 4 + Math.floor(rand() * 5);
      let dir = 1, v = 0;
      for (let i = 0; i < rows; i++) {
        out.push(v);
        v += dir;
        if (v >= treadles - 1) { v = treadles - 1; dir = -1; }
        else if (v <= 0 && i > 0) { v = 0; dir = 1; }
        if ((i + 1) % run === 0) dir = -dir;
      }
      return out;
    }
    case "diamond": {
      const half = Math.ceil(treadles / 2);
      for (let i = 0; i < rows; i++) {
        const p = i % (2 * half - 2);
        out.push(p < half ? p : 2 * half - 2 - p);
      }
      return out;
    }
    case "jacquard": {
      let cur = Math.floor(rand() * treadles);
      let runLeft = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < rows; i++) {
        if (runLeft <= 0) {
          cur = Math.floor(rand() * treadles);
          runLeft = 1 + Math.floor(rand() * 4);
        }
        out.push(cur);
        runLeft--;
      }
      return out;
    }
  }
}

// derive the visible cloth from threading + treadling + tieup. this is
// the actual loom calculation: at every intersection (warp end x weft
// pick), we look up which shafts are raised. if the warp's shaft is
// raised, warp passes over the weft, otherwise the weft passes over.
function resolveCloth(draft: Omit<WeaveDraft, "cell" | "warpSett" | "weftSett" | "seedWord">): ThreadRole[][] {
  const cell: ThreadRole[][] = [];
  for (let y = 0; y < draft.rows; y++) {
    const treadle = draft.treadling[y];
    const lifted = draft.tieup[treadle];
    const row: ThreadRole[] = [];
    for (let x = 0; x < draft.cols; x++) {
      const shaft = draft.threading[x];
      row.push(lifted[shaft] ? "warp" : "weft");
    }
    cell.push(row);
  }
  return cell;
}

function applySymmetry(cell: ThreadRole[][], sym: WeaveOptions["symmetry"]): ThreadRole[][] {
  if (sym === "none") return cell;
  const rows = cell.length;
  const cols = cell[0].length;
  const out: ThreadRole[][] = cell.map((r) => r.slice());
  const halfX = Math.floor(cols / 2);
  const halfY = Math.floor(rows / 2);
  if (sym === "mirror-x" || sym === "quad") {
    for (let y = 0; y < rows; y++) {
      for (let x = halfX; x < cols; x++) out[y][x] = out[y][cols - 1 - x];
    }
  }
  if (sym === "mirror-y" || sym === "quad") {
    for (let y = halfY; y < rows; y++) {
      for (let x = 0; x < cols; x++) out[y][x] = out[rows - 1 - y][x];
    }
  }
  return out;
}

// build a small per-thread colour sequence from a palette token list.
// we add a gentle weight wobble so the rendered cloth reads as yarn
// rather than printed pixels.
function buildThreads(tokens: ThreadColor["token"][], count: number, rand: () => number): ThreadColor[] {
  const out: ThreadColor[] = [];
  // pick a repeat width seeded by the prng so different words get
  // different "warp stripes".
  const repeat = 1 + Math.floor(rand() * 6);
  for (let i = 0; i < count; i++) {
    const token = tokens[Math.floor(i / repeat) % tokens.length];
    const weight = 0.62 + rand() * 0.28;
    out.push({ token, weight });
  }
  return out;
}

export function generateWeave(opts: WeaveOptions): WeaveDraft {
  const seed = hashSeed(opts.text || "weaverly");
  const rand = mulberry32(seed);

  const weave = pickWeave(rand, opts);
  const shafts = weave === "satin" ? 5 : weave === "jacquard" ? 8 : 4;
  const treadles = shafts;

  const threading = buildThreading(weave, opts.cols, shafts, rand);
  const tieup = buildTieup(weave, shafts, treadles, rand);
  const treadling = buildTreadling(weave, opts.rows, treadles, rand);

  // pick a palette seeded by the word so "rose" and "violet" pull
  // visually different yarn from the basket.
  const palette = PALETTES[seed % PALETTES.length];
  const warpColors = buildThreads(palette.warp, opts.cols, rand);
  const weftColors = buildThreads(palette.weft, opts.rows, rand);

  // sett (threads per unit) is biased by density. higher density =
  // tighter cloth, slightly thicker threads.
  const sett = 0.85 + opts.density * 0.4;

  const partial = {
    cols: opts.cols,
    rows: opts.rows,
    weave,
    shafts,
    treadles,
    threading,
    treadling,
    tieup,
    warpColors,
    weftColors,
  };

  let cell = resolveCloth(partial);
  cell = applySymmetry(cell, opts.symmetry);

  return {
    ...partial,
    cell,
    warpSett: sett,
    weftSett: sett,
    seedWord: opts.text,
  };
}

// emit a weaver's draft as a plain-text grid — the universal exchange
// format for hand-loom patterns. blocks for tieup, threading and
// treadling are laid out in their conventional positions.
export function draftToAscii(d: WeaveDraft): string {
  const sym = (v: number) => (v ? "X" : ".");
  const lines: string[] = [];
  lines.push(`# weaving draft — ${d.weave} · seed "${d.seedWord}"`);
  lines.push(`# ${d.cols} warp ends × ${d.rows} weft picks · ${d.shafts} shafts`);
  lines.push("");
  lines.push("threading (warp ends, top of draft):");
  lines.push(d.threading.map((s) => (s + 1).toString(36)).join(""));
  lines.push("");
  lines.push("tieup (treadles × shafts):");
  for (const row of d.tieup) lines.push(row.map(sym).join(""));
  lines.push("");
  lines.push("treadling (weft picks, right of draft):");
  for (const t of d.treadling) lines.push((t + 1).toString(36));
  lines.push("");
  lines.push("cloth (warp = X on top, . = weft on top):");
  for (const row of d.cell) lines.push(row.map((c) => (c === "warp" ? "X" : ".")).join(""));
  return lines.join("\n");
}
