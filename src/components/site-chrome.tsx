import { Link, useLocation } from "@tanstack/react-router";

export function SiteHeader() {
  const { pathname } = useLocation();
  const link = (to: string, label: string) => (
    <Link
      to={to}
      className={`font-mono text-[11px] uppercase tracking-[0.22em] px-3 py-1.5 transition-colors ${
        pathname === to ? "text-primary" : "text-ink/75 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-baseline gap-1">
          <span className="font-display text-3xl text-primary tracking-tight">weaverly</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">/ atelier</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {link("/", "home")}
          {link("/about", "about")}
          {link("/features", "features")}
        </nav>
        <Link to="/studio" className="btn-ember">enter studio</Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-8 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/65 sm:flex-row sm:items-center sm:justify-between">
        <span>weaverly — a small loom for digital keepsakes</span>
        <span>est. mmxxv · woven in the browser</span>
      </div>
    </footer>
  );
}

export function Marquee({ words }: { words: string[] }) {
  const row = (
    <div className="flex shrink-0 items-center gap-10 pr-10">
      {words.map((w, i) => (
        <span key={i} className="font-display text-[11vw] leading-none text-ink italic">
          {w}
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-y border-ink bg-stripes py-6">
      <div className="flex w-max animate-marquee">
        {row}
        {row}
      </div>
    </div>
  );
}
