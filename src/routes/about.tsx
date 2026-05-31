import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "about — weaverly" },
      { name: "description", content: "weaverly is a quiet atelier for procedural textile. a tool for turning words into thread, stitch, and grid." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="bg-stripes border-b border-ink">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="card-dashed px-10 py-16 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink">about the atelier</p>
            <h1 className="mt-6 font-display text-5xl text-ink sm:text-6xl">
              a small loom, <span className="marker italic">kept indoors.</span>
            </h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 space-y-8 text-lg leading-relaxed text-ink/85">
        <p className="font-display text-3xl italic text-ink">
          weaverly began as a question: what if you could type the name of a thing and watch a tiny machine weave that very thing back to you?
        </p>
        <p>
          type "rose" and a rose blooms across the grid. type "heart" and a heart appears. type "moon" and a crescent rises out of the cream paper.
          weaverly keeps a small herbarium of shapes — flowers, hearts, hands, mountains, butterflies — and stitches them into cloth using
          ascii, cross-stitch, woven, lace, or beadwork glyphs.
        </p>
        <p>
          when the word isn't in the herbarium, weaverly listens to the letters and spins a procedural sigil instead — a quiet sibling pattern that
          belongs only to that string.
        </p>
        <p>
          there is no feed, no follower count, no ai trying to guess what you meant. just letters, threads, and a loom that listens.
        </p>
        <div className="card-dashed mt-10 p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/65">made with</p>
          <p className="mt-3 font-display text-2xl italic text-ink">
            cream paper, sky-blue stripe, ember-red ink, and a deterministic prng small enough to fit in a pocket.
          </p>
        </div>
        <Link to="/studio" className="btn-ember mt-4">open the studio →</Link>
      </section>
      <SiteFooter />
    </div>
  );
}
