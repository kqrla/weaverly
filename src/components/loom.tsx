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
import { generateLace, laceToAscii, type LaceGraph, type LaceFamily } from "@/lib/lace";
import { generateBeadwork, beadworkToAscii, type BeadworkArtifact, type BeadFamily } from "@/lib/beadwork";
import {
  generateAscii,
  asciiToText,
  routeFamily as routeAsciiFamily,
  type AsciiArtifact,
  type AsciiFamily,
  type CharsetKey as AsciiCharset,
} from "@/lib/ascii";
import { interpretShape } from "@/lib/shape-ai.functions";
import { interpretSeed, type SemanticReading } from "@/lib/semantic.functions";
import { StitchGrid } from "@/components/stitch-grid";
import { WeaveGrid } from "@/components/weave-grid";
import { LaceCanvas } from "@/components/lace-canvas";
import { BeadCanvas } from "@/components/bead-canvas";
import { AsciiCanvas } from "@/components/ascii-canvas";

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
  const [weaveType, setWeaveType] = useState<WeaveType | "auto">("auto");
  const [showLoomGrid, setShowLoomGrid] = useState(false);
  const [laceFamily, setLaceFamily] = useState<LaceFamily | "auto">("auto");
  const [laceSize, setLaceSize] = useState(560);
  const [showLaceNodes, setShowLaceNodes] = useState(true);
  const [beadFamily, setBeadFamily] = useState<BeadFamily | "auto">("auto");
  const [beadSize, setBeadSizeState] = useState(640);
  const [showCords, setShowCords] = useState(true);
  const [asciiFamily, setAsciiFamily] = useState<AsciiFamily | "auto">("auto");
  const [asciiCharset, setAsciiCharset] = useState<AsciiCharset>("standard");
  const [asciiFontSize, setAsciiFontSize] = useState(16);
  const [showAsciiGrid, setShowAsciiGrid] = useState(false);
  const [customRamp, setCustomRamp] = useState(". : + * # @");
  const preRef = useRef<HTMLPreElement>(null);

  const isAscii = style === "ascii";
  const isCrossStitch = style === "cross-stitch";
  const isWoven = style === "woven";
  const isLace = style === "lace";
  const isBeadwork = style === "beadwork";



  // debounce the seed word for the ai call only — local generation
  // still updates instantly so the chart remains responsive while
  // the bitmap is in flight.
  const [debouncedText, setDebouncedText] = useState(text);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedText(text.trim()), 350);
    return () => clearTimeout(id);
  }, [text]);

  // legacy ascii engine — also routed through the semantic seed below,
  // so typing "ocean" weaves wave-density glyphs instead of o-c-e-a-n.
  const asciiResult = useMemo(
    () => generate({ text: text, style, density, symmetry, cols, rows, paletteIndex }),
    [text, style, density, symmetry, cols, rows, paletteIndex],
  );

  // semantic interpreter — classifies the input before any engine
  // touches it. concepts get *meaning-driven* seeds; proper names
  // keep their literal letters so identity stays personal.
  const callInterpretSeed = useServerFn(interpretSeed);
  const semanticQuery = useQuery<SemanticReading>({
    queryKey: ["semantic", debouncedText],
    queryFn: () => callInterpretSeed({ data: { word: debouncedText } }),
    enabled: debouncedText.length > 0,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
  const semantic = semanticQuery.data ?? null;

  // the seed every engine actually generates from. for a concept
  // ("rose garden" → rose) we substitute the concept noun so the
  // textile is driven by meaning rather than spelling. for a proper
  // name we keep the literal input intact.
  const engineSeed = useMemo(() => {
    if (semantic?.kind === "concept" && semantic.concept) return semantic.concept;
    return text;
  }, [semantic, text]);

  // which word, if any, the cross-stitch silhouette engine should
  // draw. proper names skip the bitmap call entirely and fall back
  // to the procedural sampler so the chart still feels personal.
  const bitmapWord = useMemo(() => {
    if (!semantic) return debouncedText;
    if (semantic.kind === "proper-name") return "";
    return semantic.hints.crossStitchSubject || semantic.concept || debouncedText;
  }, [semantic, debouncedText]);

  // ask the model to silhouette the *concept* (rose, lightning bolt,
  // book) instead of the literal input. we still cache by word so
  // repeated entries don't re-burn requests.
  const callInterpret = useServerFn(interpretShape);
  const needsAi = isCrossStitch && bitmapWord.length > 0;

  const bitmapQuery = useQuery({
    queryKey: ["shape-bitmap", bitmapWord],
    queryFn: () => callInterpret({ data: { word: bitmapWord } }),
    enabled: needsAi,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  // dedicated cross-stitch engine — strict lattice, motif tiling, hem.
  const chart: CrossStitchChart | null = useMemo(
    () =>
      isCrossStitch
        ? generateCrossStitch({
            text: engineSeed,
            cols,
            rows,
            density,
            symmetry,
            borderStyle,
            bitmap: bitmapQuery.data ?? null,
          })
        : null,
    [isCrossStitch, engineSeed, cols, rows, density, symmetry, borderStyle, bitmapQuery.data],
  );

  // dedicated weaving engine — loom draft + warp/weft simulation.
  // when the user leaves the structure on "auto" we use the semantic
  // hint (e.g. storm → twill, water → satin, mountains → diamond).
  const draft: WeaveDraft | null = useMemo(
    () =>
      isWoven
        ? generateWeave({
            text: engineSeed,
            cols,
            rows,
            density,
            symmetry,
            weave:
              weaveType === "auto"
                ? (semantic?.hints.weave ?? undefined)
                : weaveType,
          })
        : null,
    [isWoven, engineSeed, cols, rows, density, symmetry, weaveType, semantic],
  );

  // dedicated lace engine — connected network of loops/knots/threads.
  // same auto-routing: a "rose" grows as floral lace, a "snowflake"
  // as a doily, a "cathedral" as bobbin.
  const lace: LaceGraph | null = useMemo(
    () =>
      isLace
        ? generateLace({
            text: engineSeed,
            density,
            symmetry,
            family:
              laceFamily === "auto"
                ? (semantic?.hints.lace ?? undefined)
                : laceFamily,
          })
        : null,
    [isLace, engineSeed, density, symmetry, laceFamily, semantic],
  );

  // dedicated beadwork engine — physical bead assembly with strands.
  // auto-routes by motif: rose → rosette, snowflake → medallion,
  // forest → freeform, mesh/web → netted, etc.
  const beadwork: BeadworkArtifact | null = useMemo(
    () =>
      isBeadwork
        ? generateBeadwork({
            text: engineSeed,
            density,
            family: beadFamily === "auto" ? undefined : beadFamily,
            motifs: semantic?.motifs ?? [],
          })
        : null,
    [isBeadwork, engineSeed, density, beadFamily, semantic],
  );

  // dedicated pixel ascii engine — strict monospace grid, density ramps,
  // semantic family routing (proper names → monogram; storm → ansi;
  // forest/library → pixel-glyph; calm/abstract → poetry).
  const resolvedAsciiFamily: AsciiFamily = useMemo(() => {
    if (asciiFamily !== "auto") return asciiFamily;
    if (!semantic) return "classic";
    return routeAsciiFamily({
      kind: semantic.kind,
      motifs: semantic.motifs,
      concept: semantic.concept,
    });
  }, [asciiFamily, semantic]);

  const ascii: AsciiArtifact | null = useMemo(
    () =>
      isAscii
        ? generateAscii({
            text: engineSeed,
            family: resolvedAsciiFamily,
            charset: asciiCharset,
            customRamp:
              asciiCharset === "custom"
                ? customRamp.split(/\s+/).filter(Boolean)
                : undefined,
            cols,
            rows,
            density,
            motifs: semantic?.motifs ?? [],
            concept: semantic?.concept ?? null,
          })
        : null,
    [isAscii, engineSeed, resolvedAsciiFamily, asciiCharset, customRamp, cols, rows, density, semantic],
  );

  const shapeKey = isCrossStitch ? chart!.shapeKey : null;
  const chartSource = isCrossStitch ? chart!.source : null;
  const total = isCrossStitch || isWoven
    ? cols * rows
    : isLace
      ? (lace?.edges.length ?? 0)
      : isBeadwork
        ? (beadwork?.beads.length ?? 0)
        : isAscii
          ? (ascii?.order.length ?? cols * rows)
          : asciiResult.grid.flat().length;

  useEffect(() => {
    setRevealed(0);
  }, [text, style, density, symmetry, cols, rows, borderStyle, weaveType, laceFamily, beadFamily, asciiFamily, asciiCharset]);


  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const step = isLace || isBeadwork ? Math.max(1, Math.round(speed / 4)) : speed;
      setRevealed((r) => (r >= total ? r : Math.min(total, r + step)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, speed, isLace, isBeadwork]);

  const palette = PALETTES[paletteIndex];

  // legacy ascii display only kicks in when the new pixel ascii engine
  // hasn't produced an artifact yet — otherwise the dedicated engine
  // owns the surface and the AsciiCanvas does its own reveal masking.
  const asciiDisplay = useMemo(() => {
    if (isCrossStitch || isWoven || isLace || isBeadwork || isAscii) return "";
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
  }, [isCrossStitch, isWoven, isLace, isBeadwork, isAscii, asciiResult, revealed, rows, cols]);

  const copyText = async () => {
    const content = isCrossStitch
      ? chartToAscii(chart!)
      : isWoven
        ? draftToAscii(draft!)
        : isLace
          ? laceToAscii(lace!)
          : isBeadwork
            ? beadworkToAscii(beadwork!)
            : isAscii && ascii
              ? asciiToText(ascii)
              : gridToString(asciiResult.grid);
    await navigator.clipboard.writeText(content);
  };

  const exportSvg = () => {
    if (isCrossStitch && chart) {
      const svg = chartToSvg(chart, cellSize);
      download(`weaverly-${slug(text)}.svg`, svg, "image/svg+xml");
      return;
    }
    if (isWoven && draft) {
      const svg = weaveToSvg(draft, cellSize);
      download(`weaverly-${slug(text)}.svg`, svg, "image/svg+xml");
      return;
    }
    if (isLace && lace) {
      const svg = laceToSvg(lace, laceSize);
      download(`weaverly-${slug(text)}.svg`, svg, "image/svg+xml");
      return;
    }
    if (isBeadwork && beadwork) {
      const svg = beadworkToSvg(beadwork);
      download(`weaverly-${slug(text)}.svg`, svg, "image/svg+xml");
      return;
    }
    if (isAscii && ascii) {
      const svg = asciiToSvg(ascii, asciiFontSize);
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
      isCrossStitch
        ? chartToAscii(chart!)
        : isWoven
          ? draftToAscii(draft!)
          : isLace
            ? laceToAscii(lace!)
            : isBeadwork
              ? beadworkToAscii(beadwork!)
              : isAscii && ascii
                ? asciiToText(ascii)
                : gridToString(asciiResult.grid),
      "text/plain",
    );



  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="card-dashed space-y-6 p-6">
        <Field label="seed word">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.toLowerCase())}
            placeholder="rose, ocean, storm, alice…"
            className="w-full rounded-md border border-ink bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 space-y-2 text-[11px] leading-snug text-ink/70">
            {semanticQuery.isFetching && !semantic ? (
              <p>reading <span className="font-mono">{debouncedText}</span>…</p>
            ) : semantic ? (
              <>
                <p>
                  read as{" "}
                  <span className="marker font-medium">
                    {semantic.kind === "proper-name"
                      ? "a name"
                      : semantic.kind === "ambiguous"
                        ? "ambiguous"
                        : (semantic.concept ?? "concept")}
                  </span>
                  {semantic.kind !== "proper-name" && semantic.concept ? (
                    <> — woven from its meaning, not its letters.</>
                  ) : semantic.kind === "proper-name" ? (
                    <> — kept as a personal seed; the letters drive the pattern.</>
                  ) : null}
                </p>
                {semantic.motifs.length > 0 && (
                  <p className="text-ink/55">
                    motifs:{" "}
                    {semantic.motifs.map((m, i) => (
                      <span key={m}>
                        <span className="font-mono">{m}</span>
                        {i < semantic.motifs.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                )}
                {semantic.alternates.length > 0 && (
                  <div>
                    <span className="text-ink/55">or read as:</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {semantic.alternates.map((alt) => (
                        <button
                          key={alt.label}
                          onClick={() => setText((alt.concept || alt.label).toLowerCase())}
                          className="rounded-full border border-ink/30 px-2 py-0.5 font-mono text-[10px] hover:border-ink hover:bg-stripe/40"
                        >
                          {alt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {isCrossStitch && bitmapQuery.isFetching && (
                  <p className="text-ink/55">silhouetting <span className="font-mono">{bitmapWord}</span>…</p>
                )}
                {isCrossStitch && chartSource === "bitmap" && !bitmapQuery.isFetching && (
                  <p className="text-ink/55">silhouette of <span className="font-mono">{bitmapWord}</span> snapped to the lattice.</p>
                )}
                {isCrossStitch && shapeKey && (
                  <p className="text-ink/55">stitched from the built-in <span className="font-mono">{shapeKey}</span> motif.</p>
                )}
              </>
            ) : (
              <p>type any word — common nouns become motifs, names become personal seeds.</p>
            )}
          </div>
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
          {!isCrossStitch && !isWoven && !isLace && !isBeadwork && (
            <p className="mt-2 text-[11px] leading-snug text-ink/55">
              ascii still uses the legacy glyph grid. cross-stitch, weaving, lace,
              and beadwork each run on their own dedicated craft engine.
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

        {isWoven && (
          <>
            <Field label="weave structure">
              <div className="grid grid-cols-2 gap-2">
                {(["auto", "plain", "twill", "basket", "satin", "herringbone", "diamond", "jacquard"] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeaveType(w)}
                    className={`rounded-md border px-2 py-1.5 text-xs transition ${
                      weaveType === w
                        ? "border-ink bg-primary text-primary-foreground"
                        : "border-ink/40 hover:bg-stripe/40"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              {draft && (
                <p className="mt-2 text-[11px] leading-snug text-ink/65">
                  loom drafted on <span className="marker font-medium">{draft.shafts}</span> shafts ·
                  weave <span className="marker font-medium">{draft.weave}</span> · seed
                  {" "}<span className="font-mono">{draft.seedWord}</span>
                </p>
              )}
            </Field>
            <Field label={`thread size · ${cellSize}px`}>
              <input
                type="range"
                min={6}
                max={28}
                value={cellSize}
                onChange={(e) => setCellSize(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-ink/80">
              <input
                type="checkbox"
                checked={showLoomGrid}
                onChange={(e) => setShowLoomGrid(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              show loom draft grid
            </label>
          </>
        )}

        {isLace && (
          <>
            <Field label="lace family">
              <div className="grid grid-cols-2 gap-2">
                {(["auto", "doily", "crochet", "tatting", "bobbin", "floral", "geometric"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setLaceFamily(f)}
                    className={`rounded-md border px-2 py-1.5 text-xs transition ${
                      laceFamily === f
                        ? "border-ink bg-primary text-primary-foreground"
                        : "border-ink/40 hover:bg-stripe/40"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {lace && (
                <p className="mt-2 text-[11px] leading-snug text-ink/65">
                  grown as <span className="marker font-medium">{lace.family}</span> ·
                  {" "}<span className="marker font-medium">{lace.symmetryOrder}</span>-fold ·
                  {" "}{lace.rings} rings · {lace.nodes.length} nodes ·
                  {" "}{lace.edges.length} threads
                </p>
              )}
            </Field>
            <Field label={`canvas size · ${laceSize}px`}>
              <input
                type="range"
                min={360}
                max={760}
                step={20}
                value={laceSize}
                onChange={(e) => setLaceSize(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-ink/80">
              <input
                type="checkbox"
                checked={showLaceNodes}
                onChange={(e) => setShowLaceNodes(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              show loops &amp; knots
            </label>
          </>
        )}

        {isBeadwork && (
          <>
            <Field label="bead grammar">
              <div className="grid grid-cols-2 gap-2">
                {(["auto", "bracelet", "loom", "fringe", "medallion", "rosette", "netted", "freeform"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setBeadFamily(f)}
                    className={`rounded-md border px-2 py-1.5 text-xs transition ${
                      beadFamily === f
                        ? "border-ink bg-primary text-primary-foreground"
                        : "border-ink/40 hover:bg-stripe/40"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {beadwork && (
                <p className="mt-2 text-[11px] leading-snug text-ink/65">
                  strung as <span className="marker font-medium">{beadwork.family}</span> ·
                  {" "}{beadwork.strands.length} strand{beadwork.strands.length === 1 ? "" : "s"} ·
                  {" "}{beadwork.beads.length} beads
                </p>
              )}
            </Field>
            <Field label={`canvas size · ${beadSize}px`}>
              <input
                type="range"
                min={420}
                max={820}
                step={20}
                value={beadSize}
                onChange={(e) => setBeadSizeState(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-ink/80">
              <input
                type="checkbox"
                checked={showCords}
                onChange={(e) => setShowCords(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              show threading cords
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
          ) : isWoven && draft ? (
            <div className="flex items-center justify-center overflow-auto p-6">
              <WeaveGrid
                draft={draft}
                revealed={revealed}
                cellSize={cellSize}
                showLoomGrid={showLoomGrid}
              />
            </div>
          ) : isLace && lace ? (

            <div className="flex items-center justify-center overflow-auto p-6">
              <LaceCanvas
                graph={lace}
                revealed={revealed}
                size={laceSize}
                showNodes={showLaceNodes}
              />
            </div>

          ) : isBeadwork && beadwork ? (
            <div className="flex items-center justify-center overflow-auto p-6">
              <BeadCanvas
                artifact={beadwork}
                revealed={revealed}
                size={beadSize}
                showCords={showCords}
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

// vector export of a woven cloth — mirrors WeaveGrid's rendering rules
// so the file matches what the user sees on screen.
function weaveToSvg(draft: WeaveDraft, cellSize: number): string {
  const w = draft.cols * cellSize;
  const h = draft.rows * cellSize;
  const colorVar: Record<string, string> = {
    ink: "#262532",
    ember: "#2a3a6a",
    stripe: "#7a8aa6",
    background: "#f5efe1",
    accent: "#e6c14a",
  };
  let warpBg = "";
  for (let x = 0; x < draft.cols; x++) {
    const c = draft.warpColors[x];
    warpBg += `<line x1="${x * cellSize + cellSize / 2}" y1="0" x2="${x * cellSize + cellSize / 2}" y2="${h}" stroke="${colorVar[c.token]}" stroke-opacity="0.18" stroke-width="${Math.max(0.6, cellSize * 0.08)}"/>`;
  }
  const inset = Math.max(0.5, cellSize * 0.04);
  let threads = "";
  for (let y = 0; y < draft.rows; y++) {
    for (let x = 0; x < draft.cols; x++) {
      const role = draft.cell[y][x];
      if (role === "warp") {
        const c = draft.warpColors[x];
        const tw = cellSize * (0.55 + c.weight * 0.35);
        threads += `<rect x="${x * cellSize + (cellSize - tw) / 2}" y="${y * cellSize - inset}" width="${tw}" height="${cellSize + inset * 2}" rx="${tw * 0.25}" fill="${colorVar[c.token]}"/>`;
      } else {
        const c = draft.weftColors[y];
        const tw = cellSize * (0.55 + c.weight * 0.35);
        threads += `<rect x="${x * cellSize - inset}" y="${y * cellSize + (cellSize - tw) / 2}" width="${cellSize + inset * 2}" height="${tw}" rx="${tw * 0.25}" fill="${colorVar[c.token]}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f0e9d8"/>${warpBg}${threads}</svg>`;
}

// vector export of the lace network — mirrors LaceCanvas exactly so the
// downloaded file is byte-equivalent to what's drawn on screen.
function laceToSvg(g: LaceGraph, size: number): string {
  const margin = 30;
  const inner = size - margin * 2;
  const ink = "#262532";
  const ember = "#2a3a6a";
  const stripe = "#a8b0c2";
  const to = (n: { x: number; y: number; radius: number }) => ({
    x: margin + ((n.x + 1) / 2) * inner,
    y: margin + ((n.y + 1) / 2) * inner,
    r: n.radius * inner,
  });
  const nodesById = new Map(g.nodes.map((n) => [n.id, n]));
  let threads = "";
  for (const e of g.edges) {
    const a = nodesById.get(e.a);
    const c = nodesById.get(e.b);
    if (!a || !c) continue;
    const A = to(a);
    const C = to(c);
    if (e.c1 && e.c2) {
      const C1 = { x: margin + ((e.c1.x + 1) / 2) * inner, y: margin + ((e.c1.y + 1) / 2) * inner };
      const C2 = { x: margin + ((e.c2.x + 1) / 2) * inner, y: margin + ((e.c2.y + 1) / 2) * inner };
      threads += `<path d="M${A.x},${A.y} C${C1.x},${C1.y} ${C2.x},${C2.y} ${C.x},${C.y}" fill="none" stroke="${ink}" stroke-opacity="0.8" stroke-width="1.1" stroke-linecap="round"/>`;
    } else {
      threads += `<line x1="${A.x}" y1="${A.y}" x2="${C.x}" y2="${C.y}" stroke="${ink}" stroke-opacity="0.8" stroke-width="1.1" stroke-linecap="round"/>`;
    }
  }
  let nodes = "";
  for (const n of g.nodes) {
    const N = to(n);
    if (n.kind === "loop") {
      nodes += `<circle cx="${N.x}" cy="${N.y}" r="${N.r}" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
    } else if (n.kind === "petal") {
      const ang = Math.atan2(n.y, n.x);
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const len = N.r * 2.2, wid = N.r * 0.9;
      const tipX = N.x + ux * len, tipY = N.y + uy * len;
      const baseX = N.x - ux * len * 0.2, baseY = N.y - uy * len * 0.2;
      const px = -uy * wid, py = ux * wid;
      nodes += `<path d="M${baseX},${baseY} Q${N.x + px},${N.y + py} ${tipX},${tipY} Q${N.x - px},${N.y - py} ${baseX},${baseY} Z" fill="${ember}" fill-opacity="0.7" stroke="${ink}" stroke-width="0.8"/>`;
    } else if (n.kind === "leaf") {
      nodes += `<circle cx="${N.x}" cy="${N.y}" r="${N.r}" fill="${stripe}" stroke="${ink}" stroke-width="0.8"/>`;
    } else if (n.kind === "center") {
      nodes += `<circle cx="${N.x}" cy="${N.y}" r="${N.r}" fill="none" stroke="${ink}" stroke-width="1.2"/><circle cx="${N.x}" cy="${N.y}" r="${N.r * 0.4}" fill="${ember}"/>`;
    } else {
      nodes += `<circle cx="${N.x}" cy="${N.y}" r="${Math.max(1.2, N.r * 0.7)}" fill="${ink}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#f0e9d8"/>${threads}${nodes}</svg>`;
}


// vector export of a beadwork artifact — cords as polylines, beads as
// gradient-filled circles / drops / bugles. mirrors BeadCanvas so the
// downloaded svg matches what's drawn on screen.
function beadworkToSvg(art: BeadworkArtifact): string {
  const { width: w, height: h, beads, strands } = art;
  let cords = "";
  for (const s of strands) {
    if (s.path.length < 2) continue;
    const d = s.path.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
    cords += `<path d="${d}${s.closed ? " Z" : ""}" fill="none" stroke="#262532" stroke-opacity="${s.kind === "fringe" ? 0.4 : 0.5}" stroke-width="0.9" stroke-linecap="round"/>`;
  }
  let beadSvg = "";
  let defs = "";
  for (const b of beads) {
    const gid = `bg${b.id}`;
    const hl = b.finish === "matte" ? 0.15 : b.finish === "iridescent" ? 0.7 : 0.45;
    defs += `<radialGradient id="${gid}" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#ffffff" stop-opacity="${hl}"/><stop offset="40%" stop-color="${b.color}"/><stop offset="100%" stop-color="#000000" stop-opacity="0.25"/></radialGradient>`;
    if (b.shape === "drop") {
      beadSvg += `<path opacity="${b.opacity}" d="M${b.x},${b.y - b.size * 1.4} C${b.x + b.size},${b.y - b.size * 0.6} ${b.x + b.size},${b.y + b.size * 0.4} ${b.x},${b.y + b.size * 1.1} C${b.x - b.size},${b.y + b.size * 0.4} ${b.x - b.size},${b.y - b.size * 0.6} ${b.x},${b.y - b.size * 1.4} Z" fill="url(#${gid})" stroke="${b.color}" stroke-opacity="0.4" stroke-width="0.5"/>`;
    } else if (b.shape === "bugle") {
      beadSvg += `<rect opacity="${b.opacity}" x="${b.x - b.size * 1.6}" y="${b.y - b.size * 0.55}" width="${b.size * 3.2}" height="${b.size * 1.1}" rx="${b.size * 0.4}" fill="url(#${gid})" stroke="${b.color}" stroke-opacity="0.4" stroke-width="0.5"/>`;
    } else if (b.shape === "faceted") {
      const r = b.size;
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        pts.push(`${(b.x + Math.cos(a) * r).toFixed(2)},${(b.y + Math.sin(a) * r).toFixed(2)}`);
      }
      beadSvg += `<polygon opacity="${b.opacity}" points="${pts.join(" ")}" fill="url(#${gid})" stroke="${b.color}" stroke-opacity="0.5" stroke-width="0.5"/>`;
    } else {
      beadSvg += `<circle opacity="${b.opacity}" cx="${b.x}" cy="${b.y}" r="${b.size}" fill="url(#${gid})" stroke="${b.color}" stroke-opacity="0.35" stroke-width="0.4"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs><rect width="100%" height="100%" fill="#f0e9d8"/>${cords}${beadSvg}</svg>`;
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
