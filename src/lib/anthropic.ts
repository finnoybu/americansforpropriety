// AI brief drafter backed by the Anthropic Messages API.
//
// Defaults to claude-opus-4-7 (configurable via env). Used by /admin/briefs to
// produce weekly research briefs from a topic + news hook. Editor reviews
// before publication.
//
// On-demand letter generation has been removed — the project now uses
// hand-written letter templates with placeholder substitution at /letters/[slug].

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-4-7";

// =============================================================================
// Brief generator
// =============================================================================
// Drafts a research brief for an issue, optionally grounded in current news via
// the Anthropic web_search tool. Output is markdown body only — slug/title/
// summary are produced by a structured second step.

const BRIEF_SYSTEM_PROMPT = `You draft research briefs for Americans for Propriety, a civic policy research project.

The audience is engaged constituents — not lobbyists, not academics. The voice is:
- Direct, plain-language, factual.
- Civil. Names what's happening without rhetorical inflation.
- Confident but not partisan in tone. Acknowledges complexity without retreating into both-sides-ism.
- Sourced. Cites specific bills, votes, rulings, agencies, and dates by name when used. Names of articles or outlets when web search is enabled.

Length: 700-1200 words. Reading time roughly 5-9 minutes.

Structure:
1. A short opening that names the news hook or the structural question.
2. Background and context. What is the institutional, legal, or historical setting?
3. What's actually happening or proposed. Be specific — bill numbers, agency names, dates.
4. The substantive argument. What's at stake? Who benefits, who pays, who decides?
5. What's next or what to watch.

Style rules:
- No em dashes.
- No hortatory rhetoric ("we must", "it is imperative").
- No exclamation points.
- Avoid editorial sneer at any side.
- Numbered or bulleted lists used sparingly and only when they add clarity.
- Plain markdown (## headings, **bold**, *italic*, lists). No HTML.
- Don't include a title line or summary at the top of the body — those are produced separately.

When web search is enabled: search up to 4 times for specific recent statements, votes, rulings, agency actions, or news on this topic. Ground the brief in real, dated, sourced events. If you cannot find specific recent evidence, say so honestly and write the brief from durable structural analysis.

Output ONLY the markdown body of the brief. No commentary. No preamble. No "Here is the brief:" lead-in.`;

const BRIEF_META_PROMPT = `You will be given the body of a research brief that has already been written. Produce structured metadata for it.

Output ONLY a JSON object with these fields:
- title: a clear, specific headline (60-90 characters, no all-caps, no exclamation points, no clickbait).
- summary: one sentence (under 200 characters) describing what the brief covers. Plain prose. No marketing language.
- slug: a URL slug derived from the title (lowercase, alphanumeric and hyphens only, no leading/trailing hyphens, 30-70 characters).
- reading_minutes: an integer estimate of reading time (assume 200 wpm).

Output JSON only. No prose, no preamble, no code fences.`;

export interface BriefRequest {
  topic: string;
  issueSlug: string;
  enableWebSearch: boolean;
  apiKey: string;
  model?: string;
}

export interface BriefResult {
  body: string;
  title: string;
  summary: string;
  slug: string;
  readingMinutes: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function generateBrief(req: BriefRequest): Promise<BriefResult> {
  const model = req.model ?? DEFAULT_MODEL;

  const userPrompt = [
    `Issue area: ${req.issueSlug}`,
    `Topic: ${req.topic}`,
    "",
    "Draft the brief now.",
  ].join("\n");

  const tools = req.enableWebSearch
    ? [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }]
    : undefined;

  const briefBody: Record<string, unknown> = {
    model,
    max_tokens: 4000,
    system: [
      { type: "text", text: BRIEF_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
  };
  if (tools) briefBody.tools = tools;

  const briefRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": req.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(briefBody),
  });

  if (!briefRes.ok) {
    const text = await briefRes.text().catch(() => "");
    throw new Error(`Anthropic brief draft ${briefRes.status}: ${text.slice(0, 400)}`);
  }

  const briefData = (await briefRes.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const body = briefData.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n")
    .trim();

  if (!body) throw new Error("Anthropic returned no brief body.");

  // Second call: extract structured metadata. Cheap.
  const metaRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": req.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system: BRIEF_META_PROMPT,
      messages: [{ role: "user", content: body }],
    }),
  });

  let title = "Untitled draft";
  let summary = "";
  let slug = "draft-" + Date.now().toString(36);
  let readingMinutes = 6;

  if (metaRes.ok) {
    const metaData = (await metaRes.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const metaText = metaData.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    try {
      const parsed = JSON.parse(metaText.trim()) as {
        title?: string;
        summary?: string;
        slug?: string;
        reading_minutes?: number;
      };
      if (parsed.title) title = parsed.title;
      if (parsed.summary) summary = parsed.summary;
      if (parsed.slug) slug = parsed.slug;
      if (parsed.reading_minutes) readingMinutes = parsed.reading_minutes;
    } catch {
      // metadata extraction failed; use defaults
    }
  }

  return {
    body,
    title,
    summary,
    slug: sanitizeSlug(slug),
    readingMinutes,
    model,
    inputTokens: briefData.usage?.input_tokens ?? 0,
    outputTokens: briefData.usage?.output_tokens ?? 0,
  };
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
