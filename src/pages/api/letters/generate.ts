import type { APIRoute } from "astro";
import { and, eq, gt, count } from "drizzle-orm";
import { getDb } from "~/db";
import { generatedLetter } from "~/db/schema";
import { getEnv } from "~/lib/env";
import { generateLetter } from "~/lib/anthropic";

export const prerender = false;

const RATE_LIMIT_PER_HOUR = 8;
const STANCES = new Set(["support", "oppose", "ask_for_position", "other"]);

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.user) return json({ error: "not_authenticated" }, 401);

  const env = getEnv(ctx);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "anthropic_not_configured" }, 500);

  let payload: any;
  try {
    payload = await ctx.request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const repName = sanitize(payload?.representative_name, 200);
  const repOffice = sanitize(payload?.representative_office, 200);
  const topic = sanitize(payload?.topic, 500);
  const stance = STANCES.has(payload?.stance) ? payload.stance : "other";
  const enableWebSearch = Boolean(payload?.enable_web_search);
  const issueSlug = sanitize(payload?.issue_slug, 200);

  if (!repName || !repOffice || !topic) {
    return json(
      { error: "missing_fields", message: "Need representative, office, and topic." },
      400,
    );
  }

  const db = getDb(ctx);
  const userId = ctx.locals.user.id;

  // Rate limit: count generations in the last hour for this user.
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [{ n }] = await db
      .select({ n: count() })
      .from(generatedLetter)
      .where(
        and(
          eq(generatedLetter.userId, userId),
          gt(generatedLetter.createdAt, oneHourAgo),
        ),
      );
    if (n >= RATE_LIMIT_PER_HOUR) {
      return json(
        {
          error: "rate_limited",
          message: `Please wait — you can draft up to ${RATE_LIMIT_PER_HOUR} letters per hour.`,
        },
        429,
      );
    }
  } catch (err) {
    console.error("[letters/generate] rate check failed", err);
  }

  const profile = ctx.locals.profile;

  let result;
  try {
    result = await generateLetter({
      representativeName: repName,
      representativeOffice: repOffice,
      topic,
      stance,
      memberCity: profile?.city ?? null,
      memberState: profile?.state ?? null,
      memberZip: profile?.zip ?? null,
      issueSlug: issueSlug || undefined,
      enableWebSearch,
      apiKey: env.ANTHROPIC_API_KEY,
    });
  } catch (err) {
    console.error("[letters/generate] anthropic call failed", err);
    return json(
      {
        error: "generation_failed",
        message: err instanceof Error ? err.message : "Generation failed.",
      },
      502,
    );
  }

  let savedId: string | undefined;
  try {
    const [row] = await db
      .insert(generatedLetter)
      .values({
        userId,
        representativeName: repName,
        representativeOffice: repOffice,
        topic,
        stance,
        body: result.body,
        issueSlug: issueSlug || null,
        usedWebSearch: enableWebSearch,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      })
      .returning({ id: generatedLetter.id });
    savedId = row?.id;
  } catch (err) {
    console.error("[letters/generate] save failed", err);
  }

  return json(
    {
      id: savedId,
      body: result.body,
      model: result.model,
      used_web_search: enableWebSearch,
    },
    200,
  );
};

function sanitize(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
