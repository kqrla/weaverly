// loom — the studio surface where a word becomes textile.
// for cross-stitch we route to a dedicated engine + svg lattice renderer
// (see lib/cross-stitch + components/stitch-grid). the other modes still
// use the legacy ascii grid until their own engines land.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generate, gridToString, PALETTES, SUPPORTED_WORDS, type StyleKey } from "@/lib/weaverly";
import { generateCrossStitch, type CrossStitchChart, type BorderStyle } from "@/lib/cross-stitch";
import { generateWeave, draftToAscii, type WeaveDraft, type WeaveType } from "@/lib/weaving";
import { interpretShape } from "@/lib/shape-ai.functions";
import { StitchGrid } from "@/components/stitch-grid";
import { WeaveGrid } from "@/components/weave-grid";

type Sym = "none" | "mirror-x" | "mirror-y" | "quad";


export function Loom() {
  const [text, setText] = useState("rose");
  const [style, setStyle] = useState<StyleKey>("cross-stitch");
  const [density, setDensity] = useState(0.85);
  // cross-stitch defaults to quad symmetry — sampler charts are almost
  // always symmetric, so this matches stitcher expectations on first paint.
  const [symmetry, setSymmetry] = useState<Sym>("quad");
  const [cols, setCols] = useState(36);
  const [rows, setRows] = useState(28);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [speed, setSpeed] = useState(12);
  const [playing, setPlaying] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const [borderStyle, setBorderStyle] = useState<BorderStyle>("diamond");
  const [cellSize, setCellSize] = useState(22);
  const [showLattice, setShowLattice] = useState(true);
  const preRef = useRef<HTMLPreElement>(null);

  const isCrossStitch = style === "cross-stitch";

  // debounce the seed word for the ai call only — local generation
  // still updates instantly so the chart remains responsive while
  // the bitmap is in flight.
  const [debouncedText, setDebouncedText] = useState(text);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedText(text.trim()), 350);
    return () => clearTimeout(id);
  }, [text]);

  // legacy ascii engine — used by every non-cross-stitch mode (for now).
  const asciiResult = useMemo(
    () => generate({ text, style, density, symmetry, cols, rows, paletteIndex }),
    [text, style, density, symmetry, cols, rows, paletteIndex],
  );

  // ask the model to silhouette any word the local SHAPE catalog
  // doesn't already know. SUPPORTED_WORDS is the gate — if the word
  // is already recognised we don't burn a request.
  const callInterpret = useServerFn(interpretShape);
  const needsAi =
    isCrossStitch &&
    debouncedText.length > 0 &&
    !SUPPORTED_WORDS.includes(debouncedText) &&
    !SUPPORTED_WORDS.some((w) => debouncedText.split(/[^a-z]+/).includes(w));

  const bitmapQuery = useQuery({
    queryKey: ["shape-bitmap", debouncedText],
    queryFn: () => callInterpret({ data: { word: debouncedText } }),
    enabled: needsAi,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  // dedicated cross-stitch engine — strict lattice, motif tiling, hem.
  const chart: CrossStitchChart | null = useMemo(
    () =>
      isCrossStitch
        ? generateCrossStitch({
            text,
            cols,
            rows,
            density,
            symmetry,
            borderStyle,
            bitmap: bitmapQuery.data ?? null,
          })
        : null,
    [isCrossStitch, text, cols, rows, density, symmetry, borderStyle, bitmapQuery.data],
  );

  const shapeKey = isCrossStitch ? chart!.shapeKey : asciiResult.shapeKey;
  const chartSource = isCrossStitch ? chart!.source : null;
  const total = isCrossStitch ? cols * rows : asciiResult.grid.flat().length;

  useEffect(() => {
    setRevealed(0);
  }, [text, style, density, symmetry, cols, rows, borderStyle]);

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

  // ascii display string for non-cross-stitch modes
  const asciiDisplay = useMemo(() => {
    if (isCrossStitch) return "";
    const flat = asciiResult.grid.flat();
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
  }, [isCrossStitch, asciiResult, revealed, rows, cols]);

  const copyText = async () => {
    const content = isCrossStitch ? chartToAscii(chart!) : gridToString(asciiResult.grid);
    await navigator.clipboard.writeText(content);
  };

  const exportSvg = () => {
    if (isCrossStitch && chart) {
      const svg = chartToSvg(chart, cellSize);
      download(`weaverly-${slug(text)}.svg`, svg, "image/svg+xml");
      return;
    }
    const cell = 18;
    const w = cols * cell;
    const h = rows * cell;
    let nodes = "";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = asciiResult.grid[y][x];
        if (ch.trim()) {
          nodes += `<text x="${x * cell + cell / 2}" y="${y * cell + cell * 0.75}" text-anchor="middle" font-family="monospace" font-size="${cell * 0.9}">${escapeXml(ch)}</text>`;
        }
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="100%" height="100%" fill="oklch(0.965 0.025 85)"/><g fill="oklch(0.28 0.08 255)">${nodes}</g></svg>`;
    download(`weaverly-${slug(text)}.svg`, svg, "image/svg+xml");
  };

  const exportTxt = () =>
    download(
      `weaverly-${slug(text)}.txt`,
      isCrossStitch ? chartToAscii(chart!) : gridToString(asciiResult.grid),
      "text/plain",
    );

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
            {shapeKey ? (
              <>
                interpreted as <span className="marker font-medium">{shapeKey}</span> — stitched
                from the built-in shape library.
              </>
            ) : isCrossStitch && bitmapQuery.isFetching ? (
              <>asking the loom to silhouette <span className="font-medium">{debouncedText}</span>…</>
            ) : isCrossStitch && bitmapQuery.isError ? (
              <>couldn't interpret that word right now. weaving a sampler from the letters instead.</>
            ) : isCrossStitch && chartSource === "bitmap" ? (
              <>
                interpreted as <span className="marker font-medium">{debouncedText}</span> — silhouette
                drafted on the fly and snapped to the lattice.
              </>
            ) : (
              <>no shape match. a procedural sampler will be charted from the letters instead.</>
            )}
          </p>
        </Field>

        <Field label="engine">
          <div className="grid grid-cols-2 gap-2">
            {(["ascii", "cross-stitch", "woven", "lace", "beadwork"] as StyleKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`rounded-md border px-2 py-1.5 text-xs transition ${
                  style === s
                    ? "border-ink bg-primary text-primary-foreground"
                    : "border-ink/40 hover:bg-stripe/40"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {!isCrossStitch && (
            <p className="mt-2 text-[11px] leading-snug text-ink/55">
              only the cross-stitch engine is rebuilt so far. ascii/woven/lace/beadwork still use
              the legacy glyph grid and will be replaced with their own grammars next.
            </p>
          )}
        </Field>

        <Field label={`density · ${(density * 100).toFixed(0)}%`}>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.01}
            value={density}
            onChange={(e) => setDensity(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </Field>

        <Field label="symmetry">
          <div className="grid grid-cols-2 gap-2">
            {(["none", "mirror-x", "mirror-y", "quad"] as Sym[]).map((s) => (
              <button
                key={s}
                onClick={() => setSymmetry(s)}
                className={`rounded-md border px-2 py-1.5 text-xs transition ${
                  symmetry === s
                    ? "border-ink bg-primary text-primary-foreground"
                    : "border-ink/40 hover:bg-stripe/40"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        {isCrossStitch && (
          <>
            <Field label="hem / border">
              <div className="grid grid-cols-2 gap-2">
                {(["none", "running", "diamond", "wave", "scallop"] as BorderStyle[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBorderStyle(b)}
                    className={`rounded-md border px-2 py-1.5 text-xs transition ${
                      borderStyle === b
                        ? "border-ink bg-primary text-primary-foreground"
                        : "border-ink/40 hover:bg-stripe/40"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`cell size · ${cellSize}px`}>
              <input
                type="range"
                min={12}
                max={32}
                value={cellSize}
                onChange={(e) => setCellSize(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-ink/80">
              <input
                type="checkbox"
                checked={showLattice}
                onChange={(e) => setShowLattice(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              show aida lattice
            </label>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={`cols · ${cols}`}>
            <input
              type="range"
              min={12}
              max={64}
              value={cols}
              onChange={(e) => setCols(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
          <Field label={`rows · ${rows}`}>
            <input
              type="range"
              min={10}
              max={48}
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
          </Field>
        </div>

        <Field label={`palette · ${palette.name}`}>
          <div className="flex flex-wrap gap-2">
            {PALETTES.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setPaletteIndex(i)}
                className={`h-7 w-7 rounded-full border-2 ${i === paletteIndex ? "border-ink" : "border-ink/30"}`}
                style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.ink} 50%)` }}
                title={p.name}
              />
            ))}
          </div>
        </Field>

        <Field label={`stitch speed · ${speed}`}>
          <input
            type="range"
            min={1}
            max={80}
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value))}
            className="w-full accent-primary"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setRevealed(0);
              setPlaying(true);
            }}
            className="btn-ember"
          >
            replay stitch
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40"
          >
            {playing ? "pause" : "play"}
          </button>
          <button
            onClick={() => setRevealed(total)}
            className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40"
          >
            reveal all
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-dashed border-ink/50 pt-4">
          <button
            onClick={copyText}
            className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40"
          >
            copy chart
          </button>
          <button
            onClick={exportSvg}
            className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40"
          >
            export .svg
          </button>
          <button
            onClick={exportTxt}
            className="rounded-md border border-ink px-3 py-2 text-xs hover:bg-stripe/40"
          >
            export .txt
          </button>
        </div>
      </aside>

      <div className="space-y-4">
        <div
          className="card-dashed relative overflow-hidden"
          style={{ background: palette.bg }}
        >
          <div
            className="flex items-center justify-between border-b border-dashed border-ink/40 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: palette.ink }}
          >
            <span>loom · {style}</span>
            <span>
              {shapeKey ?? "procedural"} · {slug(text)}
            </span>
          </div>

          {isCrossStitch && chart ? (
            <div className="flex items-center justify-center overflow-auto p-6">
              <StitchGrid
                chart={chart}
                revealed={revealed}
                cellSize={cellSize}
                showLattice={showLattice}
              />
            </div>
          ) : (
            <pre
              ref={preRef}
              className="m-0 overflow-auto px-6 py-8 font-mono text-[13px] leading-[1.15] tracking-[0.05em]"
              style={{ color: palette.ink, minHeight: 540 }}
            >
              {asciiDisplay}
            </pre>
          )}
        </div>

        <div className="card-dashed p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/70">
            shortcuts the loom knows by heart
          </p>
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
            type any other word — kite, octopus, lantern, mushroom — and the loom drafts a fresh
            silhouette of that thing, then snaps it to the lattice. it never weaves the letters of
            your word, only its meaning.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-ink/80">
        {label}
      </span>
      {children}
    </label>
  );
}

// --- export helpers ---------------------------------------------------

// produce a plain-text rendering of the chart that survives copy/paste.
// each cell becomes one symbol; empties stay as spaces so the lattice
// reads as columns.
function chartToAscii(chart: CrossStitchChart): string {
  const map: Record<string, string> = {
    empty: " ",
    full: "✕",
    "half-fwd": "╱",
    "half-back": "╲",
    "back-h": "─",
    "back-v": "│",
    knot: "•",
  };
  return chart.cells
    .map((row) => row.map((c) => map[c.kind] ?? " ").join(" "))
    .join("\n");
}

// vector export — same primitives the on-screen renderer uses, so the
// exported file is byte-for-byte the same lattice.
function chartToSvg(chart: CrossStitchChart, cellSize: number): string {
  const w = chart.cols * cellSize;
  const h = chart.rows * cellSize;
  const colorVar = {
    ink: "#262532",
    ember: "#2a3a6a",
    stripe: "#7a8aa6",
  } as const;
  let lattice = "";
  for (let x = 0; x <= chart.cols; x++) {
    const major = x % 10 === 0;
    lattice += `<line x1="${x * cellSize}" y1="0" x2="${x * cellSize}" y2="${h}" stroke="${colorVar.ink}" stroke-opacity="${major ? 0.35 : 0.12}" stroke-width="${major ? 0.9 : 0.5}"/>`;
  }
  for (let y = 0; y <= chart.rows; y++) {
    const major = y % 10 === 0;
    lattice += `<line x1="0" y1="${y * cellSize}" x2="${w}" y2="${y * cellSize}" stroke="${colorVar.ink}" stroke-opacity="${major ? 0.35 : 0.12}" stroke-width="${major ? 0.9 : 0.5}"/>`;
  }
  let stitches = "";
  for (let y = 0; y < chart.rows; y++) {
    for (let x = 0; x < chart.cols; x++) {
      const cell = chart.cells[y][x];
      if (cell.kind === "empty") continue;
      const color = colorVar[cell.color];
      const pad = cellSize * 0.15;
      const x0 = x * cellSize + pad;
      const y0 = y * cellSize + pad;
      const x1 = (x + 1) * cellSize - pad;
      const y1 = (y + 1) * cellSize - pad;
      const cx = x * cellSize + cellSize / 2;
      const cy = y * cellSize + cellSize / 2;
      const sw = Math.max(1.2, cellSize * 0.13);
      switch (cell.kind) {
        case "full":
          stitches += `<g stroke="${color}" stroke-width="${sw}" stroke-linecap="round"><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/><line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y0}"/></g>`;
          break;
        case "half-fwd":
          stitches += `<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y0}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
          break;
        case "half-back":
          stitches += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
          break;
        case "back-h":
          stitches += `<line x1="${x * cellSize}" y1="${cy}" x2="${(x + 1) * cellSize}" y2="${cy}" stroke="${color}" stroke-width="${sw * 0.85}" stroke-linecap="round"/>`;
          break;
        case "back-v":
          stitches += `<line x1="${cx}" y1="${y * cellSize}" x2="${cx}" y2="${(y + 1) * cellSize}" stroke="${color}" stroke-width="${sw * 0.85}" stroke-linecap="round"/>`;
          break;
        case "knot":
          stitches += `<circle cx="${cx}" cy="${cy}" r="${Math.max(1.5, cellSize * 0.18)}" fill="${color}"/>`;
          break;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f5efe1"/>${lattice}${stitches}</svg>`;
}

function slug(t: string) {
  return (t || "untitled").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32) || "untitled";
}
function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
}
function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
