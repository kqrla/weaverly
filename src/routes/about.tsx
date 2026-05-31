import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "about — weaverly" },
      { name: "description", content: "weaverly is a small studio of computational fiber arts. six engines, six grammars, one quiet loom." },
      { property: "og:title", content: "about — weaverly" },
      { property: "og:description", content: "a tiny studio of digital craft simulators." },
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
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink">about the studio</p>
            <h1 className="mt-6 font-display text-5xl text-ink sm:text-6xl">
              a small studio of <span className="marker italic">computational fiber arts.</span>
            </h1>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 space-y-8 text-lg leading-relaxed text-ink/85">
        <p className="font-display text-3xl italic text-ink">
          weaverly began with a refusal. one procedural engine cannot honestly speak six craft languages
          at once. so we built six separate engines instead.
        </p>
        <p>
          the studio holds an ascii engine, a cross-stitch engine, a weaving engine, a lace engine, a
          beadwork engine, and a quilting engine. they share an input pipeline and nothing else. each
          one obeys its own structural grammar, draws from its own tradition, and produces its own kind
          of artifact.
        </p>
        <p>
          you type a word. that word is never woven literally. it becomes a seed, the seed becomes a
          pattern grammar, and the engine you chose interprets that grammar in its own native language.
          the cross-stitch engine returns a stitchable chart. the weaving engine returns a thread draft.
          the lace engine returns a connected radial network. the same seed across all six engines
          produces six unrelated artifacts, and that is the entire point.
        </p>
        <p>
          there is no feed here. no follower count. no recommendation system. no model trying to guess
          what you meant. just letters, threads, and a small loom that listens.
        </p>
        <div className="card-dashed mt-10 p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/65">made with</p>
          <p className="mt-3 font-display text-2xl italic text-ink">
            cream paper, sky-blue stripe, deep navy ink, and a deterministic prng small enough to fit in
            a pocket.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/mechanisms" className="rounded-md border border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-stripe/40">how the engines think</Link>
          <Link to="/goals" className="rounded-md border border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-stripe/40">why it exists</Link>
          <Link to="/studio" className="btn-ember">open the studio</Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
