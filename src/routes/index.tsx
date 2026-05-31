import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter, Marquee } from "@/components/site-chrome";
import { useEffect, useState } from "react";
import { generate } from "@/lib/weaverly";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "weaverly — turn words into living textile pattern" },
      { name: "description", content: "weaverly is a tiny browser loom. type rose, heart, moon, mountain — and watch it bloom in ascii, cross-stitch, woven, lace, and beadwork." },
      { property: "og:title", content: "weaverly — turn words into living textiles" },
      { property: "og:description", content: "type rose, heart, moon — watch it bloom as textile." },
    ],
  }),
  component: Index,
});

function MiniGrid({ seed }: { seed: string }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => p + 1), 80);
    return () => clearInterval(id);
  }, []);
  const { grid } = generate({
    text: seed, style: "cross-stitch", density: 0.9, symmetry: "none",
    cols: 22, rows: 14, paletteIndex: 0,
  });
  const total = grid.length * grid[0].length;
  const shown = (phase * 6) % (total + 80);
  return (
    <pre className="m-0 font-mono text-[10px] leading-[1.1] text-primary">
      {grid.map((row, y) => row.map((c, x) => (y * grid[0].length + x < shown ? c : " ")).join(" ")).join("\n")}
    </pre>
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
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink">introducing</p>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
              a small browser loom for any word <br className="hidden sm:block" /> you'd like to turn into cloth:
            </h1>
            <p className="mt-8 font-display text-4xl italic sm:text-6xl">
              <span className="marker">"type a rose, see a rose."</span>
            </p>
            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-ink/75">
              weaverly listens to your word, recognises a shape — rose, heart, moon, mountain, butterfly — and weaves it,
              one stitch at a time, in ascii, cross-stitch, woven, lace, or beadwork.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/studio" className="btn-ember">enter the studio</Link>
              <Link to="/features" className="rounded-md border border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-stripe/40">
                see what it weaves →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Marquee words={["rose", "✿", "heart", "✦", "moon", "✿", "mountain", "✦", "butterfly", "✿"]} />

      {/* three cards */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { seed: "rose", title: "words become shapes", body: "type rose and a rose blooms. type heart and a heart appears. type moon and a crescent rises. weaverly interprets the word, then weaves the shape." },
            { seed: "star", title: "stitches you can choose", body: "the same shape lives differently in each stitch — ascii dots, cross-stitch x's, woven blocks, lace florals, or beaded circles. pick the cloth that fits the word." },
            { seed: "butterfly", title: "made to be kept", body: "every weave can be paused, copied as plain ascii, or exported as svg — small enough to print, embroider, or paste into a letter." },
          ].map((card) => (
            <article key={card.seed} className="card-dashed animate-fade-up p-6">
              <div className="mb-5 overflow-hidden rounded-lg border border-ink/30 bg-background p-3">
                <MiniGrid seed={card.seed} />
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
                encode small things into <span className="marker italic">living textile.</span>
              </h2>
            </div>
            <p className="text-lg leading-relaxed text-ink/80">
              weaverly is not a logo maker. it is a quiet machine for ritual objects — woven from the names of flowers,
              creatures, weather, and quiet symbols. type something small. let the loom do the rest.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
