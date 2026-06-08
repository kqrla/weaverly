// beadwork engine
// ---------------------------------------------------------------
// beadwork is not pixel art with circles. it is a physical
// assembly of individual beads onto strands. every artifact this
// engine produces could, in principle, be strung by hand.
//
// pipeline:  word → seed → family → strand grammar → beads
//
// the engine never paints onto a canvas. it places beads at
// reproducible positions, threads them onto strands, and stores
// the sequence so the renderer can animate the bead-by-bead
// assembly exactly the way a beader would build it.

import { hashSeed, SHAPES } from "./weaverly";

export type BeadFamily =
  | "bracelet"   // linear repeating band
  | "loom"       // grid loom with motif occupancy
  | "fringe"     // hanging vertical strands
  | "medallion"  // centralized concentric ornament
  | "rosette"    // radial petal clusters
  | "netted"     // mesh / network of beads
  | "freeform";  // branching organic clusters

export type BeadShape = "round" | "seed" | "bugle" | "drop" | "faceted" | "pearl";
export type BeadMaterial = "glass" | "crystal" | "metallic" | "ceramic" | "wood" | "gemstone";
export type BeadFinish = "matte" | "gloss" | "iridescent" | "translucent";

export type Bead = {
  id: number;
  x: number;        // normalized [-1, 1] for radial; [0, 1] for linear (x along strand)
  y: number;
  color: string;    // resolved css color (oklch / hex)
  shape: BeadShape;
  size: number;     // radius in px in the renderer's coordinate space
  material: BeadMaterial;
  finish: BeadFinish;
  opacity: number;
  strand: number;   // which strand this bead belongs to
  orderOnStrand: number; // position along the strand (0..n)
};

export type Strand = {
  id: number;
  kind: "linear" | "ring" | "fringe" | "spoke" | "branch" | "mesh";
  // path is a polyline (px) the renderer uses to draw the cord
  // between beads. coords are in the artifact's local space.
  path: { x: number; y: number }[];
  closed: boolean;
};

export type BeadworkArtifact = {
  family: BeadFamily;
  seedWord: string;
  seedHash: number;
  width: number;
  height: number;
  beads: Bead[];     // assembly order — first bead threaded first
  strands: Strand[];
  palette: string[]; // ordered palette used for the rhythm
  rhythm: number[];  // color-index sequence (the "beat" of the pattern)
  notes: string;     // short human description ("rosette · 8-fold · 56 beads")
};

export type GenerateBeadworkInput = {
  text: string;
  family?: BeadFamily;       // omit to auto-pick from seed
  density?: number;          // 0..1 — affects strand count / bead count
  symmetryOrder?: number;    // for medallion / rosette (4..12)
  motifs?: string[];         // semantic motifs from the interpreter
};

// --- prng (local copy so we never share state with other engines) ----
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- palette ----------------------------------------------------------
// derived from a seed so the same word always pulls the same colors.
// kept warm and tactile to suggest real bead materials.
const PALETTES: string[][] = [
  ["#262532", "#c2603b", "#e6c14a", "#f0e9d8", "#7a8aa6"], // ember + cream
  ["#1a2238", "#2a3a6a", "#7a8aa6", "#d6c08a", "#f0e9d8"], // ocean + sand
  ["#3a1f1f", "#7a2f2f", "#c2603b", "#e6c14a", "#f0e9d8"], // garnet + amber
  ["#1c2a1c", "#3b5b3b", "#8aa37a", "#d6c08a", "#f0e9d8"], // forest + bone
  ["#2a1a3a", "#5a3a7a", "#a47ac2", "#e6c14a", "#f0e9d8"], // plum + gold
  ["#262532", "#7a8aa6", "#a8b0c2", "#f0e9d8", "#e6c14a"], // pewter + cream
];

function pickPalette(r: () => number, motifs: string[]): string[] {
  // motif hints bias palette choice without ever forcing it.
  const tagged = motifs.join(" ");
  if (/water|ocean|river|tide|wave/.test(tagged)) return PALETTES[1];
  if (/fire|sun|ember|warm|garnet|rose/.test(tagged)) return PALETTES[2];
  if (/forest|leaf|tree|plant|moss/.test(tagged)) return PALETTES[3];
  if (/night|moon|jewel|royal|violet/.test(tagged)) return PALETTES[4];
  if (/stone|metal|silver|steel|grey/.test(tagged)) return PALETTES[5];
  return PALETTES[Math.floor(r() * PALETTES.length)];
}

// --- material grammar -------------------------------------------------
// every family has a "house mix" of bead shapes/materials that feel
// physically right for that tradition.
const FAMILY_MIX: Record<BeadFamily, { shapes: BeadShape[]; materials: BeadMaterial[]; finishes: BeadFinish[] }> = {
  bracelet:  { shapes: ["seed", "round", "bugle"],   materials: ["glass", "ceramic", "wood"],     finishes: ["gloss", "matte"] },
  loom:      { shapes: ["seed"],                      materials: ["glass"],                        finishes: ["gloss", "matte"] },
  fringe:    { shapes: ["seed", "bugle", "drop"],    materials: ["glass", "crystal", "metallic"], finishes: ["gloss", "iridescent"] },
  medallion: { shapes: ["round", "faceted", "seed"], materials: ["glass", "crystal", "metallic"], finishes: ["gloss", "iridescent"] },
  rosette:   { shapes: ["round", "drop", "seed"],    materials: ["glass", "pearl", "ceramic"],    finishes: ["gloss", "matte"] },
  netted:    { shapes: ["seed", "round"],            materials: ["glass", "crystal"],             finishes: ["gloss", "translucent"] },
  freeform:  { shapes: ["round", "drop", "faceted"], materials: ["gemstone", "glass", "wood"],    finishes: ["matte", "gloss", "iridescent"] },
};

// --- semantic auto-routing -------------------------------------------
// choose a family from the seed word + motifs the way a craft teacher
// would: a rose belongs on a rosette, a forest on a freeform branch,
// a snowflake on a medallion, etc.
export function autoFamily(text: string, motifs: string[] = []): BeadFamily {
  const tagged = (text + " " + motifs.join(" ")).toLowerCase();
  if (/rose|flower|petal|bloom|daisy|tulip|lotus/.test(tagged)) return "rosette";
  if (/sun|star|snowflake|crystal|mandala|wheel|compass/.test(tagged)) return "medallion";
  if (/forest|tree|branch|root|vine|coral/.test(tagged)) return "freeform";
  if (/web|net|honeycomb|lattice|mesh/.test(tagged)) return "netted";
  if (/rain|tear|drop|veil|curtain|fringe|tassel/.test(tagged)) return "fringe";
  if (/grid|loom|panel|sampler|geometry|geometric/.test(tagged)) return "loom";
  return "bracelet";
}

// --- rhythm generator -------------------------------------------------
// the heart of a beadwork pattern is its color sequence. we never
// scatter colors randomly — we compose a short motif (3-6 beads) and
// repeat it with controlled variation. this is what makes beadwork
// feel intentional instead of decorative.
function makeRhythm(r: () => number, paletteSize: number, length: number): number[] {
  const motifLen = 3 + Math.floor(r() * 4); // 3..6
  const motif: number[] = [];
  for (let i = 0; i < motifLen; i++) motif.push(Math.floor(r() * paletteSize));
  // mirror it so the motif is palindromic — reads symmetrically when wrapped.
  const palindrome = [...motif, ...motif.slice(0, -1).reverse()];
  const out: number[] = [];
  for (let i = 0; i < length; i++) out.push(palindrome[i % palindrome.length]);
  return out;
}

// --- master entry -----------------------------------------------------
export function generateBeadwork(input: GenerateBeadworkInput): BeadworkArtifact {
  const text = (input.text || "bead").trim().toLowerCase() || "bead";
  const seedHash = hashSeed(text);
  const r = rng(seedHash);
  const motifs = input.motifs ?? [];
  const family = input.family ?? autoFamily(text, motifs);
  const density = Math.min(1, Math.max(0.2, input.density ?? 0.7));
  const symmetryOrder = input.symmetryOrder ?? (4 + Math.floor(r() * 5) * 2); // 4,6,8,10,12

  const palette = pickPalette(r, motifs);
  const mix = FAMILY_MIX[family];

  // width/height are the artifact's intrinsic canvas size; the renderer
  // fits this into its viewport so the same artifact can be exported
  // at any physical scale.
  const width = 720;
  const height = family === "bracelet" ? 220 : family === "fringe" ? 720 : 720;

  let beads: Bead[] = [];
  let strands: Strand[] = [];
  let rhythm: number[] = [];

  switch (family) {
    case "bracelet": {
      const result = buildBracelet(r, width, height, density, palette, mix);
      beads = result.beads; strands = result.strands; rhythm = result.rhythm;
      break;
    }
    case "loom": {
      const result = buildLoom(r, text, width, height, density, palette, mix);
      beads = result.beads; strands = result.strands; rhythm = result.rhythm;
      break;
    }
    case "fringe": {
      const result = buildFringe(r, width, height, density, palette, mix);
      beads = result.beads; strands = result.strands; rhythm = result.rhythm;
      break;
    }
    case "medallion": {
      const result = buildMedallion(r, width, height, density, symmetryOrder, palette, mix);
      beads = result.beads; strands = result.strands; rhythm = result.rhythm;
      break;
    }
    case "rosette": {
      const result = buildRosette(r, width, height, density, symmetryOrder, palette, mix);
      beads = result.beads; strands = result.strands; rhythm = result.rhythm;
      break;
    }
    case "netted": {
      const result = buildNetted(r, width, height, density, palette, mix);
      beads = result.beads; strands = result.strands; rhythm = result.rhythm;
      break;
    }
    case "freeform": {
      const result = buildFreeform(r, width, height, density, palette, mix);
      beads = result.beads; strands = result.strands; rhythm = result.rhythm;
      break;
    }
  }

  const notes = `${family} · ${strands.length} strand${strands.length === 1 ? "" : "s"} · ${beads.length} beads`;

  return {
    family,
    seedWord: text,
    seedHash,
    width,
    height,
    beads,
    strands,
    palette,
    rhythm,
    notes,
  };
}

// --- helpers ----------------------------------------------------------
function pick<T>(r: () => number, arr: T[]): T { return arr[Math.floor(r() * arr.length)]; }

function makeBead(
  id: number,
  x: number, y: number,
  size: number,
  color: string,
  shape: BeadShape,
  material: BeadMaterial,
  finish: BeadFinish,
  strand: number,
  orderOnStrand: number,
): Bead {
  return {
    id, x, y, size, color, shape, material, finish,
    opacity: finish === "translucent" ? 0.7 : 1,
    strand, orderOnStrand,
  };
}

// --- bracelet ---------------------------------------------------------
// linear band: a horizontal strand (or two stacked) of seed/round/bugle
// beads following a palindromic rhythm. evokes friendship bracelets
// and woven bead bands.
function buildBracelet(r: () => number, w: number, h: number, density: number, palette: string[], mix: typeof FAMILY_MIX["bracelet"]) {
  const rows = 1 + Math.floor(density * 3); // 1..3 stacked rows
  const beadSize = 10 + Math.floor(r() * 4);
  const gap = beadSize * 0.4;
  const stride = beadSize * 2 + gap;
  const margin = beadSize * 2;
  const usable = w - margin * 2;
  const count = Math.floor(usable / stride);
  const rhythm = makeRhythm(r, palette.length, count);
  const startY = h / 2 - ((rows - 1) * stride) / 2;
  const beads: Bead[] = [];
  const strands: Strand[] = [];
  let id = 0;
  for (let row = 0; row < rows; row++) {
    const y = startY + row * stride;
    const path: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const x = margin + i * stride + beadSize;
      // rows are offset by one bead so the rhythm cascades, the way
      // multi-strand bracelets read across the wrist.
      const colorIdx = rhythm[(i + row) % rhythm.length];
      const shape = pick(r, mix.shapes);
      const material = pick(r, mix.materials);
      const finish = pick(r, mix.finishes);
      // bugle beads are stretched on the strand
      const isBugle = shape === "bugle";
      beads.push(makeBead(id++, x, y, isBugle ? beadSize * 0.85 : beadSize, palette[colorIdx], shape, material, finish, row, i));
      path.push({ x, y });
    }
    strands.push({ id: row, kind: "linear", path: [{ x: margin, y }, ...path, { x: w - margin, y }], closed: false });
  }
  return { beads, strands, rhythm };
}

// --- loom -------------------------------------------------------------
// a bead loom: grid of seed beads. the artifact's seed word picks a
// shape mask from the shared library — if that mask matches a cell,
// the bead takes the motif color; otherwise it takes the ground
// color. this is exactly how real loom beadwork resolves a chart.
function buildLoom(r: () => number, text: string, w: number, h: number, density: number, palette: string[], _mix: typeof FAMILY_MIX["loom"]) {
  const cols = 22 + Math.floor(density * 14); // 22..36
  const rows = 22 + Math.floor(density * 14);
  const beadSize = Math.min((w - 40) / cols, (h - 40) / rows) / 2;
  const stride = beadSize * 2 + 1.5;
  const ox = (w - cols * stride) / 2 + beadSize;
  const oy = (h - rows * stride) / 2 + beadSize;
  const shapeKey = pickShapeKey(text, r);
  const shapeFn = SHAPES[shapeKey] ?? SHAPES.diamond;
  const ground = palette[0];
  const motif = palette[1];
  const accent = palette[2];
  const rhythm = makeRhythm(r, palette.length, cols);
  const beads: Bead[] = [];
  const strands: Strand[] = [];
  let id = 0;
  for (let row = 0; row < rows; row++) {
    const y = oy + row * stride;
    const path: { x: number; y: number }[] = [];
    for (let col = 0; col < cols; col++) {
      const x = ox + col * stride;
      const nx = (col / (cols - 1)) * 2 - 1;
      const ny = (row / (rows - 1)) * 2 - 1;
      const inside = shapeFn(nx, ny) > 0;
      // when inside the motif, pick from the palindromic rhythm so
      // the silhouette itself reads as a banded ornament, not flat fill.
      const color = inside
        ? (rhythm[(col + row) % rhythm.length] === 0 ? motif : accent)
        : ground;
      beads.push(makeBead(id++, x, y, beadSize, color, "seed", "glass", "gloss", row, col));
      path.push({ x, y });
    }
    // each weft is its own strand, the way a real loom strings weft per row.
    strands.push({ id: row, kind: "linear", path, closed: false });
  }
  return { beads, strands, rhythm };
}

// --- fringe -----------------------------------------------------------
// vertical hanging strands suspended from a top bar. lengths vary
// with a smooth envelope so the fringe drapes, with a drop bead at
// the bottom of each strand — exactly how beaded fringe is finished.
function buildFringe(r: () => number, w: number, h: number, density: number, palette: string[], mix: typeof FAMILY_MIX["fringe"]) {
  const count = 14 + Math.floor(density * 26);
  const beadSize = 7;
  const margin = 32;
  const stride = (w - margin * 2) / (count - 1);
  const topY = 40;
  const beads: Bead[] = [];
  const strands: Strand[] = [];
  const rhythm = makeRhythm(r, palette.length, 12);
  let id = 0;
  for (let s = 0; s < count; s++) {
    const x = margin + s * stride;
    // catenary-ish envelope: outer strands shorter, center longer
    const u = (s / (count - 1)) * 2 - 1;
    const envelope = 0.65 + 0.35 * Math.cos(u * Math.PI * 0.5);
    const localR = ((s * 9301 + 49297) % 233280) / 233280;
    const len = (h - topY - 40) * envelope * (0.85 + localR * 0.15);
    const beadsOnStrand = Math.floor(len / (beadSize * 2.2));
    const path: { x: number; y: number }[] = [{ x, y: topY }];
    for (let i = 0; i < beadsOnStrand; i++) {
      const y = topY + (i + 1) * (beadSize * 2.2);
      const isLast = i === beadsOnStrand - 1;
      const shape: BeadShape = isLast ? "drop" : pick(r, mix.shapes.filter((sh) => sh !== "drop"));
      const colorIdx = rhythm[(i + s) % rhythm.length];
      const sz = isLast ? beadSize * 1.7 : shape === "bugle" ? beadSize * 0.8 : beadSize;
      beads.push(makeBead(id++, x, y, sz, palette[colorIdx], shape, pick(r, mix.materials), pick(r, mix.finishes), s, i));
      path.push({ x, y });
    }
    strands.push({ id: s, kind: "fringe", path, closed: false });
  }
  return { beads, strands, rhythm };
}

// --- medallion --------------------------------------------------------
// centralized concentric rings with strict radial symmetry. each ring
// is a closed strand; bead counts grow with circumference; colors
// follow the palindromic rhythm so opposite spokes always mirror.
function buildMedallion(r: () => number, w: number, h: number, density: number, sym: number, palette: string[], mix: typeof FAMILY_MIX["medallion"]) {
  const cx = w / 2, cy = h / 2;
  const rings = 4 + Math.floor(density * 4); // 4..8 rings
  const radiusStep = Math.min(w, h) * 0.42 / rings;
  const beads: Bead[] = [];
  const strands: Strand[] = [];
  const rhythm = makeRhythm(r, palette.length, sym);
  let id = 0;
  // center bead
  beads.push(makeBead(id++, cx, cy, 12, palette[2], "faceted", "crystal", "iridescent", 0, 0));
  strands.push({ id: 0, kind: "ring", path: [{ x: cx, y: cy }], closed: false });
  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring * radiusStep;
    // bead count scales with circumference but is quantized to sym so
    // every ring respects the medallion's rotational symmetry.
    const perSym = Math.max(1, Math.round((2 * Math.PI * radius) / (sym * 14)));
    const count = sym * perSym;
    const beadSize = Math.max(4, 11 - ring * 0.8);
    const path: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const x = cx + Math.cos(t) * radius;
      const y = cy + Math.sin(t) * radius;
      // color is keyed by the spoke index (i % sym) so opposing spokes
      // always carry the same color — this is what gives a medallion
      // its read-at-a-glance symmetry.
      const colorIdx = rhythm[(i % sym + ring) % rhythm.length];
      const shape = ring === rings ? "drop" : pick(r, mix.shapes);
      const finish = ring % 2 === 0 ? "iridescent" : pick(r, mix.finishes);
      beads.push(makeBead(id++, x, y, beadSize, palette[colorIdx], shape, pick(r, mix.materials), finish, ring, i));
      path.push({ x, y });
    }
    strands.push({ id: ring, kind: "ring", path, closed: true });
  }
  return { beads, strands, rhythm };
}

// --- rosette ----------------------------------------------------------
// petal clusters around a central bead. each petal is its own short
// strand; petals repeat with rotational symmetry. tuned for floral
// concepts (rose, daisy, lotus, sun).
function buildRosette(r: () => number, w: number, h: number, density: number, sym: number, palette: string[], mix: typeof FAMILY_MIX["rosette"]) {
  const cx = w / 2, cy = h / 2;
  const petals = sym;
  const layers = 2 + Math.floor(density * 2); // 2..4 nested petal layers
  const baseRadius = Math.min(w, h) * 0.12;
  const petalLen = Math.min(w, h) * 0.32 / layers;
  const beads: Bead[] = [];
  const strands: Strand[] = [];
  const rhythm = makeRhythm(r, palette.length, layers);
  let id = 0;
  // center cluster — a small ring of beads
  const centerCount = 7;
  for (let i = 0; i < centerCount; i++) {
    const t = (i / centerCount) * Math.PI * 2;
    beads.push(makeBead(id++, cx + Math.cos(t) * 6, cy + Math.sin(t) * 6, 7, palette[2], "round", "pearl", "gloss", 0, i));
  }
  beads.push(makeBead(id++, cx, cy, 9, palette[1], "faceted", "crystal", "iridescent", 0, centerCount));
  strands.push({ id: 0, kind: "ring", path: [{ x: cx, y: cy }], closed: true });
  let strandId = 1;
  for (let layer = 0; layer < layers; layer++) {
    const layerOffset = (layer % 2) * (Math.PI / petals); // alternate layers staggered
    const r0 = baseRadius + layer * petalLen * 0.6;
    const r1 = r0 + petalLen;
    const colorIdx = rhythm[layer % rhythm.length];
    for (let p = 0; p < petals; p++) {
      const angle = (p / petals) * Math.PI * 2 + layerOffset;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const beadsOnPetal = 4 + Math.floor(density * 3);
      const path: { x: number; y: number }[] = [{ x: cx, y: cy }];
      for (let i = 0; i < beadsOnPetal; i++) {
        const t = i / (beadsOnPetal - 1);
        const radius = r0 + t * (r1 - r0);
        // give the petal a slight outward curve so it reads as a
        // teardrop, not a straight spoke.
        const bow = Math.sin(t * Math.PI) * 8;
        const px = -dy * bow;
        const py = dx * bow;
        const x = cx + dx * radius + px;
        const y = cy + dy * radius + py;
        const isTip = i === beadsOnPetal - 1;
        const sz = isTip ? 9 : 6.5 - t * 1.5;
        const shape: BeadShape = isTip ? "drop" : pick(r, mix.shapes);
        beads.push(makeBead(id++, x, y, sz, palette[(colorIdx + (isTip ? 1 : 0)) % palette.length], shape, pick(r, mix.materials), pick(r, mix.finishes), strandId, i));
        path.push({ x, y });
      }
      strands.push({ id: strandId++, kind: "branch", path, closed: false });
    }
  }
  return { beads, strands, rhythm };
}

// --- netted -----------------------------------------------------------
// honeycomb-style mesh: beads at lattice intersections of a staggered
// grid, connected to their neighbors. evokes netted beadwork collars
// and beaded mesh bags.
function buildNetted(r: () => number, w: number, h: number, density: number, palette: string[], _mix: typeof FAMILY_MIX["netted"]) {
  const cellsX = 10 + Math.floor(density * 10);
  const cellsY = 10 + Math.floor(density * 10);
  const margin = 36;
  const dx = (w - margin * 2) / (cellsX - 1);
  const dy = (h - margin * 2) / (cellsY - 1);
  const rhythm = makeRhythm(r, palette.length, cellsX);
  const beads: Bead[] = [];
  const strands: Strand[] = [];
  let id = 0;
  // node positions
  type N = { x: number; y: number; id: number };
  const nodes: N[][] = [];
  for (let row = 0; row < cellsY; row++) {
    const rowNodes: N[] = [];
    const stagger = (row % 2) * (dx / 2);
    for (let col = 0; col < cellsX; col++) {
      const x = margin + col * dx + stagger;
      const y = margin + row * dy;
      if (x > w - margin) continue;
      const colorIdx = rhythm[(col + row) % rhythm.length];
      const bead = makeBead(id, x, y, 6, palette[colorIdx], "seed", "glass", "translucent", row, col);
      rowNodes.push({ x, y, id });
      beads.push(bead);
      id++;
    }
    nodes.push(rowNodes);
  }
  // strands: connect each node to its right neighbor and to the two
  // below in the staggered row. this is the netted-stitch topology.
  for (let row = 0; row < nodes.length; row++) {
    for (let col = 0; col < nodes[row].length; col++) {
      const a = nodes[row][col];
      const right = nodes[row][col + 1];
      if (right) strands.push({ id: strands.length, kind: "mesh", path: [{ x: a.x, y: a.y }, { x: right.x, y: right.y }], closed: false });
      const below = nodes[row + 1];
      if (below) {
        const c1 = below[col]; const c2 = below[col + 1];
        if (c1) strands.push({ id: strands.length, kind: "mesh", path: [{ x: a.x, y: a.y }, { x: c1.x, y: c1.y }], closed: false });
        if (c2) strands.push({ id: strands.length, kind: "mesh", path: [{ x: a.x, y: a.y }, { x: c2.x, y: c2.y }], closed: false });
      }
    }
  }
  return { beads, strands, rhythm };
}

// --- freeform ---------------------------------------------------------
// branching organic clusters. starts at the center, grows recursive
// branches with bead clusters at the tips. coherent because each
// branch follows its parent direction with bounded jitter.
function buildFreeform(r: () => number, w: number, h: number, density: number, palette: string[], mix: typeof FAMILY_MIX["freeform"]) {
  const cx = w / 2, cy = h / 2;
  const beads: Bead[] = [];
  const strands: Strand[] = [];
  const rhythm = makeRhythm(r, palette.length, 7);
  let id = 0;
  const maxDepth = 3 + Math.floor(density * 2);
  const initialBranches = 5 + Math.floor(density * 3);

  // central seed bead
  beads.push(makeBead(id++, cx, cy, 11, palette[2], "faceted", "gemstone", "iridescent", 0, 0));

  let strandId = 1;
  function grow(x: number, y: number, angle: number, length: number, depth: number) {
    const segs = 4 + Math.floor(r() * 3);
    const path: { x: number; y: number }[] = [{ x, y }];
    let cx2 = x, cy2 = y;
    const colorIdx = rhythm[(depth + segs) % rhythm.length];
    const localStrand = strandId++;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      // gentle jitter on the angle so branches curve organically
      const a = angle + (r() - 0.5) * 0.4;
      cx2 += Math.cos(a) * (length / segs);
      cy2 += Math.sin(a) * (length / segs);
      const isTip = i === segs;
      const sz = isTip ? 9 : 5 + (1 - t) * 2;
      const shape: BeadShape = isTip ? "drop" : pick(r, mix.shapes);
      beads.push(makeBead(id++, cx2, cy2, sz, palette[(colorIdx + (isTip ? 1 : 0)) % palette.length], shape, pick(r, mix.materials), pick(r, mix.finishes), localStrand, i));
      path.push({ x: cx2, y: cy2 });
    }
    strands.push({ id: localStrand, kind: "branch", path, closed: false });
    if (depth < maxDepth) {
      const childCount = depth === 1 ? 2 : 1;
      for (let k = 0; k < childCount; k++) {
        const childAngle = angle + (k === 0 ? -0.7 : 0.7) + (r() - 0.5) * 0.3;
        grow(cx2, cy2, childAngle, length * 0.6, depth + 1);
      }
    }
  }

  const baseLength = Math.min(w, h) * 0.22;
  for (let b = 0; b < initialBranches; b++) {
    const angle = (b / initialBranches) * Math.PI * 2 + r() * 0.1;
    grow(cx, cy, angle, baseLength, 1);
  }
  return { beads, strands, rhythm };
}

// --- shape pick (for loom motif) -------------------------------------
function pickShapeKey(text: string, r: () => number): string {
  const keys = Object.keys(SHAPES);
  // try the exact word first — many shapes in the lib are named after
  // common nouns ("rose", "heart", "moon")
  if (keys.includes(text)) return text;
  // otherwise pick deterministically from the rng so the same word
  // always loads the same motif onto the loom.
  return keys[Math.floor(r() * keys.length)];
}

// --- ascii export -----------------------------------------------------
// for copy/export. renders each bead as a colored dot at its grid
// position. lossy for radial families but useful as a chart.
export function beadworkToAscii(art: BeadworkArtifact): string {
  const cols = 60;
  const rows = Math.max(20, Math.floor((art.height / art.width) * cols * 0.5));
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill(" "));
  for (const b of art.beads) {
    const cx = Math.floor((b.x / art.width) * cols);
    const cy = Math.floor((b.y / art.height) * rows);
    if (cy < 0 || cy >= rows || cx < 0 || cx >= cols) continue;
    grid[cy][cx] = b.shape === "drop" ? "▼" : b.shape === "bugle" ? "▮" : b.shape === "faceted" ? "◆" : "●";
  }
  const header = `# beadwork · ${art.family} · seed: ${art.seedWord}\n# ${art.notes}\n# rhythm: ${art.rhythm.slice(0, 12).join("-")}…\n`;
  return header + grid.map((row) => row.join("")).join("\n");
}
