import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, Marquee } from "@/components/site-chrome";
import { StitchGrid } from "@/components/stitch-grid";
import { generateCrossStitch } from "@/lib/cross-stitch";
import { useMemo } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "weaverly — a studio of computational fiber arts" },
      {
        name: "description",
        content:
          "weaverly is a small browser studio of digital craft simulators. each medium — ascii, cross-stitch, weaving, lace, beadwork, quilting — has its own generation engine and its own grammar.",
      },
      { property: "og:title", content: "weaverly — computational fiber arts" },
      { property: "og:description", content: "a tiny studio of digital craft simulators. words as seeds, threads as language." },
    ],
  }),
  component: Index,
});

// static cross-stitched preview, no animation. the landing should show
// finished cloth, not a typing cursor.
function StaticStitch({ seed, cols = 22, rows = 16 }: { seed: string; cols?: number; rows?: number }) {
  const chart = useMemo(
    () =>
      generateCrossStitch({
        text: seed,
        cols,
        rows,
        density: 0.85,
        symmetry: "quad",
        borderStyle: "diamond",
      }),
    [seed, cols, rows],
  );
  const total = cols * rows;
  return (
    <StitchGrid chart={chart} revealed={total} cellSize={11} showLattice={true} />
  );
}

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* hero */}
      <section className="bg-stripes border-b border-ink">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <div className="card-dashed px-8 py-14 sm:px-16 sm:py-20 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink">a studio, not a generator</p>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
              a small collection of <br className="hidden sm:block" /> digital craft simulators.
            </h1>
            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-ink/75">
              weaverly is not one engine wearing six skins. it is six separate craft engines, each with its own
              grammar. type a word and the chosen medium weaves its own answer in its own language.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/studio" className="btn-ember">enter the studio</Link>
              <Link
                to="/mechanisms"
                className="rounded-md border border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-stripe/40"
              >
                see how the engines think
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Marquee words={["ascii", "cross-stitch", "weaving", "lace", "beadwork", "quilting", "ascii", "cross-stitch", "weaving", "lace"]} />

      {/* three cards — static cross-stitched previews */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              seed: "rose",
              title: "a seed, not a string",
              body: "the word you type is never woven literally. it becomes a seed that the chosen engine interprets in its own native grammar.",
            },
            {
              seed: "heart",
              title: "six distinct grammars",
              body: "ascii thinks in character streams. cross-stitch in lattice cells. weaving in warp and weft. lace in connected networks. beadwork in stringable clusters. quilting in fabric blocks.",
            },
            {
              seed: "moon",
              title: "made to be kept",
              body: "every artifact can be paused mid-stitch, copied as text, exported as svg, and read as a real chart. small enough to print, embroider, or fold into a letter.",
            },
          ].map((card) => (
            <article key={card.seed} className="card-dashed p-6">
              <div className="mb-5 flex justify-center overflow-hidden rounded-lg border border-ink/30 bg-background p-3">
                <StaticStitch seed={card.seed} />
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">no. {card.seed}</p>
              <h3 className="mt-2 font-display text-3xl text-ink">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/75">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* premise */}
      <section className="border-y border-ink bg-stripes-sm">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <div className="card-dashed grid gap-10 p-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink">the premise</p>
              <h2 className="mt-4 font-display text-5xl text-ink">
                styles are not skins. styles are <span className="marker italic">rule systems.</span>
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-ink/80">
              a single procedural engine swapping symbols would lie about every medium it touched. weaverly
              instead treats each craft as its own discipline, with its own constraints, its own structural
              logic, and its own way of growing across the cloth.
            </p>
          </div>
        </div>
      </section>

      {/* engines roster */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/65">the engines</p>
          <h2 className="mt-3 font-display text-5xl text-ink">six disciplines, one studio.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "ascii", thinks: "character streams, terminal grids, monospace rhythm", rule: "compression through symbol density" },
            { name: "cross-stitch", thinks: "embroidery lattice, stitch occupancy, sampler structure", rule: "every element occupies a stitch cell" },
            { name: "weaving", thinks: "warp threads, weft threads, over-under tension", rule: "patterns emerge from thread interaction" },
            { name: "lace", thinks: "connected networks, recursive growth, radial branching", rule: "everything must remain connected" },
            { name: "beadwork", thinks: "bead occupancy, color sequencing, cluster formation", rule: "patterns must feel physically stringable" },
            { name: "quilting", thinks: "fabric blocks, patch repetition, modular composition", rule: "everything must divide into reusable blocks" },
          ].map((e) => (
            <div key={e.name} className="card-dashed p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/55">engine</p>
              <h3 className="mt-1 font-display text-3xl text-ink">{e.name}</h3>
              <p className="mt-4 text-sm leading-relaxed text-ink/80">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink/55">thinks in: </span>
                {e.thinks}.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink/80">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink/55">rule: </span>
                {e.rule}.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* same seed, different cloth */}
      <section className="border-y border-ink bg-stripes-sm">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-10 max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/65">same seed, different cloth</p>
            <h2 className="mt-3 font-display text-5xl text-ink">
              the word <span className="marker italic">rose</span> is six different things.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink/75">
              feed the same seed into every engine and you get six unrelated artifacts. each one is
              correct, in its own grammar, for its own medium. none of them are translations of the other.
            </p>
          </div>
          <div className="card-dashed grid gap-0 divide-y divide-dashed divide-ink/40 p-0 md:grid-cols-2 md:divide-x md:divide-y-0">
            {[
              ["ascii engine", "terminal glyph constellation"],
              ["cross-stitch engine", "embroidered sampler chart"],
              ["weaving engine", "woven textile draft"],
              ["lace engine", "radial ornamental network"],
              ["beadwork engine", "stringable bracelet pattern"],
              ["quilting engine", "patchwork block layout"],
            ].map(([label, output]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] items-baseline gap-6 px-8 py-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">{label}</span>
                <span className="font-display text-xl italic text-ink">{output}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* call to read more */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="card-dashed flex flex-col gap-6 p-12 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/65">keep reading</p>
            <h2 className="mt-3 font-display text-4xl text-ink">there is more woven in.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink/75">
              the mechanisms page explains how each engine thinks. the goals page explains why the studio
              exists in the first place. or skip both and open the loom.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/mechanisms" className="rounded-md border border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-stripe/40">mechanisms</Link>
            <Link to="/goals" className="rounded-md border border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-stripe/40">goals</Link>
            <Link to="/studio" className="btn-ember">open the studio</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
