import type { APIRoute } from "astro";
import { getDb } from "~/db";
import { profile as profileTable } from "~/db/schema";
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
    return json(
      {
        error: "geocodio_not_configured",
        message:
          "Representative lookup isn't available yet — this is on our end, not your ZIP. Please check back soon.",
      },
      503,
    );
  }

  let result;
  try {
    result = await lookupReps(zip, env.GEOCODIO_API_KEY);
  } catch (err) {
    console.error("[reps/lookup]", err);
    return json(
      {
        error: "lookup_failed",
        message: err instanceof Error ? err.message : "Lookup failed.",
      },
      502,
    );
  }

  const db = getDb(ctx);

  // Upsert into profile. Better Auth creates the user row but not the profile;
  // we own profile creation here on first lookup.
  const userId = ctx.locals.user.id;
  const profileData = {
    userId,
    zip: result.zip,
    state: result.state,
    city: result.city,
    congressionalDistrict: result.congressional_district,
    stateLegislativeLowerDistrict: result.state_lower_district,
    stateLegislativeUpperDistrict: result.state_upper_district,
    representativesCache: result.representatives,
    representativesCachedAt: new Date(),
  };

  try {
    await db
      .insert(profileTable)
      .values(profileData)
      .onConflictDoUpdate({
        target: profileTable.userId,
        set: {
          zip: profileData.zip,
          state: profileData.state,
          city: profileData.city,
          congressionalDistrict: profileData.congressionalDistrict,
          stateLegislativeLowerDistrict: profileData.stateLegislativeLowerDistrict,
          stateLegislativeUpperDistrict: profileData.stateLegislativeUpperDistrict,
          representativesCache: profileData.representativesCache,
          representativesCachedAt: profileData.representativesCachedAt,
        },
      });
  } catch (err) {
    console.error("[reps/lookup] profile upsert failed", err);
  }

  return json(result, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
