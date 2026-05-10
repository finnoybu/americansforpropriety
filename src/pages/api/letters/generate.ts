import type { APIRoute } from "astro";
import { getSupabase } from "~/lib/supabase";
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
    return json({ error: "missing_fields", message: "Need representative, office, and topic." }, 400);
  }

  const supabase = getSupabase(ctx);

  // Rate limit: count generations in the last hour for this user.
  const { data: rateData, error: rateErr } = await supabase.rpc("recent_letter_count", {
    window_minutes: 60,
  });
  if (rateErr) {
    console.error("[letters/generate] rate check failed", rateErr);
  } else if (typeof rateData === "number" && rateData >= RATE_LIMIT_PER_HOUR) {
    return json(
      {
        error: "rate_limited",
        message: `Please wait — you can draft up to ${RATE_LIMIT_PER_HOUR} letters per hour.`,
      },
      429,
    );
  }

  const profile = ctx.locals.profile;

  let result;
  try {
    result = await generateLetter({
      representativeName: repName,
      representativeOffice: repOffice,
      topic,
      stance,
      memberCity: null,
      memberState: profile?.state ?? null,
      memberZip: profile?.zip ?? null,
      issueSlug: issueSlug || undefined,
      enableWebSearch,
      apiKey: env.ANTHROPIC_API_KEY,
    });
  } catch (err) {
    console.error("[letters/generate] anthropic call failed", err);
    return json(
      { error: "generation_failed", message: err instanceof Error ? err.message : "Generation failed." },
      502,
    );
  }

  const { data: saved, error: saveErr } = await supabase
    .from("generated_letters")
    .insert({
      user_id: ctx.locals.user.id,
      representative_name: repName,
      representative_office: repOffice,
      topic,
      stance,
      body: result.body,
      issue_slug: issueSlug || null,
      used_web_search: enableWebSearch,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
    })
    .select()
    .single();

  if (saveErr) {
    console.error("[letters/generate] save failed", saveErr);
  }

  return json(
    {
      id: saved?.id,
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
