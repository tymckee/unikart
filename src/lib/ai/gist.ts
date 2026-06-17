import Anthropic from "@anthropic-ai/sdk";

/**
 * "The gist" — turn noisy e-commerce copy into a calm, scannable summary plus
 * the key specs. Uses Claude (Haiku by default, env-overridable) with a
 * structured JSON output. Falls back to a deterministic heuristic when no
 * ANTHROPIC_API_KEY is set, so the feature works locally without a key.
 */

const MODEL = process.env.ANTHROPIC_GIST_MODEL ?? "claude-haiku-4-5";

export interface ProductGist {
  /** A concise, brand-first product name with SEO/marketing cruft stripped. */
  cleanName?: string;
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
    cleanName: { type: "string" },
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
  required: ["cleanName", "summary", "specs"],
} as const;

/** Collapse whitespace and drop a trailing marketing tail after a separator. */
function cleanProductName(raw: string): string {
  const s = (raw || "").replace(/\s+/g, " ").trim();
  return (s.split(/\s+[–—|]\s+/)[0]?.trim() || s).slice(0, 80);
}

function clampGist(g: ProductGist): ProductGist {
  return {
    cleanName: g.cleanName ? String(g.cleanName).trim().slice(0, 80) : undefined,
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
  return clampGist({ cleanName: cleanProductName(input.title), summary, specs });
}

export async function summarizeProduct(
  input: GistInput,
): Promise<ProductGist | null> {
  if (!process.env.ANTHROPIC_API_KEY) return heuristicGist(input);

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system:
        "You normalize noisy e-commerce product copy into a calm, clean record: a concise brand-first product name, a scannable summary, and the key specs. Be strictly factual: only use details present in the input, never invent specs, names, or marketing claims. Strip hype, keyword-stuffing, and SEO cruft.",
      messages: [
        {
          role: "user",
          content: `Product: ${input.title}\nBrand: ${input.brand ?? "unknown"}\nCategory: ${input.category ?? "unknown"}\n\nDescription:\n${(input.description ?? "").trim() || "(no description provided)"}\n\nReturn:\n- cleanName: a concise, human, brand-first product name. Strip SEO keyword-stuffing, repeated specs, and marketing adjectives; fix brand casing (e.g. "ray ban" → "Ray-Ban"). Don't invent anything. Example: "Wyze Smart Scale Ultra BodyScan with Handle – Wi-Fi & Bluetooth Body Composition Scale for Weight, BMI, Body Fat" → "Wyze Smart Scale Ultra (BodyScan)".\n- summary: 3–5 short plain-language bullets (the gist of what this is), no hype.\n- specs: key label/value pairs (Material, Dimensions, Capacity, Weight, Battery, etc.) that appear in the text.`,
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
