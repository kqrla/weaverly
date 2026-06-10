// pixel ascii engine
// ---------------------------------------------------------------
// not embroidery. not textile simulation. not "pixels with letters".
// ascii art is its own language: a strict monospace grid where every
// cell is exactly one glyph and meaning emerges from density,
// hierarchy, rhythm, and the visible limitations of the medium.
//
// the engine thinks in:
//   - character density (light → heavy ramps)
//   - monospace cells (one glyph per cell, no sub-pixel anything)
//   - symbol hierarchy (intentional weight transitions)
//   - textual rhythm (repetition, motifs, scrolling pulses)
//   - structural grammars per semantic concept
//
// it never thinks in: floating type, particle drift, vector glyphs.

export type AsciiFamily =
  | "classic"        // small ramp, nostalgic bbs/text-adventure feel
  | "ansi"           // bold block art, demoscene weight
  | "pixel-glyph"    // tiny modular glyphs, pixel-art-from-type
  | "textile"        // woven sampler rhythms, embroidery cadence
  | "monogram"       // signature plates for proper names
  | "poetry";        // atmospheric, motif over representation

export type CharsetKey =
  | "minimal"
  | "standard"
  | "blocks"
  | "geometric"
  | "braille"
  | "custom";

// --- character ramps (light → heavy) -----------------------------------
// each ramp is ordered by visual weight. index 0 = empty / lightest,
// last index = heaviest. the renderer maps a normalised density value
// to a ramp index, so transitions feel deliberate, never random.
export const RAMPS: Record<CharsetKey, string[]> = {
  minimal:   [" ", ".", ":"],
  standard:  [" ", ".", ",", "'", ":", ";", "+", "=", "*", "#", "%", "@"],
  blocks:    [" ", "·", "░", "▒", "▓", "█"],
  geometric: [" ", "·", "○", "◇", "◆", "■", "▲"],
  braille:   [" ", "⠁", "⠃", "⠇", "⡇", "⣇", "⣧", "⣷", "⣿"],
  custom:    [" ", ".", "·", "o", "O", "@"], // placeholder; overridden at call time
};

// --- semantic family routing -------------------------------------------
// pick an ascii family from the semantic motifs / concept. proper names
// always become monograms; everything else routes by motif keywords.
export function routeFamily(opts: {
  kind: "proper-name" | "concept" | "ambiguous";
  motifs: string[];
  concept: string | null;
}): AsciiFamily {
  if (opts.kind === "proper-name") return "monogram";
  const m = opts.motifs.join(" ");
  if (/woven|sampler|repetition|layered|tidal|grid/.test(m)) return "textile";
  if (/branching|radial|geometric|crystal|modular|architecture/.test(m)) return "pixel-glyph";
  if (/storm|fire|chaos|dense|dramatic|electric|night/.test(m)) return "ansi";
  if (/calm|atmosphere|abstract|emotion|memory|soft|mist/.test(m)) return "poetry";
  return "classic";
}

// --- prng ---------------------------------------------------------------
function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- generation field --------------------------------------------------
// every family produces a density field in [0,1] per cell. families
// differ in *how* they shape that field; the ramp converts density →
// glyph at the end. this keeps "character hierarchy is the medium"
// honest: every family obeys the same density-to-glyph contract.

export interface AsciiOptions {
  text: string;
  family: AsciiFamily;
  charset: CharsetKey;
  customRamp?: string[];     // overrides ramp when charset === "custom"
  cols: number;
  rows: number;
  density: number;           // 0..1 global multiplier
  motifs: string[];
  concept: string | null;
}

export interface AsciiArtifact {
  family: AsciiFamily;
  charset: CharsetKey;
  cols: number;
  rows: number;
  // per-cell density (0..1) — exposed so the renderer can animate
  // *transformations* of characters rather than just reveal order
  field: number[][];
  // resolved glyph for each cell (already mapped through the ramp)
  cells: string[][];
  // reveal order — for "terminal" cascades. typically left-to-right,
  // top-to-bottom for terminals; outward from centre for monograms.
  order: { x: number; y: number }[];
  ramp: string[];
  seedWord: string;
}

function resolveRamp(opts: AsciiOptions): string[] {
  if (opts.charset === "custom" && opts.customRamp && opts.customRamp.length >= 2) {
    return [" ", ...opts.customRamp.filter((g) => g.length === 1 || g.length === 2)];
  }
  return RAMPS[opts.charset];
}

function densityToGlyph(d: number, ramp: string[]): string {
  if (d <= 0) return ramp[0];
  const idx = Math.min(ramp.length - 1, Math.max(0, Math.round(d * (ramp.length - 1))));
  return ramp[idx];
}

// --- field shapers per family ------------------------------------------

function fieldClassic(opts: AsciiOptions): number[][] {
  // soft horizon + sparse stippling, evoking early bbs landscapes.
  const seed = hash(opts.text + "classic");
  const r = rng(seed);
  const f: number[][] = [];
  const horizon = 0.55 + (r() - 0.5) * 0.1;
  for (let y = 0; y < opts.rows; y++) {
    const row: number[] = [];
    const ny = y / opts.rows;
    for (let x = 0; x < opts.cols; x++) {
      const nx = x / opts.cols;
      // ground gradient — heavier toward bottom
      const ground = ny > horizon ? (ny - horizon) / (1 - horizon) : 0;
      // sky stippling — sparse points
      const sky = ny <= horizon && rng(seed ^ (x * 73856093) ^ (y * 19349663))() > 0.92 ? 0.35 : 0;
      const v = Math.min(1, (ground * 0.85 + sky) * opts.density);
      row.push(v);
    }
    f.push(row);
  }
  return f;
}

function fieldAnsi(opts: AsciiOptions): number[][] {
  // dense block composition: bold horizontal bands + interlocking blocks,
  // demoscene-style weight contrast.
  const seed = hash(opts.text + "ansi");
  const r = rng(seed);
  const bands = 3 + Math.floor(r() * 4);
  const f: number[][] = [];
  for (let y = 0; y < opts.rows; y++) {
    const row: number[] = [];
    const band = Math.floor((y / opts.rows) * bands);
    const bandWeight = 0.4 + ((band * 37) % 7) / 10;
    for (let x = 0; x < opts.cols; x++) {
      const nx = x / opts.cols;
      const local = 0.5 + 0.5 * Math.sin(nx * Math.PI * (bands + band) + band);
      const v = Math.min(1, (bandWeight * 0.55 + local * 0.5) * opts.density);
      row.push(v);
    }
    f.push(row);
  }
  return f;
}

function fieldPixelGlyph(opts: AsciiOptions): number[][] {
  // tiny modular tiles — every 2×2 group reads as one "pixel". motif
  // gives the overall silhouette via low-resolution geometry.
  const seed = hash(opts.text + "pixel");
  const r = rng(seed);
  const cellSize = 2;
  const lowCols = Math.ceil(opts.cols / cellSize);
  const lowRows = Math.ceil(opts.rows / cellSize);
  const low: number[][] = [];
  for (let y = 0; y < lowRows; y++) {
    const row: number[] = [];
    for (let x = 0; x < lowCols; x++) {
      // diamond/circle bias based on motif; falls back to noise
      const nx = (x + 0.5) / lowCols * 2 - 1;
      const ny = (y + 0.5) / lowRows * 2 - 1;
      const radial = 1 - Math.min(1, Math.hypot(nx, ny));
      const grid = ((x + y) % 2 === 0 ? 0.9 : 0.55);
      row.push(Math.min(1, (radial * 0.7 + grid * 0.3 + (r() - 0.5) * 0.15) * opts.density));
    }
    low.push(row);
  }
  // upscale: every high-res cell reads its low-res block
  const f: number[][] = [];
  for (let y = 0; y < opts.rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < opts.cols; x++) {
      row.push(low[Math.floor(y / cellSize)][Math.floor(x / cellSize)]);
    }
    f.push(row);
  }
  return f;
}

function fieldTextile(opts: AsciiOptions): number[][] {
  // sampler rhythm: a horizontal repeat motif stacked into rows, with
  // a perimeter band — ascii's nod to embroidery without becoming it.
  const seed = hash(opts.text + "textile");
  const r = rng(seed);
  // repeat length — 4..8 cells
  const rep = 4 + Math.floor(r() * 5);
  // motif weights for one period (a tiny palindromic pattern)
  const motif: number[] = [];
  for (let i = 0; i < Math.ceil(rep / 2); i++) motif.push(0.3 + r() * 0.6);
  const fullMotif = [...motif, ...motif.slice(0, rep - motif.length).reverse()];
  const f: number[][] = [];
  for (let y = 0; y < opts.rows; y++) {
    const row: number[] = [];
    const isBorder = y < 2 || y >= opts.rows - 2;
    for (let x = 0; x < opts.cols; x++) {
      const sideBorder = x < 2 || x >= opts.cols - 2;
      let v: number;
      if (isBorder || sideBorder) {
        v = 0.85;
      } else {
        const m = fullMotif[x % rep];
        // every other row shifts by half a period for textile cadence
        const shift = y % 2 === 0 ? 0 : Math.floor(rep / 2);
        const m2 = fullMotif[(x + shift) % rep];
        v = (m + m2) / 2;
      }
      row.push(Math.min(1, v * opts.density));
    }
    f.push(row);
  }
  return f;
}

function fieldMonogram(opts: AsciiOptions): number[][] {
  // signature plate: bordered frame, mirrored initials inside, deterministic.
  const seed = hash(opts.text + "monogram");
  const letters = (opts.text || "?")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3) || "?";
  const f: number[][] = [];
  const margin = 2;
  const innerCols = opts.cols - margin * 2;
  const innerRows = opts.rows - margin * 2;
  for (let y = 0; y < opts.rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < opts.cols; x++) {
      // double frame
      const onFrame =
        x === 0 || y === 0 || x === opts.cols - 1 || y === opts.rows - 1 ||
        ((x === 2 || x === opts.cols - 3) && y >= 2 && y <= opts.rows - 3) ||
        ((y === 2 || y === opts.rows - 3) && x >= 2 && x <= opts.cols - 3);
      if (onFrame) {
        row.push(0.9);
        continue;
      }
      // mirror-x signature plate
      const cx = (opts.cols - 1) / 2;
      const cy = (opts.rows - 1) / 2;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      // letter band: faint stippling inside a central rectangle
      if (dx < innerCols / 2 - 3 && dy < innerRows / 2 - 1) {
        const letterIdx = Math.min(letters.length - 1, Math.floor((x / opts.cols) * letters.length));
        const code = letters.charCodeAt(letterIdx);
        const h = ((code * 9301 + x * 49297 + y * 233280) ^ seed) >>> 0;
        const stipple = (h % 7 === 0 ? 0.75 : (h % 13 === 0 ? 0.5 : 0));
        row.push(stipple);
      } else {
        row.push(0);
      }
    }
    f.push(row);
  }
  return f;
}

function fieldPoetry(opts: AsciiOptions): number[][] {
  // atmospheric drift: low-frequency density waves, sparse "punctuation"
  // — character rhythm taking the place of representation.
  const seed = hash(opts.text + "poetry");
  const f: number[][] = [];
  for (let y = 0; y < opts.rows; y++) {
    const row: number[] = [];
    const ny = y / opts.rows;
    for (let x = 0; x < opts.cols; x++) {
      const nx = x / opts.cols;
      const wave =
        0.5 +
        0.25 * Math.sin(nx * Math.PI * 2 + ny * 2.5) +
        0.2 * Math.cos(ny * Math.PI * 3 - nx * 1.5);
      const sparse = rng(seed ^ (x * 374761393) ^ (y * 668265263))() > 0.94 ? 0.25 : 0;
      row.push(Math.min(1, (wave * 0.6 + sparse) * opts.density));
    }
    f.push(row);
  }
  return f;
}

// --- motif overlay -----------------------------------------------------
// after the family lays down its field, motif keywords nudge density in
// structural ways: "radial" pulls weight to the centre, "branching"
// adds vertical spines, "tidal" emphasises horizontal bands. this keeps
// concepts driving structure without ever becoming literal illustration.
function applyMotifs(field: number[][], motifs: string[], seed: number): number[][] {
  if (motifs.length === 0) return field;
  const rows = field.length;
  const cols = field[0].length;
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxR = Math.hypot(cx, cy);
  const has = (k: RegExp) => motifs.some((m) => k.test(m));
  const radial = has(/radial|circular|bloom|sun|halo/);
  const branching = has(/branch|tree|vein|fork|growth|forest/);
  const tidal = has(/tidal|wave|flow|horizontal|ocean|river/);
  const clustered = has(/cluster|dense|stack|grouped|library/);
  const r = rng(seed);
  const spines: number[] = [];
  if (branching) {
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) spines.push(Math.floor(r() * cols));
  }
  const next: number[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < cols; x++) {
      let v = field[y][x];
      if (radial) {
        const d = Math.hypot(x - cx, y - cy) / maxR;
        v = Math.max(v, 0.85 * (1 - d));
      }
      if (branching) {
        for (const sx of spines) {
          const dx = Math.abs(x - sx);
          if (dx <= 1) v = Math.max(v, 0.8 - dx * 0.15);
        }
      }
      if (tidal) {
        const wave = 0.5 + 0.5 * Math.sin((y / rows) * Math.PI * 4);
        v = Math.max(v, wave * 0.55);
      }
      if (clustered) {
        const blockX = Math.floor(x / 4);
        const blockY = Math.floor(y / 3);
        const h = ((blockX * 73856093) ^ (blockY * 19349663) ^ seed) >>> 0;
        if (h % 5 < 3) v = Math.max(v, 0.7);
      }
      row.push(Math.min(1, v));
    }
    next.push(row);
  }
  return next;
}

// --- reveal order ------------------------------------------------------

function buildOrder(family: AsciiFamily, cols: number, rows: number): { x: number; y: number }[] {
  const order: { x: number; y: number }[] = [];
  if (family === "monogram") {
    // outward spiral from centre — signature plate "writes itself"
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const cells: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        cells.push({ x, y, d: Math.hypot(x - cx, y - cy) });
    cells.sort((a, b) => a.d - b.d);
    return cells.map(({ x, y }) => ({ x, y }));
  }
  // terminal cascade: top-to-bottom, left-to-right
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) order.push({ x, y });
  }
  return order;
}

// --- public api --------------------------------------------------------

export function generateAscii(opts: AsciiOptions): AsciiArtifact {
  const ramp = resolveRamp(opts);
  const seed = hash(opts.text + opts.family);

  let field: number[][];
  switch (opts.family) {
    case "ansi":        field = fieldAnsi(opts); break;
    case "pixel-glyph": field = fieldPixelGlyph(opts); break;
    case "textile":     field = fieldTextile(opts); break;
    case "monogram":    field = fieldMonogram(opts); break;
    case "poetry":      field = fieldPoetry(opts); break;
    case "classic":
    default:            field = fieldClassic(opts); break;
  }

  field = applyMotifs(field, opts.motifs, seed);

  const cells: string[][] = field.map((row) => row.map((d) => densityToGlyph(d, ramp)));
  const order = buildOrder(opts.family, opts.cols, opts.rows);

  return {
    family: opts.family,
    charset: opts.charset,
    cols: opts.cols,
    rows: opts.rows,
    field,
    cells,
    order,
    ramp,
    seedWord: opts.text,
  };
}

// flatten artifact to a plain monospace string (single space between
// glyphs would break monospace integrity; we keep one glyph per cell).
export function asciiToText(art: AsciiArtifact, revealed?: number): string {
  const limit = revealed ?? art.order.length;
  const mask: boolean[][] = Array.from({ length: art.rows }, () => Array(art.cols).fill(false));
  for (let i = 0; i < Math.min(limit, art.order.length); i++) {
    const { x, y } = art.order[i];
    mask[y][x] = true;
  }
  return art.cells
    .map((row, y) => row.map((g, x) => (mask[y][x] ? g : " ")).join(""))
    .join("\n");
}
