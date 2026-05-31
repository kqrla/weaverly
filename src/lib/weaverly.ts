// weaverly — words become *shapes* drawn in textile glyphs.
// type "rose" and an actual rose blooms; "heart" gives a heart; etc.
// unknown words fall back to a deterministic procedural pattern seeded by the word.

export type StyleKey = "ascii" | "cross-stitch" | "woven" | "lace" | "beadwork";

export const GLYPH_SETS: Record<string, string[]> = {
  ascii: ["·", "•", "◦", "+", "*", "/", "\\", "|", "-", "=", "#", "@", "%", "&"],
  stitch: ["×", "+", "✚", "✦", "✕", "❋", "❖", "✧", "◆", "◇"],
  woven: ["▀", "▄", "█", "▌", "▐", "░", "▒", "▓", "│", "─", "┼", "╋"],
  lace: ["✻", "✼", "❀", "✿", "❁", "❃", "✺", "✱", "◌", "○"],
  bead: ["●", "○", "◐", "◑", "◒", "◓", "◔", "◕", "⬤", "◯"],
};

export const PALETTES = [
  { name: "sky & cream",    bg: "var(--background)", ink: "var(--primary)", alt: "var(--ink)" },
  { name: "ink on butter",  bg: "var(--accent)",     ink: "var(--ink)",    alt: "var(--primary)" },
  { name: "monochrome",     bg: "var(--background)", ink: "var(--ink)",    alt: "var(--muted-foreground)" },
  { name: "thread & ember", bg: "var(--background)", ink: "var(--primary)", alt: "var(--ember)" },
  { name: "reverse atelier",bg: "var(--ink)",        ink: "var(--accent)",  alt: "var(--primary)" },
];

// --- prng ---------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// --- shape library ------------------------------------------------------
// Each shape is a mask: given a normalized grid coord (nx, ny ∈ [-1, 1]),
// return a "strength" in [0, 1] (1 = solid, 0 = empty). Density biases threshold.
type ShapeFn = (nx: number, ny: number) => number;

const PI = Math.PI;

const SHAPES: Record<string, ShapeFn> = {
  heart: (x, y) => {
    // classic implicit heart: (x^2 + y^2 - 1)^3 - x^2 y^3 <= 0
    const Y = -y + 0.15; // shift down a touch
    const a = x * x + Y * Y - 1;
    return a * a * a - x * x * Y * Y * Y <= 0 ? 1 : 0;
  },
  rose: (x, y) => {
    // 5-petal rose curve r = cos(2.5θ)
    const r = Math.hypot(x, y);
    const t = Math.atan2(y, x);
    const petal = Math.abs(Math.cos(2.5 * t));
    return r <= petal * 0.95 ? 1 : 0;
  },
  flower: (x, y) => {
    const r = Math.hypot(x, y);
    const t = Math.atan2(y, x);
    const petals = 6;
    const boundary = 0.55 + 0.35 * Math.cos(petals * t);
    if (r <= boundary) return 1;
    if (r <= 0.18) return 1; // center
    return 0;
  },
  daisy: (x, y) => {
    const r = Math.hypot(x, y);
    const t = Math.atan2(y, x);
    const boundary = 0.5 + 0.4 * Math.abs(Math.cos(4 * t));
    return r <= boundary ? 1 : 0;
  },
  star: (x, y) => {
    const r = Math.hypot(x, y);
    let t = Math.atan2(y, x) - PI / 2;
    const k = 5;
    const seg = (2 * PI) / k;
    let a = ((t % seg) + seg) % seg;
    const tt = Math.abs(a - seg / 2) / (seg / 2);
    const boundary = 0.35 + 0.6 * (1 - tt);
    return r <= boundary ? 1 : 0;
  },
  sun: (x, y) => {
    const r = Math.hypot(x, y);
    const t = Math.atan2(y, x);
    if (r <= 0.45) return 1;
    // rays
    const rays = 12;
    const wedge = Math.abs(Math.cos(rays * t));
    if (r <= 0.45 + 0.5 * Math.pow(wedge, 4)) return 1;
    return 0;
  },
  moon: (x, y) => {
    // crescent: big circle minus offset circle
    const d1 = Math.hypot(x, y);
    const d2 = Math.hypot(x - 0.35, y);
    return d1 <= 0.85 && d2 > 0.75 ? 1 : 0;
  },
  circle: (x, y) => (Math.hypot(x, y) <= 0.85 ? 1 : 0),
  ring: (x, y) => {
    const r = Math.hypot(x, y);
    return r <= 0.85 && r >= 0.55 ? 1 : 0;
  },
  diamond: (x, y) => (Math.abs(x) + Math.abs(y) <= 0.85 ? 1 : 0),
  square: (x, y) => (Math.max(Math.abs(x), Math.abs(y)) <= 0.75 ? 1 : 0),
  triangle: (x, y) => {
    // upward triangle
    const ny = -y;
    if (ny < -0.7 || ny > 0.8) return 0;
    const w = (0.8 - ny) / 1.5;
    return Math.abs(x) <= w ? 1 : 0;
  },
  cross: (x, y) =>
    (Math.abs(x) <= 0.2 && Math.abs(y) <= 0.85) ||
    (Math.abs(y) <= 0.2 && Math.abs(x) <= 0.85)
      ? 1
      : 0,
  plus: (x, y) =>
    (Math.abs(x) <= 0.18 && Math.abs(y) <= 0.7) ||
    (Math.abs(y) <= 0.18 && Math.abs(x) <= 0.7)
      ? 1
      : 0,
  infinity: (x, y) => {
    // lemniscate
    const v = (x * x + y * y) ** 2 - 2 * (x * x - y * y);
    return v <= 0 ? 1 : 0;
  },
  leaf: (x, y) => {
    // teardrop / leaf
    const a = x;
    const b = y * 1.4;
    const v = (a * a + b * b) - Math.abs(b) * 0.9;
    return v <= 0.4 && Math.abs(a) <= 0.7 ? 1 : 0;
  },
  tree: (x, y) => {
    const ny = -y;
    // trunk
    if (Math.abs(x) <= 0.15 && ny >= -0.9 && ny <= -0.3) return 1;
    // canopy: stacked triangles
    const stacks = [[-0.3, 0.2, 0.6], [0.0, 0.4, 0.55], [0.3, 0.55, 0.45]];
    for (const [base, top, w] of stacks) {
      if (ny >= base && ny <= top) {
        const k = (top - ny) / (top - base);
        if (Math.abs(x) <= w * (0.3 + 0.7 * k)) return 1;
      }
    }
    return 0;
  },
  house: (x, y) => {
    const ny = -y;
    if (ny >= -0.7 && ny <= 0.1 && Math.abs(x) <= 0.6) return 1; // body
    if (ny > 0.1 && ny <= 0.7) {
      // roof
      const k = (0.7 - ny) / 0.6;
      if (Math.abs(x) <= 0.7 * k) return 1;
    }
    return 0;
  },
  cloud: (x, y) => {
    const bumps = [
      [-0.45, 0.05, 0.35],
      [-0.1, 0.2, 0.42],
      [0.3, 0.15, 0.38],
      [0.55, -0.05, 0.3],
      [0, -0.15, 0.5],
    ] as const;
    for (const [cx, cy, r] of bumps) {
      if (Math.hypot(x - cx, y - cy) <= r) return 1;
    }
    return 0;
  },
  wave: (x, y) => {
    const target = 0.35 * Math.sin(PI * 1.8 * x);
    return Math.abs(y - target) <= 0.18 ? 1 : 0;
  },
  mountain: (x, y) => {
    const ny = -y;
    const ridge = 0.4 - 0.9 * Math.abs(x - 0.05) + 0.2 * Math.cos(6 * x);
    return ny <= ridge && ny >= -0.85 ? 1 : 0;
  },
  lightning: (x, y) => {
    // zigzag bolt
    const ny = -y;
    const seg = ny + 0.7;
    const t = Math.floor(seg / 0.45);
    const within = seg - t * 0.45;
    const cx = (t % 2 === 0 ? -0.3 : 0.3) + (within - 0.225) * 1.2;
    return Math.abs(x - cx) <= 0.16 && ny >= -0.85 && ny <= 0.85 ? 1 : 0;
  },
  snowflake: (x, y) => {
    // 6-fold symmetry
    const r = Math.hypot(x, y);
    if (r > 0.95) return 0;
    let t = Math.atan2(y, x);
    const seg = PI / 3;
    let a = ((t % seg) + seg) % seg;
    if (a > seg / 2) a = seg - a;
    const arm = Math.abs(a) <= 0.22;
    if (arm && r <= 0.9) return 1;
    // branches
    for (let i = 1; i < 4; i++) {
      const br = i * 0.22;
      if (r >= br - 0.06 && r <= br + 0.06 && a <= 0.55) return 1;
    }
    return 0;
  },
  butterfly: (x, y) => {
    // simplified butterfly: two ovals + body
    if (Math.abs(x) <= 0.08 && Math.abs(y) <= 0.55) return 1;
    const left = Math.hypot((x + 0.4) * 1.3, (y - 0.1) * 1) <= 0.5;
    const right = Math.hypot((x - 0.4) * 1.3, (y - 0.1) * 1) <= 0.5;
    const leftLow = Math.hypot((x + 0.3) * 1.4, (y + 0.35) * 1.2) <= 0.35;
    const rightLow = Math.hypot((x - 0.3) * 1.4, (y + 0.35) * 1.2) <= 0.35;
    return left || right || leftLow || rightLow ? 1 : 0;
  },
  fish: (x, y) => {
    // body ellipse + tail triangle
    if ((x + 0.1) ** 2 / 0.6 + y ** 2 / 0.25 <= 1) return 1;
    const tx = x - 0.55;
    if (tx >= 0 && tx <= 0.4 && Math.abs(y) <= tx * 0.9) return 1;
    return 0;
  },
  bird: (x, y) => {
    // two arcs (seagull silhouette)
    const left = Math.abs(y - (-0.3 + 0.6 * Math.exp(-((x + 0.35) ** 2) * 8))) <= 0.12 && x <= 0;
    const right = Math.abs(y - (-0.3 + 0.6 * Math.exp(-((x - 0.35) ** 2) * 8))) <= 0.12 && x >= 0;
    return left || right ? 1 : 0;
  },
  cat: (x, y) => {
    // head circle + two ear triangles
    if (Math.hypot(x, y + 0.05) <= 0.6) return 1;
    const ny = -y;
    if (ny > 0.5 && ny <= 0.9) {
      const k = (0.9 - ny) / 0.4;
      if (Math.abs(x + 0.42) <= 0.18 * k) return 1;
      if (Math.abs(x - 0.42) <= 0.18 * k) return 1;
    }
    return 0;
  },
  eye: (x, y) => {
    const lid = Math.abs(y) <= 0.45 * Math.sqrt(Math.max(0, 1 - (x / 0.9) ** 2));
    if (!lid) return 0;
    const iris = Math.hypot(x, y) <= 0.3;
    const pupil = Math.hypot(x, y) <= 0.12;
    return pupil || (iris ? 0 : 1) ? 1 : 0;
  },
  hand: (x, y) => {
    const ny = -y;
    // palm
    if (Math.abs(x) <= 0.4 && ny >= -0.85 && ny <= 0.1) return 1;
    // fingers
    const fingers = [-0.3, -0.1, 0.1, 0.3];
    for (const fx of fingers) {
      if (Math.abs(x - fx) <= 0.07 && ny >= 0.1 && ny <= 0.7) return 1;
    }
    // thumb
    if (Math.abs(x - 0.45) <= 0.1 && ny >= -0.2 && ny <= 0.35) return 1;
    return 0;
  },
  key: (x, y) => {
    // ring + shaft + teeth
    const ring = Math.hypot(x + 0.55, y) <= 0.32 && Math.hypot(x + 0.55, y) >= 0.18;
    if (ring) return 1;
    if (Math.abs(y) <= 0.08 && x >= -0.3 && x <= 0.75) return 1; // shaft
    if (x >= 0.45 && x <= 0.6 && y >= 0.08 && y <= 0.3) return 1; // tooth
    if (x >= 0.65 && x <= 0.78 && y >= 0.08 && y <= 0.25) return 1;
    return 0;
  },
  crown: (x, y) => {
    const ny = -y;
    if (ny >= -0.4 && ny <= 0.1 && Math.abs(x) <= 0.7) return 1; // band
    if (ny > 0.1 && ny <= 0.6) {
      const peaks = [-0.5, 0, 0.5];
      for (const px of peaks) {
        const k = (0.6 - ny) / 0.5;
        if (Math.abs(x - px) <= 0.15 * k) return 1;
      }
    }
    return 0;
  },
  anchor: (x, y) => {
    // top ring + vertical bar + horizontal crossbar + bottom arc
    if (Math.hypot(x, y - 0.65) <= 0.15 && Math.hypot(x, y - 0.65) >= 0.08) return 1;
    if (Math.abs(x) <= 0.08 && y >= -0.6 && y <= 0.55) return 1;
    if (Math.abs(y - 0.4) <= 0.06 && Math.abs(x) <= 0.4) return 1;
    const ny = -y;
    if (ny >= 0.5 && Math.abs(Math.hypot(x, ny - 0.4) - 0.45) <= 0.08 && ny <= 0.95) return 1;
    return 0;
  },
  spiral: (x, y) => {
    const r = Math.hypot(x, y);
    if (r > 0.95) return 0;
    const t = Math.atan2(y, x);
    const v = (r - (t / (PI * 2)) * 0.5 - 0.1) % 0.18;
    return Math.abs(v) <= 0.06 ? 1 : 0;
  },
  arrow: (x, y) => {
    if (Math.abs(y) <= 0.12 && x >= -0.7 && x <= 0.3) return 1;
    if (x >= 0.1 && x <= 0.7 && Math.abs(y) <= 0.7 - x) return 1;
    return 0;
  },
};

// synonyms / aliases → canonical shape key
const ALIASES: Record<string, string> = {
  // flowers
  rose: "rose", roses: "rose", bloom: "rose", peony: "rose",
  flower: "flower", flowers: "flower", tulip: "flower", lily: "flower", iris: "flower",
  daisy: "daisy", sunflower: "daisy", chrysanthemum: "daisy",
  // hearts / love
  heart: "heart", love: "heart", lover: "heart", beloved: "heart", amor: "heart",
  valentine: "heart", crush: "heart", hearts: "heart",
  // celestial
  star: "star", stars: "star", sparkle: "star", twinkle: "star", shine: "star",
  sun: "sun", sunshine: "sun", solar: "sun", helios: "sun",
  moon: "moon", luna: "moon", crescent: "moon", lunar: "moon",
  snowflake: "snowflake", snow: "snowflake", frost: "snowflake", winter: "snowflake",
  lightning: "lightning", bolt: "lightning", thunder: "lightning", storm: "lightning",
  cloud: "cloud", clouds: "cloud", sky: "cloud", mist: "cloud",
  // shapes
  circle: "circle", dot: "circle", orb: "circle",
  ring: "ring", halo: "ring", loop: "ring",
  diamond: "diamond", rhombus: "diamond", gem: "diamond",
  square: "square", block: "square",
  triangle: "triangle",
  cross: "cross", plus: "plus", add: "plus",
  infinity: "infinity", forever: "infinity", always: "infinity",
  spiral: "spiral", vortex: "spiral",
  arrow: "arrow", point: "arrow",
  // nature
  leaf: "leaf", leaves: "leaf", fern: "leaf",
  tree: "tree", forest: "tree", pine: "tree", oak: "tree",
  mountain: "mountain", mountains: "mountain", peak: "mountain", alps: "mountain",
  wave: "wave", waves: "wave", ocean: "wave", sea: "wave", tide: "wave",
  // creatures
  butterfly: "butterfly", moth: "butterfly",
  fish: "fish", koi: "fish", trout: "fish",
  bird: "bird", birds: "bird", swallow: "bird", sparrow: "bird", dove: "bird", gull: "bird",
  cat: "cat", kitten: "cat", kitty: "cat", feline: "cat",
  // objects
  house: "house", home: "house", cottage: "house",
  eye: "eye", iris2: "eye", seer: "eye",
  hand: "hand", palm: "hand",
  key: "key", keys: "key",
  crown: "crown", queen: "crown", king: "crown", royal: "crown",
  anchor: "anchor", ship: "anchor", harbor: "anchor",
};

export function resolveShape(text: string): string | null {
  const t = (text || "").trim().toLowerCase();
  if (!t) return null;
  if (ALIASES[t]) return ALIASES[t];
  // try first token
  const tokens = t.split(/[^a-z]+/).filter(Boolean);
  for (const tok of tokens) if (ALIASES[tok]) return ALIASES[tok];
  return null;
}

export const SUPPORTED_WORDS = Array.from(new Set(Object.keys(ALIASES))).sort();

// --- generation ---------------------------------------------------------
export interface GenOptions {
  text: string;
  style: StyleKey;
  density: number;
  symmetry: "none" | "mirror-x" | "mirror-y" | "quad";
  cols: number;
  rows: number;
  paletteIndex: number;
}

export interface GenResult {
  grid: string[][];
  shapeKey: string | null; // null = procedural fallback
}

function glyphsFor(style: StyleKey): string[] {
  return style === "ascii" ? GLYPH_SETS.ascii
    : style === "cross-stitch" ? GLYPH_SETS.stitch
    : style === "woven" ? GLYPH_SETS.woven
    : style === "lace" ? GLYPH_SETS.lace
    : GLYPH_SETS.bead;
}

function applySymmetry(
  x: number, y: number, cols: number, rows: number,
  sym: GenOptions["symmetry"],
): [number, number] {
  const halfX = Math.ceil(cols / 2);
  const halfY = Math.ceil(rows / 2);
  let sx = x, sy = y;
  if (sym === "mirror-x" && x >= halfX) sx = cols - 1 - x;
  if (sym === "mirror-y" && y >= halfY) sy = rows - 1 - y;
  if (sym === "quad") {
    if (x >= halfX) sx = cols - 1 - x;
    if (y >= halfY) sy = rows - 1 - y;
  }
  return [sx, sy];
}

export function generateGrid(opts: GenOptions): string[][] {
  return generate(opts).grid;
}

export function generate(opts: GenOptions): GenResult {
  const shapeKey = resolveShape(opts.text);
  const glyphs = glyphsFor(opts.style);
  const seed = hashSeed(opts.text || "weaverly");
  const grid: string[][] = [];

  if (shapeKey) {
    const shape = SHAPES[shapeKey];
    // density bias: at low density, scatter dots inside the shape;
    // at high density (>= ~0.7) the shape is solid.
    const solid = opts.density >= 0.7;
    const fillProb = opts.density < 0.7 ? 0.25 + opts.density : 1;
    for (let y = 0; y < opts.rows; y++) {
      const row: string[] = [];
      for (let x = 0; x < opts.cols; x++) {
        // sample with sub-pixel jitter for smoother edges; symmetry is implicit
        // for symmetric shapes, but mirror toggles still snap coords.
        const [sx, sy] = applySymmetry(x, y, opts.cols, opts.rows, opts.symmetry);
        const nx = (sx + 0.5) / opts.cols * 2 - 1;
        const ny = (sy + 0.5) / opts.rows * 2 - 1;
        // squeeze to roughly equal aspect on the visual grid (chars are taller-spaced)
        const inside = shape(nx, ny * 0.95) > 0;
        if (!inside) { row.push(" "); continue; }
        if (!solid) {
          const cellSeed = seed ^ (sx * 73856093) ^ (sy * 19349663);
          if (mulberry32(cellSeed)() > fillProb) { row.push(" "); continue; }
        }
        const cellSeed = seed ^ (sx * 374761393) ^ (sy * 668265263);
        const g = glyphs[Math.floor(mulberry32(cellSeed + 7)() * glyphs.length)];
        row.push(g);
      }
      grid.push(row);
    }
    return { grid, shapeKey };
  }

  // procedural fallback (original behaviour)
  for (let y = 0; y < opts.rows; y++) {
    const row: string[] = [];
    for (let x = 0; x < opts.cols; x++) {
      const [sx, sy] = applySymmetry(x, y, opts.cols, opts.rows, opts.symmetry);
      const cellSeed = seed ^ (sx * 73856093) ^ (sy * 19349663);
      const r = mulberry32(cellSeed)();
      if (r < opts.density) {
        const g = glyphs[Math.floor(mulberry32(cellSeed + 1)() * glyphs.length)];
        row.push(g);
      } else {
        row.push(" ");
      }
    }
    grid.push(row);
  }
  return { grid, shapeKey: null };
}

export function gridToString(grid: string[][]): string {
  return grid.map((r) => r.join(" ")).join("\n");
}
