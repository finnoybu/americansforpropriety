import type { APIRoute } from "astro";
import { getSupabase } from "~/lib/supabase";
import { getEnv } from "~/lib/env";
import { lookupReps } from "~/lib/geocodio";

export const prerender = false;

// POST { zip } — looks up reps via Geocodio, persists ZIP/district/cache to
// the member's profile, returns the normalized rep list.
export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.user) {
    return json({ error: "not_authenticated" }, 401);
  }

  let payload: { zip?: string };
  try {
    payload = (await ctx.request.json()) as { zip?: string };
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const zip = (payload.zip ?? "").trim();
  if (!/^\d{5}$/.test(zip)) {
    return json({ error: "invalid_zip", message: "Enter a 5-digit ZIP." }, 400);
  }

  const env = getEnv(ctx);
  if (!env.GEOCODIO_API_KEY) {
    return json({ error: "geocodio_not_configured" }, 500);
  }

  let result;
  try {
    result = await lookupReps(zip, env.GEOCODIO_API_KEY);
  } catch (err) {
    console.error("[reps/lookup]", err);
    return json(
      { error: "lookup_failed", message: err instanceof Error ? err.message : "Lookup failed." },
      502,
    );
  }

  // Persist to profile (RLS: user can only update their own row).
  const supabase = getSupabase(ctx);
  const { error: upsertErr } = await supabase
    .from("profiles")
    .update({
      zip: result.zip,
      state: result.state,
      city: result.city,
      congressional_district: result.congressional_district,
      state_legislative_lower_district: result.state_lower_district,
      state_legislative_upper_district: result.state_upper_district,
      representatives_cache: result.representatives,
      representatives_cached_at: new Date().toISOString(),
    })
    .eq("id", ctx.locals.user.id);

  if (upsertErr) {
    console.error("[reps/lookup] profile update failed", upsertErr);
  }

  return json(result, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
