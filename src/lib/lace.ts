// lace engine
// ---------------------------------------------------------------
// dedicated generator for the lace mode.
//
// philosophy:
//   a lace pattern is a NETWORK, not a collection of shapes. every
//   visible mark on the cloth is a node (a loop / knot / petal) or an
//   edge (a thread between two nodes). the engine builds one connected
//   graph and the renderer follows the thread; nothing floats, nothing
//   scatters, nothing is placed at random.
//
// generation is growth-driven. we start from a center or a stem and
// add rings, branches, or rosettes outward. an emitted "buildIndex"
// on every edge lets the renderer animate the lace as it forms.
//
// the same seed word always yields the same lace family. small
// changes in the word shift symmetry order, ring counts, and petal
// rules.

import { hashSeed } from "./weaverly";

export type LaceFamily =
  | "doily"        // concentric radial rings + petals
  | "crochet"      // rings of loops, soft modular growth
  | "tatting"      // rosettes of small repeated knots
  | "bobbin"       // braided flowing pathways
  | "floral"       // botanical branching from a central stem
  | "geometric";   // interlocking polygon lattice

export type NodeKind = "center" | "knot" | "loop" | "petal" | "leaf" | "junction";

export interface LaceNode {
  id: number;
  x: number;            // normalized -1..1
  y: number;
  kind: NodeKind;
  radius: number;       // visual loop / knot size, normalized
}

export type EdgeKind = "thread" | "loop-link" | "branch" | "stem" | "arc";

export interface LaceEdge {
  a: number;            // node id
  b: number;
  kind: EdgeKind;
  // optional control points (normalized) for curved threads. when
  // present the renderer draws a cubic bezier; absent = straight.
  c1?: { x: number; y: number };
  c2?: { x: number; y: number };
  // monotonic build order — drives the row-by-row growth animation.
  buildIndex: number;
}

export interface LaceGraph {
  nodes: LaceNode[];
  edges: LaceEdge[];
  family: LaceFamily;
  symmetryOrder: number;   // 4/5/6/8/12 — radial petals/spokes
  rings: number;
  seedWord: string;
}

export interface LaceOptions {
  text: string;
  density: number;          // 0..1 — drives ring count + ornament complexity
  family?: LaceFamily;      // omit for auto
  symmetry: "none" | "mirror-x" | "mirror-y" | "quad" | "radial";
}

// --- prng -------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const FAMILIES: LaceFamily[] = ["doily", "crochet", "tatting", "bobbin", "floral", "geometric"];

// pick a symmetry order from a small set of "lace-friendly" divisors.
// 5 and 7 give the most distinctive samplers; 6/8 read as traditional.
const SYMS = [4, 5, 6, 6, 8, 8, 12];

interface Builder {
  nodes: LaceNode[];
  edges: LaceEdge[];
  build: number;
}

function newBuilder(): Builder {
  return { nodes: [], edges: [], build: 0 };
}

function addNode(b: Builder, x: number, y: number, kind: NodeKind, radius = 0.012): LaceNode {
  const n: LaceNode = { id: b.nodes.length, x, y, kind, radius };
  b.nodes.push(n);
  return n;
}

function addEdge(
  b: Builder, a: number, c: number, kind: EdgeKind,
  ctrl?: { c1: { x: number; y: number }; c2: { x: number; y: number } },
) {
  b.edges.push({ a, b: c, kind, buildIndex: b.build++, c1: ctrl?.c1, c2: ctrl?.c2 });
}

// --- shared helpers ---------------------------------------------------
// build a control-point pair that bows an edge outward from origin, so
// rings naturally read as curves instead of straight chords.
function bowOutward(ax: number, ay: number, bx: number, by: number, amount: number) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const len = Math.hypot(mx, my) || 1;
  const nx = mx / len;
  const ny = my / len;
  return {
    c1: { x: ax + nx * amount, y: ay + ny * amount },
    c2: { x: bx + nx * amount, y: by + ny * amount },
  };
}

// --- doily: concentric rings + petal edge ----------------------------
function buildDoily(opts: LaceOptions, sym: number, rings: number, rand: () => number): Builder {
  const b = newBuilder();
  const center = addNode(b, 0, 0, "center", 0.035);

  // ring radii spaced so the outer petals reach near the bounds.
  const radii: number[] = [];
  for (let r = 1; r <= rings; r++) radii.push((r / (rings + 0.5)) * 0.92);

  const ringNodes: LaceNode[][] = [];
  for (let r = 0; r < rings; r++) {
    const radius = radii[r];
    const count = sym * (r === 0 ? 1 : Math.max(1, Math.round(r * 1.2)));
    const ring: LaceNode[] = [];
    const offset = r * (TAU / (sym * 4));
    for (let i = 0; i < count; i++) {
      const t = (i / count) * TAU + offset;
      const x = Math.cos(t) * radius;
      const y = Math.sin(t) * radius;
      const kind: NodeKind = r === rings - 1 ? "petal" : "knot";
      ring.push(addNode(b, x, y, kind, kind === "petal" ? 0.022 : 0.014));
    }
    ringNodes.push(ring);
  }

  // spokes from center to the first ring
  for (const n of ringNodes[0]) addEdge(b, center.id, n.id, "thread");

  // chain each ring around with bowed arcs
  for (let r = 0; r < rings; r++) {
    const ring = ringNodes[r];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const c = ring[(i + 1) % ring.length];
      addEdge(b, a.id, c.id, "arc", bowOutward(a.x, a.y, c.x, c.y, 0.04 + 0.02 * r));
    }
  }

  // diagonal links between adjacent rings — this is what gives lace its
  // diamond mesh look. we walk the smaller ring and link each node to
  // two neighbours on the next ring out.
  for (let r = 0; r < rings - 1; r++) {
    const inner = ringNodes[r];
    const outer = ringNodes[r + 1];
    const ratio = outer.length / inner.length;
    for (let i = 0; i < inner.length; i++) {
      const j0 = Math.floor(i * ratio);
      const j1 = (j0 + 1) % outer.length;
      addEdge(b, inner[i].id, outer[j0].id, "branch");
      addEdge(b, inner[i].id, outer[j1].id, "branch");
    }
  }

  // scalloped edge: every other outer petal gets a little decorative
  // loop bowed further outward, hung from its two neighbours.
  const outerRing = ringNodes[rings - 1];
  for (let i = 0; i < outerRing.length; i += 2) {
    const a = outerRing[i];
    const c = outerRing[(i + 2) % outerRing.length];
    addEdge(b, a.id, c.id, "arc", bowOutward(a.x, a.y, c.x, c.y, 0.08));
  }
  // suppress unused-warning for rand without changing behaviour
  void rand;
  return b;
}

// --- crochet: rings of loops linked through shared neighbours ---------
function buildCrochet(opts: LaceOptions, sym: number, rings: number, rand: () => number): Builder {
  const b = newBuilder();
  const center = addNode(b, 0, 0, "center", 0.04);

  let prev: LaceNode[] = [center];
  for (let r = 1; r <= rings; r++) {
    const radius = (r / (rings + 0.5)) * 0.92;
    const count = sym * r;
    const ring: LaceNode[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * TAU + (r % 2 ? TAU / (count * 2) : 0);
      ring.push(addNode(b, Math.cos(t) * radius, Math.sin(t) * radius, "loop", 0.028));
    }
    // chain the loops to themselves
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const c = ring[(i + 1) % ring.length];
      addEdge(b, a.id, c.id, "loop-link", bowOutward(a.x, a.y, c.x, c.y, 0.025));
    }
    // anchor each loop to its closest neighbour on the previous ring
    for (const n of ring) {
      let nearest = prev[0], best = Infinity;
      for (const p of prev) {
        const d = (p.x - n.x) ** 2 + (p.y - n.y) ** 2;
        if (d < best) { best = d; nearest = p; }
      }
      addEdge(b, n.id, nearest.id, "branch");
    }
    prev = ring;
  }
  void rand;
  return b;
}

// --- tatting: rosettes of small knots ---------------------------------
function buildTatting(opts: LaceOptions, sym: number, rings: number, rand: () => number): Builder {
  const b = newBuilder();
  const center = addNode(b, 0, 0, "center", 0.03);

  for (let r = 1; r <= rings; r++) {
    const radius = (r / (rings + 0.6)) * 0.9;
    const rosettes = sym;
    const inRosette = 5 + (r % 2);
    for (let i = 0; i < rosettes; i++) {
      const baseT = (i / rosettes) * TAU;
      const cx = Math.cos(baseT) * radius;
      const cy = Math.sin(baseT) * radius;
      const rosetteR = 0.06 + r * 0.01;
      const knots: LaceNode[] = [];
      for (let k = 0; k < inRosette; k++) {
        const kt = (k / inRosette) * TAU + baseT;
        knots.push(addNode(b, cx + Math.cos(kt) * rosetteR, cy + Math.sin(kt) * rosetteR, "knot", 0.012));
      }
      // close the rosette into a ring of knots
      for (let k = 0; k < knots.length; k++) {
        addEdge(b, knots[k].id, knots[(k + 1) % knots.length].id, "thread");
      }
      // tie rosette back to center (or to a previous rosette)
      addEdge(b, knots[0].id, center.id, "thread",
        bowOutward(knots[0].x, knots[0].y, 0, 0, -0.08));
      // chain rosettes around the ring
      if (i > 0) {
        const prevAngle = ((i - 1) / rosettes) * TAU;
        const px = Math.cos(prevAngle) * radius;
        const py = Math.sin(prevAngle) * radius;
        // find the knot in the previous rosette closest to this one
        const here = knots[0];
        // approximate previous closest knot at same offset
        const prevX = px + Math.cos(prevAngle) * 0.05;
        const prevY = py + Math.sin(prevAngle) * 0.05;
        // place a junction node halfway and link
        const j = addNode(b, (here.x + prevX) / 2, (here.y + prevY) / 2, "junction", 0.01);
        addEdge(b, here.id, j.id, "thread");
      }
    }
  }
  void rand;
  return b;
}

// --- bobbin: braided pathways winding around the center ---------------
function buildBobbin(opts: LaceOptions, sym: number, rings: number, rand: () => number): Builder {
  const b = newBuilder();
  addNode(b, 0, 0, "center", 0.02);

  // each "bobbin pair" is two interleaved spirals — they cross at every
  // half-turn, which is how real bobbin lace gets its braided look.
  const strands = sym;
  const turns = rings + 1;
  const stepsPerTurn = 18;
  for (let s = 0; s < strands; s++) {
    const phase = (s / strands) * TAU;
    let prevA: LaceNode | null = null;
    let prevB: LaceNode | null = null;
    for (let i = 0; i <= turns * stepsPerTurn; i++) {
      const t = i / stepsPerTurn;
      const r = 0.08 + (t / turns) * 0.85;
      const a = phase + t * TAU * 0.6;
      const wob = Math.sin(t * Math.PI * 2) * 0.03;
      const nA = addNode(b, Math.cos(a) * r + Math.cos(a + Math.PI / 2) * wob,
                            Math.sin(a) * r + Math.sin(a + Math.PI / 2) * wob,
                            "junction", 0.009);
      const nB = addNode(b, Math.cos(a) * r - Math.cos(a + Math.PI / 2) * wob,
                            Math.sin(a) * r - Math.sin(a + Math.PI / 2) * wob,
                            "junction", 0.009);
      if (prevA) addEdge(b, prevA.id, nA.id, "thread");
      if (prevB) addEdge(b, prevB.id, nB.id, "thread");
      // crossover every few steps — the braid
      if (i % 4 === 0 && prevA && prevB) addEdge(b, prevA.id, nB.id, "thread");
      prevA = nA;
      prevB = nB;
    }
  }
  void rand;
  return b;
}

// --- floral: branching botanical lace ---------------------------------
function buildFloral(opts: LaceOptions, sym: number, rings: number, rand: () => number): Builder {
  const b = newBuilder();
  const center = addNode(b, 0, 0, "center", 0.035);

  const stems = sym;
  for (let s = 0; s < stems; s++) {
    const baseAngle = (s / stems) * TAU;
    let prev = center;
    const segments = 3 + rings;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const r = t * 0.9;
      // gentle s-curve along the stem
      const sway = Math.sin(t * Math.PI * 2 + s) * 0.08;
      const a = baseAngle + sway;
      const node = addNode(b, Math.cos(a) * r, Math.sin(a) * r,
        i === segments ? "petal" : "junction", i === segments ? 0.03 : 0.012);
      addEdge(b, prev.id, node.id, "stem",
        bowOutward(prev.x, prev.y, node.x, node.y, 0.02));
      // side leaves on every other segment
      if (i > 1 && i < segments && i % 2 === 0) {
        for (const side of [-1, 1]) {
          const la = a + side * 0.7;
          const lr = 0.08 + rand() * 0.04;
          const leaf = addNode(b, node.x + Math.cos(la) * lr, node.y + Math.sin(la) * lr,
            "leaf", 0.018);
          addEdge(b, node.id, leaf.id, "branch",
            bowOutward(node.x, node.y, leaf.x, leaf.y, 0.03 * side));
        }
      }
      prev = node;
    }
  }
  // close the canopy: link adjacent petals so the lace stays one network
  const petals = b.nodes.filter((n) => n.kind === "petal");
  petals.sort((a, c) => Math.atan2(a.y, a.x) - Math.atan2(c.y, c.x));
  for (let i = 0; i < petals.length; i++) {
    const a = petals[i];
    const c = petals[(i + 1) % petals.length];
    addEdge(b, a.id, c.id, "arc", bowOutward(a.x, a.y, c.x, c.y, 0.06));
  }
  return b;
}

// --- geometric: interlocking polygon lattice --------------------------
function buildGeometric(opts: LaceOptions, sym: number, rings: number, rand: () => number): Builder {
  const b = newBuilder();
  // build a polar lattice: rings of `sym` polygons each, edges along
  // and between rings. junctions get a small ornamental knot.
  const center = addNode(b, 0, 0, "center", 0.025);
  const layers: LaceNode[][] = [];
  for (let r = 1; r <= rings; r++) {
    const radius = (r / (rings + 0.5)) * 0.9;
    const count = sym * 2;
    const layer: LaceNode[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * TAU + (r % 2 ? TAU / (count * 2) : 0);
      layer.push(addNode(b, Math.cos(t) * radius, Math.sin(t) * radius, "junction", 0.011));
    }
    for (let i = 0; i < layer.length; i++) {
      addEdge(b, layer[i].id, layer[(i + 1) % layer.length].id, "thread");
    }
    layers.push(layer);
  }
  // spokes
  for (let i = 0; i < layers[0].length; i++) addEdge(b, center.id, layers[0][i].id, "thread");
  for (let r = 0; r < layers.length - 1; r++) {
    const inner = layers[r];
    const outer = layers[r + 1];
    for (let i = 0; i < inner.length; i++) {
      addEdge(b, inner[i].id, outer[i].id, "thread");
      addEdge(b, inner[i].id, outer[(i + 1) % outer.length].id, "thread");
    }
  }
  void rand;
  return b;
}

// --- top-level ---------------------------------------------------------
function pickFamily(rand: () => number, override?: LaceFamily): LaceFamily {
  if (override) return override;
  return FAMILIES[Math.floor(rand() * FAMILIES.length)];
}

export function generateLace(opts: LaceOptions): LaceGraph {
  const seed = hashSeed(opts.text || "weaverly");
  const rand = mulberry32(seed);

  const family = pickFamily(rand, opts.family);
  const sym = SYMS[seed % SYMS.length];
  // density biases the number of rings — more rings = more intricate.
  const rings = Math.max(2, Math.round(2 + opts.density * 5));

  let builder: Builder;
  switch (family) {
    case "doily":     builder = buildDoily(opts, sym, rings, rand); break;
    case "crochet":   builder = buildCrochet(opts, sym, rings, rand); break;
    case "tatting":   builder = buildTatting(opts, sym, rings, rand); break;
    case "bobbin":    builder = buildBobbin(opts, sym, rings, rand); break;
    case "floral":    builder = buildFloral(opts, sym, rings, rand); break;
    case "geometric": builder = buildGeometric(opts, sym, rings, rand); break;
  }

  return {
    nodes: builder.nodes,
    edges: builder.edges,
    family,
    symmetryOrder: sym,
    rings,
    seedWord: opts.text,
  };
}

// emit a tiny text description of the network — node/edge counts plus
// the threading order. survives copy/paste as a lace "recipe".
export function laceToAscii(g: LaceGraph): string {
  const lines: string[] = [];
  lines.push(`# lace network — ${g.family} · seed "${g.seedWord}"`);
  lines.push(`# ${g.nodes.length} nodes · ${g.edges.length} threads · ${g.symmetryOrder}-fold · ${g.rings} rings`);
  lines.push("");
  lines.push("threading order (a -> b · kind):");
  for (const e of g.edges) {
    lines.push(`${e.a.toString().padStart(4)} -> ${e.b.toString().padStart(4)} · ${e.kind}`);
  }
  return lines.join("\n");
}
