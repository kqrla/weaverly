import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/mechanisms")({
  head: () => ({
    meta: [
      { title: "mechanisms — weaverly" },
      { name: "description", content: "how each weaverly engine thinks. the structural grammar of ascii, cross-stitch, weaving, lace, beadwork, and quilting, treated as separate disciplines." },
      { property: "og:title", content: "mechanisms — weaverly" },
      { property: "og:description", content: "six engines, six grammars, six rule systems." },
    ],
  }),
  component: Mechanisms,
});

const engines = [
  {
    name: "ascii",
    thinks: ["character streams", "terminal grids", "text density", "code aesthetics", "monospace rhythm", "character replacement", "information compression"],
    inspirations: ["ansi art", "ascii art", "terminal poetry", "bbs graphics", "code rain", "old internet aesthetics"],
    outputs: ["text compositions", "animated terminal pieces", "character mosaics", "symbolic text fields"],
    rule: "the cloth is a stream of monospace characters. density and glyph choice carry the meaning, not placement.",
  },
  {
    name: "cross-stitch",
    thinks: ["embroidery grids", "stitch occupancy", "x patterns", "sampler structures", "thread constraints", "manufacturable layouts"],
    inspirations: ["embroidery samplers", "counted cross-stitch", "folk textiles", "heritage needlework"],
    outputs: ["stitch charts", "embroidery patterns", "printable templates", "animated stitch construction"],
    rule: "every element must occupy exactly one stitch cell on a discrete aida lattice. no subpixel placement, ever.",
  },
  {
    name: "weaving",
    thinks: ["warp threads", "weft threads", "over-under relationships", "loom mechanics", "textile tension"],
    inspirations: ["jacquard weaving", "loom drafts", "woven tapestries", "textile engineering"],
    outputs: ["weaving drafts", "thread simulations", "fabric structures", "animated weaving"],
    rule: "patterns emerge from thread interactions, not from placing symbols on a canvas.",
  },
  {
    name: "lace",
    thinks: ["connected networks", "recursive growth", "radial structures", "branching systems", "decorative connectivity"],
    inspirations: ["crochet diagrams", "lacework", "tatting", "doilies", "ornamental mathematics"],
    outputs: ["lace motifs", "circular structures", "recursive decorative networks"],
    rule: "everything must remain connected. an isolated element is not lace, it is a stain.",
  },
  {
    name: "beadwork",
    thinks: ["bead occupancy", "color sequencing", "cluster formation", "jewelry structures", "strand relationships"],
    inspirations: ["indigenous beadwork", "friendship bracelets", "seed bead patterns", "jewelry design"],
    outputs: ["bead grids", "bracelet patterns", "decorative bands", "wearable layouts"],
    rule: "the pattern should feel physically stringable. if you cannot trace a strand through it, it is not beadwork.",
  },
  {
    name: "quilting",
    thinks: ["fabric blocks", "patch repetition", "geometric arrangements", "modular composition"],
    inspirations: ["quilt blocks", "patchwork", "americana textiles", "geometric fabric design"],
    outputs: ["quilt maps", "patch layouts", "fabric compositions"],
    rule: "everything must be divisible into reusable fabric blocks. composition is modular, never freehand.",
  },
];

function Mechanisms() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="bg-stripes border-b border-ink">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="card-dashed px-10 py-16 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink">mechanisms</p>
            <h1 className="mt-6 font-display text-5xl text-ink sm:text-6xl">
              how the engines <span className="marker italic">actually think.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink/75">
              every engine in weaverly is a separate discipline. they share an input pipeline and nothing
              else. this page documents how each one is structured, what it draws from, and the rule it
              cannot break.
            </p>
          </div>
        </div>
      </section>

      {/* pipeline */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="card-dashed p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/60">the shared pipeline</p>
          <h2 className="mt-3 font-display text-3xl text-ink">the seed is never woven literally.</h2>
          <div className="mt-8 grid gap-2 font-mono text-[12px] uppercase tracking-[0.18em] text-ink/85">
            <span>name</span>
            <span className="text-ink/40">↓</span>
            <span>seed extraction</span>
            <span className="text-ink/40">↓</span>
            <span>pattern grammar</span>
            <span className="text-ink/40">↓</span>
            <span>medium-specific engine</span>
            <span className="text-ink/40">↓</span>
            <span>generated artifact</span>
          </div>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink/75">
            the name you type seeds a deterministic interpretation. that interpretation is handed to the
            engine you chose, which renders it inside its own grammar. the same seed produces six
            unrelated artifacts across six engines, and that is the point.
          </p>
        </div>
      </section>

      {/* engines */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-8 lg:grid-cols-2">
          {engines.map((e) => (
            <article key={e.name} className="card-dashed p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/55">engine</p>
              <h3 className="mt-1 font-display text-4xl text-ink">{e.name}</h3>
              <p className="mt-4 font-display text-lg italic text-ink/85">{e.rule}</p>
              <dl className="mt-6 grid gap-5">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">thinks in</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink/80">{e.thinks.join(", ")}.</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">inspirations</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink/80">{e.inspirations.join(", ")}.</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">outputs</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink/80">{e.outputs.join(", ")}.</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-ink bg-stripes-sm">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="card-dashed flex flex-col items-start gap-4 p-10">
            <p className="font-display text-3xl italic text-ink">curious why any of this exists?</p>
            <Link to="/goals" className="btn-ember">read the goals</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
