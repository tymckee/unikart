import Anthropic from "@anthropic-ai/sdk";

/**
 * "The gist" — turn noisy e-commerce copy into a calm, scannable summary plus
 * the key specs. Uses Claude (Haiku by default, env-overridable) with a
 * structured JSON output. Falls back to a deterministic heuristic when no
 * ANTHROPIC_API_KEY is set, so the feature works locally without a key.
 */

const MODEL = process.env.ANTHROPIC_GIST_MODEL ?? "claude-haiku-4-5";

export interface ProductGist {
  summary: string[];
  specs: { label: string; value: string }[];
}

interface GistInput {
  title: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  storeName?: string | null;
}

const GIST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "array", items: { type: "string" } },
    specs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string" }, value: { type: "string" } },
        required: ["label", "value"],
      },
    },
  },
  required: ["summary", "specs"],
} as const;

function clampGist(g: ProductGist): ProductGist {
  return {
    summary: (g.summary ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 5),
    specs: (g.specs ?? [])
      .filter((s) => s && s.label && s.value)
      .map((s) => ({
        label: String(s.label).trim().slice(0, 40),
        value: String(s.value).trim().slice(0, 80),
      }))
      .slice(0, 8),
  };
}

/** Deterministic fallback — no API key required. */
function heuristicGist(input: GistInput): ProductGist {
  const text = (input.description ?? "").replace(/\s+/g, " ").trim();
  const summary: string[] = [];
  const specs: { label: string; value: string }[] = [];

  // Parse "Label: value" fragments as specs.
  for (const m of text.matchAll(/([A-Z][A-Za-z /&-]{2,30}):\s*([^.;|]{2,60})/g)) {
    specs.push({ label: m[1].trim(), value: m[2].trim() });
    if (specs.length >= 6) break;
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && s.length < 160);
  for (const s of sentences) {
    summary.push(s);
    if (summary.length >= 4) break;
  }

  if (summary.length === 0) {
    summary.push(
      `${input.title}${input.brand ? ` by ${input.brand}` : ""}${
        input.storeName ? ` — from ${input.storeName}` : ""
      }.`,
    );
  }
  return clampGist({ summary, specs });
}

export async function summarizeProduct(
  input: GistInput,
): Promise<ProductGist | null> {
  if (!process.env.ANTHROPIC_API_KEY) return heuristicGist(input);

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system:
        "You simplify noisy e-commerce product copy into a calm, scannable summary. Be strictly factual: only use details present in the input, never invent specs or marketing claims. Summary bullets are short, plain-language, and free of hype.",
      messages: [
        {
          role: "user",
          content: `Product: ${input.title}\nBrand: ${input.brand ?? "unknown"}\nCategory: ${input.category ?? "unknown"}\n\nDescription:\n${(input.description ?? "").trim() || "(no description provided)"}\n\nReturn 3–5 short plain-language bullet points (the gist of what this is) and any key specs (label/value pairs like Material, Dimensions, Capacity, Weight) that appear in the text.`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: GIST_SCHEMA } },
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return heuristicGist(input);
    return clampGist(JSON.parse(block.text) as ProductGist);
  } catch (e) {
    console.error("[ai] summarizeProduct:", e);
    return heuristicGist(input);
  }
}
