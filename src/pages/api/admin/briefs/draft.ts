import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "~/db";
import { aiBrief } from "~/db/schema";
import { getEnv, isAdminEmail } from "~/lib/env";
import { generateBrief } from "~/lib/anthropic";

export const prerender = false;

const ALLOWED_ISSUES = new Set([
  "economy-and-tax-fairness",
  "labor-and-wages",
  "healthcare",
  "climate-and-energy",
  "democracy-and-voting",
  "civil-rights-and-immigration",
]);

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.user) return json({ error: "not_authenticated" }, 401);
  const env = getEnv(ctx);
  if (!isAdminEmail(ctx.locals.user.email, env)) {
    return json({ error: "not_admin" }, 403);
  }
  if (!env.ANTHROPIC_API_KEY) return json({ error: "anthropic_not_configured" }, 500);

  let payload: any;
  try {
    payload = await ctx.request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const topic = String(payload?.topic ?? "").trim().slice(0, 1000);
  const issueSlug = String(payload?.issue ?? "").trim();
  const enableWebSearch = payload?.enable_web_search !== false;

  if (!topic) return json({ error: "missing_topic" }, 400);
  if (!ALLOWED_ISSUES.has(issueSlug)) return json({ error: "invalid_issue" }, 400);

  let result;
  try {
    result = await generateBrief({
      topic,
      issueSlug,
      enableWebSearch,
      apiKey: env.ANTHROPIC_API_KEY,
    });
  } catch (err) {
    console.error("[admin/briefs/draft] generation failed", err);
    return json(
      {
        error: "generation_failed",
        message: err instanceof Error ? err.message : "Failed",
      },
      502,
    );
  }

  const db = getDb(ctx);

  // Ensure slug uniqueness — append a short suffix if collision.
  let slug = result.slug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db
      .select({ id: aiBrief.id })
      .from(aiBrief)
      .where(eq(aiBrief.slug, slug))
      .limit(1);
    if (!existing) break;
    slug = `${result.slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  try {
    const [saved] = await db
      .insert(aiBrief)
      .values({
        slug,
        title: result.title,
        summary: result.summary,
        issue: issueSlug,
        body: result.body,
        status: "draft",
        usedWebSearch: enableWebSearch,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        readingMinutes: result.readingMinutes,
        authors: ["AfP AI Drafts"],
        createdBy: ctx.locals.user.id,
      })
      .returning();
    return json({ brief: saved }, 201);
  } catch (err) {
    console.error("[admin/briefs/draft] insert failed", err);
    return json(
      {
        error: "save_failed",
        message: err instanceof Error ? err.message : "Save failed",
      },
      500,
    );
  }
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
