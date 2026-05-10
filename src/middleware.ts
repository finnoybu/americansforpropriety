import { defineMiddleware } from "astro:middleware";
import { getSupabase } from "~/lib/supabase";
import { getEnv, isSupabaseConfigured } from "~/lib/env";

let warnedMissingConfig = false;

// Populates Astro.locals.user and .profile on every request that isn't a
// prerendered static file. Pages opt in by setting `export const prerender = false`.
export const onRequest = defineMiddleware(async (ctx, next) => {
  ctx.locals.user = null;
  ctx.locals.profile = null;

  // Don't try to talk to Supabase on prerender — there's no request context yet.
  if (ctx.isPrerendered) return next();

  // Skip auth entirely if Supabase isn't configured. Lets the dev server boot
  // and visitor-facing SSR pages render even when .env is missing.
  if (!isSupabaseConfigured(getEnv(ctx))) {
    if (!warnedMissingConfig) {
      console.warn(
        "[middleware] Supabase env not configured; auth disabled. " +
          "Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env to enable.",
      );
      warnedMissingConfig = true;
    }
    return next();
  }

  try {
    const supabase = getSupabase(ctx);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      ctx.locals.user = { id: user.id, email: user.email ?? "" };

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "id, display_name, zip, state, congressional_district, state_legislative_lower_district, state_legislative_upper_district",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        ctx.locals.profile = profile as App.Locals["profile"];
      }
    }
  } catch (err) {
    // Auth failure should never block the page. Log only.
    console.error("[middleware] auth lookup failed", err);
  }

  return next();
});
