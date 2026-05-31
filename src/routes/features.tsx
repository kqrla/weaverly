import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "features — weaverly" },
      { name: "description", content: "the architecture of weaverly. six dedicated craft engines, a shared seed pipeline, and the export grammar that ties them together." },
      { property: "og:title", content: "features — weaverly" },
      { property: "og:description", content: "six engines, one studio, zero shared symbol pools." },
    ],
  }),
  component: Features,
});

const principle = {
  title: "core architecture principle",
  body: "each pattern family is powered by its own generation engine. styles are not skins. styles are different rule systems. the studio treats each medium as its own craft discipline with unique constraints, grammars, structures, and behaviors. there is no single procedural engine swapping symbols underneath.",
};

const engines = [
  {
    name: "ascii engine",
    state: "legacy grid in place. dedicated terminal engine queued.",
    bullets: ["character streams and monospace rhythm", "terminal grids and code aesthetics", "ansi, bbs, code-rain lineage", "outputs as text compositions and animated terminal pieces"],
  },
  {
    name: "cross-stitch engine",
    state: "built. shipping today.",
    bullets: ["discrete aida lattice, integer cell coordinates", "stitch primitives: full, half, backstitch, french knot", "borders, motif tiling, shape rasterisation, ai silhouettes", "outputs as printable charts and animated stitch construction"],
  },
  {
    name: "weaving engine",
    state: "queued.",
    bullets: ["warp and weft as first-class structures", "over-under interaction, not symbol placement", "jacquard and loom-draft lineage", "outputs as weaving drafts and fabric simulations"],
  },
  {
    name: "lace engine",
    state: "queued.",
    bullets: ["connected networks, recursive growth, radial branching", "everything must remain connected", "crochet, tatting, doily lineage", "outputs as lace motifs and recursive decorative networks"],
  },
  {
    name: "beadwork engine",
    state: "queued.",
    bullets: ["bead occupancy and color sequencing", "patterns must feel physically stringable", "indigenous beadwork and friendship-bracelet lineage", "outputs as bead grids, bracelets, wearable bands"],
  },
  {
    name: "quilting engine",
    state: "queued.",
    bullets: ["fabric blocks, patch repetition, modular composition", "everything divisible into reusable blocks", "americana quilt-block lineage", "outputs as quilt maps and patch layouts"],
  },
];

const groups = [
  {
    title: "shared pipeline",
    items: [
      ["seed extraction", "the typed word becomes a deterministic seed, never spelled literally into the cloth."],
      ["pattern grammar", "the seed is converted into structural parameters the chosen engine can interpret."],
      ["engine dispatch", "the active engine receives the grammar and renders it in its own native language."],
      ["artifact emission", "the engine returns a craft-shaped object, not a generic raster."],
    ],
  },
  {
    title: "studio controls",
    items: [
      ["engine switcher", "swap between the six craft engines. the seed stays, the language changes completely."],
      ["density and symmetry", "global knobs that every engine respects in its own way."],
      ["loom playback", "watch the artifact construct itself in the order a craftsperson would build it."],
      ["pause, replay, reveal all", "interrupt the construction at any cell, thread, bead, or block."],
    ],
  },
  {
    title: "export grammar",
    items: [
      ["svg charts", "vector output suitable for print, embroidery transfer, or weaving notation."],
      ["plain text", "engine-aware text rendering that survives copy and paste."],
      ["copy to clipboard", "one click into any other quiet document."],
      ["printable layouts", "every artifact is already a real chart in disguise."],
    ],
  },
];

function Features() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="bg-stripes border-b border-ink">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="card-dashed px-10 py-16 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink">features</p>
            <h1 className="mt-6 font-display text-5xl text-ink sm:text-6xl">
              what the <span className="marker italic">studio is made of.</span>
            </h1>
          </div>
        </div>
      </section>

      {/* core principle */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="card-dashed p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/60">{principle.title}</p>
          <p className="mt-4 font-display text-3xl leading-snug text-ink">
            styles are not skins. styles are rule systems.
          </p>
          <p className="mt-5 text-base leading-relaxed text-ink/80">{principle.body}</p>
        </div>
      </section>

      {/* engines roster */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/65">the engines</p>
          <h2 className="mt-3 font-display text-4xl text-ink">six disciplines, six engines.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {engines.map((e) => (
            <article key={e.name} className="card-dashed p-7">
              <h3 className="font-display text-2xl text-ink">{e.name}</h3>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-primary">{e.state}</p>
              <ul className="mt-5 space-y-2 text-sm leading-relaxed text-ink/80">
                {e.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-ink/60" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* groups */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-8 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title} className="card-dashed p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">collection</p>
              <h2 className="mt-1 font-display text-4xl text-ink">{g.title}</h2>
              <ul className="mt-6 divide-y divide-dashed divide-ink/40">
                {g.items.map(([name, desc]) => (
                  <li key={name} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">{name}</span>
                    <span className="text-sm leading-relaxed text-ink/80">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="card-dashed mt-12 flex flex-col items-start gap-4 p-10">
          <p className="font-display text-3xl italic text-ink">enough reading. open the loom and pull a thread.</p>
          <Link to="/studio" className="btn-ember">enter the studio</Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
