import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "features — weaverly" },
      { name: "description", content: "every feature inside weaverly: shape recognition, glyph systems, symmetry, palette, weave playback, and quiet export." },
    ],
  }),
  component: Features,
});

const groups = [
  {
    title: "interpretation",
    items: [
      ["word → shape", "type rose, heart, moon, butterfly — weaverly recognises the word and weaves the actual shape."],
      ["herbarium of forms", "flowers, hearts, hands, creatures, weather, and quiet symbols, all kept in a small library."],
      ["procedural fallback", "unknown words become deterministic sigils, spun letter by letter."],
      ["aliases included", "love → heart. winter → snowflake. sea → wave. the loom understands gently."],
    ],
  },
  {
    title: "stitches",
    items: [
      ["ascii", "the original — dots, dashes, slashes, ampersands."],
      ["cross-stitch", "x's and crosses, like a sampler from the 1840s."],
      ["woven", "block characters, dense and tactile."],
      ["lace", "floral glyphs, airy and decorative."],
      ["beadwork", "circular tokens — solid, hollow, half-filled."],
    ],
  },
  {
    title: "motion",
    items: [
      ["loom playback", "stitches appear one by one, like a hand weaving in real time."],
      ["speed control", "from meditative single stitches to a cascading terminal rain."],
      ["pause & replay", "stop the cloth at any moment. start the weave again from the first thread."],
      ["symmetry folds", "mirror, quad, or none — fold the pattern across its own seams."],
    ],
  },
  {
    title: "export",
    items: [
      ["svg", "scalable vector textile, ready for print or embroidery transfer."],
      ["plain text", "the raw ascii — perfect for letters, readmes, or terminal art."],
      ["copy to clipboard", "one click, into any other quiet document."],
      ["printable charts", "every grid is already a stitch chart in disguise."],
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
              what the <span className="marker italic">loom can do.</span>
            </h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title} className="card-dashed p-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">collection</p>
              <h2 className="mt-1 font-display text-4xl text-ink">{g.title}</h2>
              <ul className="mt-6 divide-y divide-dashed divide-ink/40">
                {g.items.map(([name, desc]) => (
                  <li key={name} className="grid gap-1 py-4 sm:grid-cols-[150px_1fr] sm:gap-6">
                    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">{name}</span>
                    <span className="text-sm leading-relaxed text-ink/80">{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="card-dashed mt-12 flex flex-col items-start gap-4 p-10">
          <p className="font-display text-3xl italic text-ink">there is more woven in. open the studio and pull a thread.</p>
          <Link to="/studio" className="btn-ember">enter the studio →</Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
