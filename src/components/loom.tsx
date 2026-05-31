import { useEffect, useMemo, useRef, useState } from "react";
import { generate, gridToString, PALETTES, SUPPORTED_WORDS, type StyleKey } from "@/lib/weaverly";

type Sym = "none" | "mirror-x" | "mirror-y" | "quad";

export function Loom() {
  const [text, setText] = useState("rose");
  const [style, setStyle] = useState<StyleKey>("cross-stitch");
  const [density, setDensity] = useState(0.85);
  const [symmetry, setSymmetry] = useState<Sym>("none");
  const [cols, setCols] = useState(36);
  const [rows, setRows] = useState(28);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [speed, setSpeed] = useState(12);
  const [playing, setPlaying] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const preRef = useRef<HTMLPreElement>(null);

  const result = useMemo(
    () => generate({ text, style, density, symmetry, cols, rows, paletteIndex }),
    [text, style, density, symmetry, cols, rows, paletteIndex],
  );
  const { grid, shapeKey } = result;
  const flat = useMemo(() => grid.flat(), [grid]);
  const total = flat.length;

  useEffect(() => { setRevealed(0); }, [text, style, density, symmetry, cols, rows]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      setRevealed((r) => (r >= total ? r : Math.min(total, r + speed)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, speed]);

  const palette = PALETTES[paletteIndex];

  const display = useMemo(() => {
    const out: string[] = [];
    for (let y = 0; y < rows; y++) {
      const row: string[] = [];
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        row.push(i < revealed ? flat[i] : " ");
      }
      out.push(row.join(" "));
    }
    return out.join("\n");
  }, [flat, revealed, rows, cols]);

  const copyText = async () => { await navigator.clipboard.writeText(gridToString(grid)); };

  const exportSvg = () => {
    const cell = 18;
    const w = cols * cell;
    const h = rows * cell;
    let nodes = "";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = grid[y][x];
        if (ch.trim()) {
          nodes += `<text x="${x * cell + cell / 2}" y="${y * cell + cell * 0.75}" text-anchor="middle" font-family="monospace" font-size="${cell * 0.9}">${escapeXml(ch)}</text>`;
        }
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="100%" height="100%" fill="oklch(0.965 0.025 85)"/><g fill="oklch(0.66 0.19 35)">${nodes}</g></svg>`;
    download(`weaverly-${slug(text)}.svg`, svg, "image/svg+xml");
  };

  const exportTxt = () => download(`weaverly-${slug(text)}.txt`, gridToString(grid), "text/plain");

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="card-dashed space-y-6 p-6">
        <Field label="seed word">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.toLowerCase())}
            placeholder="rose, heart, star, moon…"
            className="w-full rounded-md border border-ink bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-2 text-[11px] leading-snug text-ink/65">
            {shapeKey
              ? <>interpreted as <span className="marker font-medium">{shapeKey}</span> — woven in your chosen stitch.</>
              : <>no shape match. a procedural sigil will be spun from the letters instead.</>}
          </p>
        </Field>

        <Field label="style">
          <div className="grid grid-cols-2 gap-2">
            {(["ascii", "cross-stitch", "woven", "lace", "beadwork"] as StyleKey[]).map((s) => (
              <button key={s} onClick={() => setStyle(s)}
                className={`rounded-md border px-2 py-1.5 text-xs transition ${
                  style === s ? "border-ink bg-primary text-primary-foreground" : "border-ink/40 hover:bg-stripe/40"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label={`density · ${(density * 100).toFixed(0)}%`}>
          <input type="range" min={0.2} max={1} step={0.01} value={density}
            onChange={(e) => setDensity(parseFloat(e.target.value))} className="w-full accent-primary" />
        </Field>

        <Field label="symmetry">
          <div className="grid grid-cols-2 gap-2">
            {(["none", "mirror-x", "mirror-y", "quad"] as Sym[]).map((s) => (
              <button key={s} onClick={() => setSymmetry(s)}
                className={`rounded-md border px-2 py-1.5 text-xs transition ${
                  symmetry === s ? "border-ink bg-primary text-primary-foreground" : "border-ink/40 hover:bg-stripe/40"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`cols · ${cols}`}>
            <input type="range" min={12} max={64} value={cols}
              onChange={(e) => setCols(parseInt(e.target.value))} className="w-full accent-primary" />
          </Field>
          <Field label={`rows · ${rows}`}>
            <input type="range" min={10} max={48} value={rows}
              onChange={(e) => setRows(parseInt(e.target.value))} className="w-full accent-primary" />
          </Field>
        </div>

        <Field label={`palette · ${palette.name}`}>
          <div className="flex flex-wrap gap-2">
            {PALETTES.map((p, i) => (
              <button key={p.name} onClick={() => setPaletteIndex(i)}
                className={`h-7 w-7 rounded-full border-2 ${i === paletteIndex ? "border-ink" : "border-ink/30"}`}
                style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.ink} 50%)` }}
                title={p.name}
              />
            ))}
          </div>
        </Field>

        <Field label={`weave speed · ${speed}`}>
          <input type="range" min={1} max={50} value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value))} className="w-full accent-primary" />
        </Field>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setRevealed(0); setPlaying(true); }} className="btn-ember">replay weave</button>
          <button onClick={() => setPlaying((p) => !p)} className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40">
            {playing ? "pause" : "play"}
          </button>
          <button onClick={() => setRevealed(total)} className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40">reveal all</button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-dashed border-ink/50 pt-4">
          <button onClick={copyText} className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40">copy ascii</button>
          <button onClick={exportSvg} className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40">export .svg</button>
          <button onClick={exportTxt} className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40">export .txt</button>
        </div>
      </aside>

      <div className="space-y-4">
        <div className="card-dashed relative overflow-hidden" style={{ background: palette.bg }}>
          <div className="flex items-center justify-between border-b border-dashed border-ink/40 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: palette.ink }}>
            <span>loom · {style}</span>
            <span>{shapeKey ?? "procedural"} · {slug(text)}</span>
          </div>
          <pre
            ref={preRef}
            className="m-0 overflow-auto px-6 py-8 font-mono text-[13px] leading-[1.15] tracking-[0.05em]"
            style={{ color: palette.ink, minHeight: 540 }}
          >
{display}
          </pre>
        </div>

        <div className="card-dashed p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/70">words the loom knows</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUPPORTED_WORDS.map((w) => (
              <button
                key={w}
                onClick={() => setText(w)}
                className="rounded-full border border-ink/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider hover:border-ink hover:bg-primary hover:text-primary-foreground"
              >
                {w}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/65">
            type anything else and weaverly will fall back to a procedural sigil seeded by your letters.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-ink/80">{label}</span>
      {children}
    </label>
  );
}

function slug(t: string) { return (t || "untitled").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32) || "untitled"; }
function escapeXml(s: string) { return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!)); }
function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
