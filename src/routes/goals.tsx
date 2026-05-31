import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "goals — weaverly" },
      { name: "description", content: "why weaverly exists. a small studio of computational fiber arts, built on the belief that every medium deserves its own rule system." },
      { property: "og:title", content: "goals — weaverly" },
      { property: "og:description", content: "what the studio is trying to be, and what it is refusing to become." },
    ],
  }),
  component: Goals,
});

const aims = [
  {
    title: "treat each craft as its own discipline",
    body: "ascii, cross-stitch, weaving, lace, beadwork, and quilting are not visual styles. they are independent rule systems. the studio refuses to flatten them into a single generator with swappable glyphs.",
  },
  {
    title: "use words as seeds, not as content",
    body: "the word you type seeds a pattern grammar. it is never embroidered literally, never spelled into the cloth. the engine interprets, the cloth reflects.",
  },
  {
    title: "produce artifacts a craftsperson would recognise",
    body: "every output should read as a chart, a draft, a layout. printable, stitchable, beadable, weavable. textile tactility over procedural decoration.",
  },
  {
    title: "make a small, quiet tool",
    body: "no feed, no follower count, no recommendation system, no model trying to guess what you meant. just letters, threads, and a loom that listens.",
  },
];

const refuses = [
  ["random particle emergence", "the cloth is structured, not sprinkled."],
  ["floating glyph animation", "every element belongs to a grid, a thread, or a strand."],
  ["procedural ascii wallpaper", "ascii art is its own discipline, not a fallback for the others."],
  ["one engine, six skins", "a shared symbol pool would lie about every medium it pretended to be."],
  ["literal text rendering", "the seed becomes a pattern, never spelled letter by letter."],
];

function Goals() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="bg-stripes border-b border-ink">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="card-dashed px-10 py-16 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink">goals</p>
            <h1 className="mt-6 font-display text-5xl text-ink sm:text-6xl">
              what the studio is <span className="marker italic">trying to be.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink/75">
              weaverly is not a logo generator, not a glyph cloud, not a procedural toy. it is a tiny
              studio of computational fiber arts, with a strict view of what each medium owes its viewer.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/65">what it aims for</p>
        <h2 className="mt-3 font-display text-4xl text-ink">four commitments.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {aims.map((a, i) => (
            <div key={a.title} className="card-dashed p-8">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">no. {String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 font-display text-2xl text-ink">{a.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/80">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-ink bg-stripes-sm">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="card-dashed p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/65">what it refuses</p>
            <h2 className="mt-3 font-display text-4xl text-ink">a short list of things this is not.</h2>
            <ul className="mt-8 divide-y divide-dashed divide-ink/40">
              {refuses.map(([name, why]) => (
                <li key={name} className="grid gap-1 py-5 sm:grid-cols-[260px_1fr] sm:gap-8">
                  <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">{name}</span>
                  <span className="text-sm leading-relaxed text-ink/80">{why}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="card-dashed p-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/65">the long version</p>
          <h2 className="mt-3 font-display text-4xl text-ink">it should feel like computational fiber arts.</h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed text-ink/85">
            <p>
              the test we apply to every output is simple: would a craftsperson in that medium recognise
              this as belonging to their tradition? would a stitcher read the chart, a weaver read the
              draft, a beader read the strand?
            </p>
            <p>
              if the answer is no, the engine is wrong. if the answer is yes, the engine is allowed to
              keep growing.
            </p>
            <p>
              the studio prioritises textile tactility, grid coherence, constrained geometry, symbolic
              repetition, and woven structure. it is permitted to be quiet. it is not permitted to be
              decorative for its own sake.
            </p>
          </div>
          <Link to="/studio" className="btn-ember mt-10">open the loom</Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
