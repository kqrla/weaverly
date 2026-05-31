import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Loom } from "@/components/loom";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "studio — weaverly" },
      { name: "description", content: "the weaverly studio. type a word, choose a stitch, and watch the loom weave a rose, heart, moon, or sigil into living textile." },
      { property: "og:title", content: "studio — weaverly" },
      { property: "og:description", content: "type a rose, see a rose." },
    ],
  }),
  component: Studio,
});

function Studio() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="bg-stripes-sm border-b border-ink">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink">studio · loom mode</p>
            <h1 className="mt-3 font-display text-5xl text-ink sm:text-6xl">the loom</h1>
          </div>
          <p className="max-w-md text-base leading-relaxed text-ink/80">
            type a word the loom knows — <span className="marker italic">rose, heart, moon, butterfly</span> — and it
            will weave the very shape, one stitch at a time. nothing is sent anywhere; the cloth lives only in this browser.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <Loom />
      </section>
      <SiteFooter />
    </div>
  );
}
