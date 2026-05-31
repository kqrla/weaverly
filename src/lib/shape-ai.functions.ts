// shape-ai
// ---------------------------------------------------------------
// when a user types a word the local SHAPE catalog doesn't know,
// we ask the lovable ai gateway to draft a tiny binary silhouette
// of the word's meaning. the model returns a 32x32 matrix of 0/1
// rows; the cross-stitch engine rasterises that mask onto the
// aida lattice the same way it would rasterise a known SHAPE.
//
// why a bitmap and not an svg?
//   bitmaps round-trip perfectly to a discrete lattice. no path
//   sampling, no antialiasing — every cell is decisively on/off,
//   which is exactly the grammar of a stitch chart.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GRID = 32;

const inputSchema = z.object({
  word: z.string().min(1).max(64),
});

export type ShapeBitmap = {
  size: number;     // square edge length, always GRID
  rows: string[];   // GRID strings of GRID chars, each '0' or '1'
};

export const interpretShape = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<ShapeBitmap> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY missing on server");
    }

    const word = data.word.trim().toLowerCase();

    const system = [
      "you are a textile chart designer.",
      `given a word, draw a recognisable centered silhouette of that word's meaning as a ${GRID}x${GRID} binary pixel grid.`,
      "rules:",
      `- output exactly ${GRID} rows, each exactly ${GRID} characters of '0' or '1'.`,
      "- '1' means stitched cell, '0' means empty cloth.",
      "- the silhouette must be a single coherent shape, centered, with at least 1 cell of padding on every side.",
      "- prefer bold filled shapes over thin outlines so the silhouette reads at a glance.",
      "- if the word is abstract (love, hope, peace), pick the most iconic associated object.",
      "- never include text, letters, or numerals as the silhouette.",
      "respond only with the json object the schema requires.",
    ].join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `word: ${word}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "shape_bitmap",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["rows"],
              properties: {
                rows: {
                  type: "array",
                  minItems: GRID,
                  maxItems: GRID,
                  items: { type: "string", minLength: GRID, maxLength: GRID },
                },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`ai gateway ${response.status}: ${detail.slice(0, 200)}`);
    }

    const payload = await response.json();
    const content: string = payload?.choices?.[0]?.message?.content ?? "";
    let parsed: { rows?: unknown };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("model returned non-json content");
    }

    const rows = Array.isArray(parsed.rows) ? (parsed.rows as unknown[]) : [];
    const cleaned: string[] = [];
    for (let y = 0; y < GRID; y++) {
      const raw = typeof rows[y] === "string" ? (rows[y] as string) : "";
      // normalise: keep only 0/1, pad/truncate to GRID width
      const filtered = raw.replace(/[^01]/g, "");
      const padded = (filtered + "0".repeat(GRID)).slice(0, GRID);
      cleaned.push(padded);
    }
    while (cleaned.length < GRID) cleaned.push("0".repeat(GRID));

    return { size: GRID, rows: cleaned };
  });
