// semantic interpretation
// ---------------------------------------------------------------
// before any engine generates anything, we ask the model to read
// the user's input and tell us *what kind of thing it is* — a
// proper name, a common noun, a concept, an emotion, a place.
//
// we never want to weave the *letters* of "ocean"; we want to
// weave *waves, currents, layered movement*. so this function
// returns a small structured payload:
//
//   - kind:        proper-name | concept | ambiguous
//   - concept:     canonical noun (rose, ocean, crow)
//   - motifs:      structural keywords engines can lean on
//                  (radial, branching, tidal, clustered…)
//   - alternates:  for ambiguous words like "violet" (name/flower/color)
//   - hints:       per-engine suggestions
//
// proper names keep their literal seed so identity stays personal.
// concepts get *replaced* by the concept word so the textile is
// shaped by the meaning, not by the spelling.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  word: z.string().min(1).max(64),
});

export type SeedKind = "proper-name" | "concept" | "ambiguous";

export type SemanticHints = {
  crossStitchSubject: string | null;
  weave: "plain" | "twill" | "basket" | "satin" | "herringbone" | "diamond" | "jacquard" | null;
  lace: "doily" | "crochet" | "tatting" | "bobbin" | "floral" | "geometric" | null;
  symmetry: "none" | "mirror-x" | "mirror-y" | "quad" | null;
};

export type SemanticAlternate = {
  label: string;       // word shown to the user ("violet, the flower")
  kind: SeedKind;
  concept: string | null;
};

export type SemanticReading = {
  input: string;
  kind: SeedKind;
  concept: string | null;
  motifs: string[];
  alternates: SemanticAlternate[];
  hints: SemanticHints;
  rationale: string;   // one short human sentence ("interpreted as a flower")
};

export const interpretSeed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<SemanticReading> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing on server");

    const word = data.word.trim().toLowerCase();

    const system = [
      "you are the semantic interpreter inside a textile studio.",
      "given a single word or short phrase, decide whether it is a proper name (person/place/brand/character) or a common concept (object, animal, plant, emotion, activity, place, abstract idea).",
      "for concepts: return the canonical noun + 3-7 structural motif keywords describing how that thing is *built* (radial, branching, tidal, layered, clustered, woven, geometric, organic, directional, etc.).",
      "for proper names: return concept=null, motifs=[], and leave hints.crossStitchSubject null so the textile is seeded from the letters of the name itself.",
      "if the word is genuinely ambiguous (violet = name | flower | color; rose = name | flower), set kind='ambiguous', pick the most likely concept reading, AND return 2-3 alternates so the user can pick.",
      "engine hints map the concept to a textile grammar:",
      "  weave: plain (calm/grids), twill (directional/storm/wind), basket (woven/structural/architecture), satin (smooth/luxury/water), herringbone (feathers/wings/fish), diamond (mountains/gems/crystals), jacquard (ornate/floral/figurative).",
      "  lace:  doily (radial/snowflake/sun), floral (flowers/petals/leaves), crochet (chains/branches/networks), tatting (knotted/jewelry/stars), bobbin (geometric/architecture), geometric (abstract/symbols).",
      "  symmetry: quad (botanical/symmetric objects), mirror-x (faces/animals), none (landscapes/storms/abstract motion).",
      "  crossStitchSubject: for concepts, the noun whose silhouette best represents the word (e.g. 'storm' -> 'lightning bolt'; 'library' -> 'book'). for proper names, null.",
      "respond only with the json object the schema requires. keep motif words short and structural, not decorative adjectives.",
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
          { role: "user", content: `input: ${word}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "semantic_reading",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["kind", "concept", "motifs", "alternates", "hints", "rationale"],
              properties: {
                kind: { type: "string", enum: ["proper-name", "concept", "ambiguous"] },
                concept: { type: ["string", "null"] },
                motifs: {
                  type: "array",
                  minItems: 0,
                  maxItems: 7,
                  items: { type: "string" },
                },
                alternates: {
                  type: "array",
                  minItems: 0,
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["label", "kind", "concept"],
                    properties: {
                      label: { type: "string" },
                      kind: { type: "string", enum: ["proper-name", "concept", "ambiguous"] },
                      concept: { type: ["string", "null"] },
                    },
                  },
                },
                hints: {
                  type: "object",
                  additionalProperties: false,
                  required: ["crossStitchSubject", "weave", "lace", "symmetry"],
                  properties: {
                    crossStitchSubject: { type: ["string", "null"] },
                    weave: {
                      type: ["string", "null"],
                      enum: ["plain", "twill", "basket", "satin", "herringbone", "diamond", "jacquard", null],
                    },
                    lace: {
                      type: ["string", "null"],
                      enum: ["doily", "crochet", "tatting", "bobbin", "floral", "geometric", null],
                    },
                    symmetry: {
                      type: ["string", "null"],
                      enum: ["none", "mirror-x", "mirror-y", "quad", null],
                    },
                  },
                },
                rationale: { type: "string" },
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
    let parsed: Partial<SemanticReading> & { hints?: Partial<SemanticHints> };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("model returned non-json content");
    }

    return {
      input: word,
      kind: (parsed.kind as SeedKind) ?? "proper-name",
      concept: typeof parsed.concept === "string" ? parsed.concept.toLowerCase() : null,
      motifs: Array.isArray(parsed.motifs) ? parsed.motifs.slice(0, 7).map((m) => String(m).toLowerCase()) : [],
      alternates: Array.isArray(parsed.alternates) ? parsed.alternates.slice(0, 4) : [],
      hints: {
        crossStitchSubject: parsed.hints?.crossStitchSubject ?? null,
        weave: (parsed.hints?.weave as SemanticHints["weave"]) ?? null,
        lace: (parsed.hints?.lace as SemanticHints["lace"]) ?? null,
        symmetry: (parsed.hints?.symmetry as SemanticHints["symmetry"]) ?? null,
      },
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
    };
  });
