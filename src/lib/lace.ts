// lace engine — growth-based, connectivity-first
// ---------------------------------------------------------------
// philosophy:
//   lace is not illustration. lace is a TEXTILE NETWORK. every visible
//   mark belongs to a single connected component reachable through
//   threads, loops and knots. nothing floats, nothing is "placed", no
//   ornament exists independently of the surrounding fabric.
//
// pipeline (same for every family, only the strategy / parameters
// change):
//
//   input  →  semantic hint  →  family + grammar  →  seed nodes
//          →  growth simulation (radial | branching | lattice | hybrid)
//          →  connection formation (siblings, neighbours, mesh)
//          →  motif differentiation (loops, knots, petals — *attached*)
//          →  boundary system (scallops, points, arcs)
//          →  build-order assignment (BFS from seeds → animation order)
//
// every new node enters the graph through an edge to an existing node,
// so the graph is connected by construction. cross-links and motifs are
// added on top of that spanning skeleton; nothing is ever orphaned.
//
// API is preserved: generateLace(opts) -> LaceGraph; laceToAscii(g).

import { hashSeed } from "./weaverly";

// ───────────────────────────── types ──────────────────────────────────
export type LaceFamily =
  | "doily"        // radial growth, dense rings, scalloped edge
  | "crochet"      // radial growth, dominant loop motifs
  | "tatting"      // radial growth, repeated knot clusters
  | "bobbin"       // lattice growth, braided thread pathways
  | "floral"       // branching growth, botanical motifs
  | "geometric";   // lattice growth, needle-style mesh

export type NodeKind =
  | "center"     // single root for radial families
  | "junction"   // structural skeleton — multiple pathways meet
  | "loop"       // crochet loop / chain element
  | "knot"       // tatting knot / picot
  | "petal"      // ornamental motif tip
  | "leaf"       // botanical motif
  | "motif"      // generic motif anchor
  | "boundary";  // perimeter / scallop node

export type EdgeKind =
  | "thread"      // generic structural thread
  | "loop-link"   // chain of loops in a row
  | "branch"      // diagonal connection between rings or stems
  | "stem"        // main stem of a branching system
  | "arc"         // bowed connection along a ring
  | "scallop"     // perimeter ornament
  | "motif-link"; // anchors a motif to its host junction

export interface LaceNode {
  id: number;
  x: number;           // normalized -1..1
  y: number;
  kind: NodeKind;
  radius: number;      // visual loop / knot size, normalized
  depth?: number;      // growth depth from seed (for layering)
}

export interface LaceEdge {
  a: number;
  b: number;
  kind: EdgeKind;
  c1?: { x: number; y: number };
  c2?: { x: number; y: number };
  buildIndex: number;  // BFS-style growth order — drives animation
}

export interface LaceGraph {
  nodes: LaceNode[];
  edges: LaceEdge[];
  family: LaceFamily;
  symmetryOrder: number;
  rings: number;        // growth depth
  seedWord: string;
}

export interface LaceOptions {
  text: string;
  density: number;                                  // 0..1 → growth depth
  family?: LaceFamily;
  symmetry: "none" | "mirror-x" | "mirror-y" | "quad" | "radial";
}

type GrowthStrategy = "radial" | "branching" | "lattice" | "hybrid";

// ──────────────────────────── prng + utils ───────────────────────────
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
const SYMS = [4, 5, 6, 6, 8, 8, 12];

const STRATEGY_FOR: Record<LaceFamily, GrowthStrategy> = {
  doily: "radial",
  crochet: "radial",
  tatting: "radial",
  bobbin: "lattice",
  geometric: "lattice",
  floral: "branching",
};

// ──────────────────────────── builder ────────────────────────────────
interface Builder {
  nodes: LaceNode[];
  edges: LaceEdge[];
  build: number;
}

function newBuilder(): Builder {
  return { nodes: [], edges: [], build: 0 };
}

function addNode(b: Builder, x: number, y: number, kind: NodeKind, radius = 0.012, depth = 0): LaceNode {
  const n: LaceNode = { id: b.nodes.length, x, y, kind, radius, depth };
  b.nodes.push(n);
  return n;
}

function addEdge(
  b: Builder, a: number, c: number, kind: EdgeKind,
  ctrl?: { c1: { x: number; y: number }; c2: { x: number; y: number } },
) {
  b.edges.push({ a, b: c, kind, c1: ctrl?.c1, c2: ctrl?.c2, buildIndex: 0 });
}

// bow an edge outward from origin (so radial rings read as curves)
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

// reassign every edge's buildIndex via BFS from the seed (lowest-id
// node = first added). this is what makes the animation feel like
// growth rather than a list playback.
function assignBuildOrderBFS(b: Builder) {
  const adj: Map<number, number[]> = new Map();
  for (let i = 0; i < b.edges.length; i++) {
    const e = b.edges[i];
    (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(i);
    (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(i);
  }
  const visitedEdge = new Set<number>();
  const visitedNode = new Set<number>();
  const queue: number[] = [];
  // seed = node id 0 (always a seed/center) — but tolerate gaps
  if (b.nodes.length === 0) return;
  queue.push(0);
  visitedNode.add(0);
  let order = 0;
  while (queue.length) {
    const n = queue.shift()!;
    const edges = adj.get(n) ?? [];
    // sort edges by the *depth* of the other endpoint so growth fans
    // outward smoothly rather than jumping
    edges.sort((i, j) => {
      const oi = b.edges[i].a === n ? b.edges[i].b : b.edges[i].a;
      const oj = b.edges[j].a === n ? b.edges[j].b : b.edges[j].a;
      return (b.nodes[oi]?.depth ?? 0) - (b.nodes[oj]?.depth ?? 0);
    });
    for (const ei of edges) {
      if (visitedEdge.has(ei)) continue;
      visitedEdge.add(ei);
      b.edges[ei].buildIndex = order++;
      const other = b.edges[ei].a === n ? b.edges[ei].b : b.edges[ei].a;
      if (!visitedNode.has(other)) {
        visitedNode.add(other);
        queue.push(other);
      }
    }
  }
  // any leftover (disconnected) edges — append at the end so they still
  // animate, but they should never exist in a correct build.
  for (let i = 0; i < b.edges.length; i++) {
    if (!visitedEdge.has(i)) b.edges[i].buildIndex = order++;
  }
}

// ──────────────────── motif attachments (always linked) ──────────────
// every motif is attached to a host junction through an explicit
// motif-link edge, so the network stays single-component.

function attachLoopRing(b: Builder, host: LaceNode, count: number, size: number, depth: number) {
  // small ring of loop nodes around a host. one motif-link tethers it.
  const baseAngle = Math.atan2(host.y, host.x);
  const loops: LaceNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = baseAngle + (i / count) * TAU;
    loops.push(addNode(b, host.x + Math.cos(t) * size, host.y + Math.sin(t) * size, "loop", size * 0.55, depth));
  }
  addEdge(b, host.id, loops[0].id, "motif-link");
  for (let i = 0; i < loops.length; i++) {
    addEdge(b, loops[i].id, loops[(i + 1) % loops.length].id, "loop-link",
      bowOutward(loops[i].x, loops[i].y, loops[(i + 1) % loops.length].x, loops[(i + 1) % loops.length].y, size * 0.4));
  }
}

function attachKnotCluster(b: Builder, host: LaceNode, count: number, size: number, depth: number) {
  const baseAngle = Math.atan2(host.y, host.x);
  const knots: LaceNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = baseAngle + (i / count) * TAU + 0.2;
    knots.push(addNode(b, host.x + Math.cos(t) * size, host.y + Math.sin(t) * size, "knot", size * 0.35, depth));
  }
  addEdge(b, host.id, knots[0].id, "motif-link");
  for (let i = 0; i < knots.length; i++) {
    addEdge(b, knots[i].id, knots[(i + 1) % knots.length].id, "thread");
  }
}

function attachPetal(b: Builder, host: LaceNode, depth: number, size = 0.07) {
  const ang = Math.atan2(host.y, host.x) || 0;
  const tipX = host.x + Math.cos(ang) * size;
  const tipY = host.y + Math.sin(ang) * size;
  const petal = addNode(b, tipX, tipY, "petal", size * 0.4, depth);
  addEdge(b, host.id, petal.id, "motif-link",
    bowOutward(host.x, host.y, tipX, tipY, size * 0.3));
}

function attachLeafPair(b: Builder, host: LaceNode, depth: number, size = 0.06) {
  const ang = Math.atan2(host.y, host.x);
  for (const side of [-1, 1]) {
    const la = ang + side * 0.7;
    const lx = host.x + Math.cos(la) * size;
    const ly = host.y + Math.sin(la) * size;
    const leaf = addNode(b, lx, ly, "leaf", size * 0.3, depth);
    addEdge(b, host.id, leaf.id, "motif-link",
      bowOutward(host.x, host.y, lx, ly, size * 0.25 * side));
  }
}

// ───────────────────── radial growth (doily / crochet / tatting) ─────
function growRadial(
  b: Builder, family: LaceFamily, sym: number, depth: number, rand: () => number,
) {
  const center = addNode(b, 0, 0, "center", 0.035, 0);

  // ring counts swell slightly so outer rings have more nodes (more
  // structural detail near the perimeter — the lace "blooms").
  const ringNodes: LaceNode[][] = [];
  for (let r = 1; r <= depth; r++) {
    const radius = (r / (depth + 0.5)) * 0.9;
    const count = sym * Math.max(1, Math.round(r * 1.1));
    const offset = (r % 2 ? TAU / (count * 2) : 0);
    const ring: LaceNode[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * TAU + offset;
      // small angular jitter for organic feel; deterministic via rand
      const j = (rand() - 0.5) * 0.02;
      const rJit = radius * (1 + (rand() - 0.5) * 0.015);
      ring.push(addNode(b, Math.cos(t + j) * rJit, Math.sin(t + j) * rJit, "junction", 0.011, r));
    }
    ringNodes.push(ring);
  }

  // spanning skeleton: every ring node has a parent in the previous
  // ring (or center). this guarantees connectivity.
  for (const n of ringNodes[0]) addEdge(b, center.id, n.id, "thread");
  for (let r = 1; r < depth; r++) {
    const inner = ringNodes[r - 1];
    const outer = ringNodes[r];
    for (let i = 0; i < outer.length; i++) {
      const t = (i / outer.length) * inner.length;
      const parent = inner[Math.floor(t) % inner.length];
      addEdge(b, parent.id, outer[i].id, "branch");
    }
  }

  // ring arcs — bowed outward so each ring reads as a curve
  for (let r = 0; r < depth; r++) {
    const ring = ringNodes[r];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const c = ring[(i + 1) % ring.length];
      addEdge(b, a.id, c.id, "arc", bowOutward(a.x, a.y, c.x, c.y, 0.025 + 0.015 * r));
    }
  }

  // sparse cross-links — every other inner node also reaches a second
  // outer neighbour to form lace's characteristic diamond mesh.
  for (let r = 0; r < depth - 1; r++) {
    const inner = ringNodes[r];
    const outer = ringNodes[r + 1];
    const ratio = outer.length / inner.length;
    for (let i = 0; i < inner.length; i++) {
      if (i % 2) continue; // intentional negative space — don't fill every cell
      const j1 = (Math.floor(i * ratio) + 1) % outer.length;
      addEdge(b, inner[i].id, outer[j1].id, "branch");
    }
  }

  // motif differentiation per family — attached, never floating
  if (family === "crochet") {
    // loop rings on every other junction of every other ring
    for (let r = 1; r < depth; r += 2) {
      for (let i = 0; i < ringNodes[r].length; i += 2) {
        attachLoopRing(b, ringNodes[r][i], 4, 0.035 + r * 0.005, depth + 1);
      }
    }
  } else if (family === "tatting") {
    for (let r = 1; r < depth; r += 1) {
      for (let i = 0; i < ringNodes[r].length; i += 3) {
        attachKnotCluster(b, ringNodes[r][i], 5, 0.028, depth + 1);
      }
    }
  } else if (family === "doily") {
    // gentle petal accents on alternate rings
    for (let r = 1; r < depth; r += 2) {
      for (let i = 1; i < ringNodes[r].length; i += 3) {
        attachPetal(b, ringNodes[r][i], depth + 1, 0.04);
      }
    }
  }

  // boundary system — scalloped edge woven into the lace itself.
  buildScallopedBoundary(b, ringNodes[depth - 1], depth + 2, rand);
  void rand;
}

function buildScallopedBoundary(b: Builder, ring: LaceNode[], depth: number, rand: () => number) {
  if (ring.length < 3) return;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const c = ring[(i + 1) % ring.length];
    // every other gap becomes a scallop bulge with a boundary node
    if (i % 2 === 0) {
      const mx = (a.x + c.x) / 2;
      const my = (a.y + c.y) / 2;
      const len = Math.hypot(mx, my) || 1;
      const out = 0.06 + rand() * 0.02;
      const bx = mx + (mx / len) * out;
      const by = my + (my / len) * out;
      const node = addNode(b, bx, by, "boundary", 0.014, depth);
      addEdge(b, a.id, node.id, "scallop", bowOutward(a.x, a.y, bx, by, 0.02));
      addEdge(b, node.id, c.id, "scallop", bowOutward(bx, by, c.x, c.y, 0.02));
    } else {
      // pointed gap: just a short arc, leaving more negative space
      addEdge(b, a.id, c.id, "scallop", bowOutward(a.x, a.y, c.x, c.y, 0.015));
    }
  }
}

// ───────────────────── branching growth (floral) ─────────────────────
function growBranching(
  b: Builder, sym: number, depth: number, rand: () => number,
) {
  const center = addNode(b, 0, 0, "center", 0.03, 0);
  const terminals: LaceNode[] = [];

  // initial stems — one per symmetry sector
  for (let s = 0; s < sym; s++) {
    const baseAngle = (s / sym) * TAU;
    growStem(b, center, baseAngle, 0, depth, rand, terminals);
  }

  // chain terminals around the perimeter so the network closes
  terminals.sort((a, c) => Math.atan2(a.y, a.x) - Math.atan2(c.y, c.x));
  for (let i = 0; i < terminals.length; i++) {
    const a = terminals[i];
    const c = terminals[(i + 1) % terminals.length];
    addEdge(b, a.id, c.id, "arc", bowOutward(a.x, a.y, c.x, c.y, 0.05));
  }
  // scalloped edge around the canopy
  buildScallopedBoundary(b, terminals, depth + 3, rand);
}

function growStem(
  b: Builder, parent: LaceNode, angle: number, level: number, maxLevel: number,
  rand: () => number, terminals: LaceNode[],
) {
  // step length shrinks with level — gives the dense interior + delicate tips look
  const step = 0.12 * (1 - level / (maxLevel + 1)) + 0.05;
  const sway = (rand() - 0.5) * 0.4;
  const a = angle + sway * 0.3;
  const nx = Math.min(0.95, Math.max(-0.95, parent.x + Math.cos(a) * step));
  const ny = Math.min(0.95, Math.max(-0.95, parent.y + Math.sin(a) * step));
  const isTerminal = level + 1 >= maxLevel || Math.hypot(nx, ny) > 0.88;
  const node = addNode(b, nx, ny, isTerminal ? "petal" : "junction",
    isTerminal ? 0.022 : 0.012, level + 1);
  addEdge(b, parent.id, node.id, "stem",
    bowOutward(parent.x, parent.y, nx, ny, 0.015));

  if (isTerminal) {
    terminals.push(node);
    // attach a small petal tip motif at the very end
    attachLoopRing(b, node, 3, 0.025, level + 2);
    return;
  }

  // leaves on alternate inner segments
  if (level > 0 && level % 2 === 0) attachLeafPair(b, node, level + 1, 0.05);

  // branching factor — taper down with depth so we don't explode
  const branches = level === 0 ? 1 : rand() < 0.55 ? 2 : 1;
  for (let i = 0; i < branches; i++) {
    const spread = branches === 1 ? 0 : (i === 0 ? -0.55 : 0.55);
    growStem(b, node, a + spread, level + 1, maxLevel, rand, terminals);
  }
}

// ───────────────────── lattice growth (bobbin / geometric) ───────────
function growLattice(
  b: Builder, family: LaceFamily, sym: number, depth: number, rand: () => number,
) {
  const center = addNode(b, 0, 0, "center", 0.022, 0);
  const layers: LaceNode[][] = [];
  for (let r = 1; r <= depth; r++) {
    const radius = (r / (depth + 0.4)) * 0.9;
    const count = sym * 2;
    const offset = r % 2 ? TAU / (count * 2) : 0;
    const layer: LaceNode[] = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * TAU + offset;
      layer.push(addNode(b, Math.cos(t) * radius, Math.sin(t) * radius, "junction", 0.01, r));
    }
    layers.push(layer);
  }

  // spokes from center to first layer
  for (const n of layers[0]) addEdge(b, center.id, n.id, "thread");
  // diagonal lattice
  for (let r = 0; r < layers.length - 1; r++) {
    const inner = layers[r];
    const outer = layers[r + 1];
    for (let i = 0; i < inner.length; i++) {
      addEdge(b, inner[i].id, outer[i].id, "thread");
      addEdge(b, inner[i].id, outer[(i + 1) % outer.length].id, "thread");
    }
  }
  // ring threads
  for (let r = 0; r < layers.length; r++) {
    const layer = layers[r];
    for (let i = 0; i < layer.length; i++) {
      addEdge(b, layer[i].id, layer[(i + 1) % layer.length].id, "thread");
    }
  }

  if (family === "bobbin") {
    // bobbin twists — small curved cross-overs every other quad add the
    // braided thread feel without ever orphaning a node.
    for (let r = 0; r < layers.length - 1; r++) {
      const inner = layers[r];
      const outer = layers[r + 1];
      for (let i = 0; i < inner.length; i += 2) {
        const a = inner[i];
        const c = outer[(i + 1) % outer.length];
        addEdge(b, a.id, c.id, "arc", bowOutward(a.x, a.y, c.x, c.y, 0.04));
      }
    }
  } else {
    // needle/geometric: small knot clusters at every other intersection
    for (let r = 1; r < layers.length; r += 2) {
      for (let i = 0; i < layers[r].length; i += 3) {
        attachKnotCluster(b, layers[r][i], 4, 0.022, depth + 1);
      }
    }
  }

  buildScallopedBoundary(b, layers[depth - 1], depth + 2, rand);
}

// ───────────────────── hybrid growth ────────────────────────────────
// rarely chosen automatically — combines a radial core with a few
// branching tendrils breaking the perimeter, for heirloom-like pieces.
function growHybrid(
  b: Builder, family: LaceFamily, sym: number, depth: number, rand: () => number,
) {
  growRadial(b, family, sym, Math.max(2, depth - 1), rand);
  // pick outermost junctions as anchors and grow short branches outward
  const outer = b.nodes.filter((n) => (n.depth ?? 0) === depth - 1 && n.kind === "junction");
  const term: LaceNode[] = [];
  for (let i = 0; i < outer.length; i += 3) {
    growStem(b, outer[i], Math.atan2(outer[i].y, outer[i].x), depth - 1, depth + 1, rand, term);
  }
}

// ───────────────────────── top-level ─────────────────────────────────
function pickFamily(rand: () => number, override?: LaceFamily): LaceFamily {
  if (override) return override;
  return FAMILIES[Math.floor(rand() * FAMILIES.length)];
}

export function generateLace(opts: LaceOptions): LaceGraph {
  const seed = hashSeed(opts.text || "weaverly");
  const rand = mulberry32(seed);

  const family = pickFamily(rand, opts.family);
  const sym = SYMS[seed % SYMS.length];
  // growth depth — denser inputs grow more rings/levels
  const depth = Math.max(2, Math.round(2 + opts.density * 5));
  const strategy: GrowthStrategy =
    // hybrid surfaces only for very dense seeds, keeps simple seeds clean
    opts.density > 0.85 && (family === "floral" || family === "doily")
      ? "hybrid"
      : STRATEGY_FOR[family];

  const b = newBuilder();
  switch (strategy) {
    case "radial":    growRadial(b, family, sym, depth, rand); break;
    case "branching": growBranching(b, sym, depth, rand); break;
    case "lattice":   growLattice(b, family, sym, depth, rand); break;
    case "hybrid":    growHybrid(b, family, sym, depth, rand); break;
  }

  // BFS-order edges so the renderer's "revealed" counter animates real
  // outward growth from the seed rather than authoring order.
  assignBuildOrderBFS(b);

  return {
    nodes: b.nodes,
    edges: b.edges,
    family,
    symmetryOrder: sym,
    rings: depth,
    seedWord: opts.text,
  };
}

// ascii "recipe" of the network — survives copy/paste, can be re-read
// as a threading order.
export function laceToAscii(g: LaceGraph): string {
  const lines: string[] = [];
  lines.push(`# lace network — ${g.family} · seed "${g.seedWord}"`);
  lines.push(`# ${g.nodes.length} nodes · ${g.edges.length} threads · ${g.symmetryOrder}-fold · depth ${g.rings}`);
  lines.push("");
  lines.push("threading order (a -> b · kind):");
  const ordered = g.edges.slice().sort((a, c) => a.buildIndex - c.buildIndex);
  for (const e of ordered) {
    lines.push(`${e.a.toString().padStart(4)} -> ${e.b.toString().padStart(4)} · ${e.kind}`);
  }
  return lines.join("\n");
}
