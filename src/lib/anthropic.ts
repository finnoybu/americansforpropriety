// Letter generator backed by the Anthropic Messages API.
//
// Defaults to claude-opus-4-7 (configurable via env). Uses the web_search tool
// to ground the letter in the rep's recent public positions when enabled.
// Talks raw HTTPS — the Node SDK isn't a clean fit for Cloudflare Workers.

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-opus-4-7";
const SYSTEM_PROMPT = `You draft constituent letters for Americans for Propriety, a civic project that helps citizens write to their representatives.

Voice & frame:
- Personal, civil, direct. Specific over general.
- Reads like a real person wrote it, not a campaign.
- Acknowledges the representative's role and constituency without flattery or attack.
- Names a specific ask. Avoids vague calls to "do better."

Structure (no headings, no bullet lists):
1. One-sentence identification: who I am, where I live (use the city/ZIP provided).
2. Why I'm writing — name the issue and the rep's specific connection to it (committee, prior vote, public statement, district relevance). When web search is enabled, ground this paragraph in a real recent statement, vote, or position.
3. The ask: one or two specific actions, with reasoning a thoughtful reader would find defensible.
4. A short close thanking them for representing the district.

Length: 250 to 450 words. Plain prose.

Style rules:
- No em dashes.
- No phrases like "I am writing to" or "I hope this letter finds you well."
- No exclamation points.
- No claims about the rep's motivations you cannot support from public record.
- Cite recent statements or votes by direct reference; never fabricate or speculate.

Web search: when enabled, search up to three times for specific recent positions, votes, statements, or committee actions by this representative on this topic. If you cannot find specific recent evidence, write a substantive letter without it — do not invent it.

Output only the letter body. No commentary, no preamble, no signature line. The member will personalize the salutation and signature.`;

export interface LetterRequest {
  representativeName: string;
  representativeOffice: string;
  topic: string;
  stance: "support" | "oppose" | "ask_for_position" | "other";
  memberCity: string | null;
  memberState: string | null;
  memberZip: string | null;
  issueSlug?: string;
  enableWebSearch: boolean;
  apiKey: string;
  model?: string;
}

export interface LetterResult {
  body: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function generateLetter(req: LetterRequest): Promise<LetterResult> {
  const model = req.model ?? DEFAULT_MODEL;
  const stanceLine = stanceToInstruction(req.stance);
  const locale = [req.memberCity, req.memberState, req.memberZip].filter(Boolean).join(", ");

  const userPrompt = [
    `Representative: ${req.representativeName}`,
    `Office: ${req.representativeOffice}`,
    `Topic: ${req.topic}`,
    `My position: ${stanceLine}`,
    locale ? `Where I live: ${locale}` : "",
    "",
    `Draft the letter body now.`,
  ]
    .filter(Boolean)
    .join("\n");

  const tools = req.enableWebSearch
    ? [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: 3,
        },
      ]
    : undefined;

  const body: Record<string, unknown> = {
    model,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  };
  if (tools) body.tools = tools;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": req.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    stop_reason?: string;
  };

  const text = data.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text!)
    .join("\n")
    .trim();

  if (!text) throw new Error("Anthropic returned no text content.");

  return {
    body: text,
    model,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

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
    inputTokens:
      (briefData.usage?.input_tokens ?? 0),
    outputTokens:
      (briefData.usage?.output_tokens ?? 0),
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

function stanceToInstruction(stance: LetterRequest["stance"]): string {
  switch (stance) {
    case "support":
      return "I support action on this issue and want the representative to act.";
    case "oppose":
      return "I oppose the current direction on this issue and want the representative to push back.";
    case "ask_for_position":
      return "I want a clear public statement of the representative's position on this issue.";
    default:
      return "Frame the position from the user's words above.";
  }
}
