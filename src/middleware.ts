import { defineMiddleware } from "astro:middleware";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "~/db";
import { profile as profileTable } from "~/db/schema";
import { createAuth } from "~/lib/auth";
import { getEnv, getSiteUrl, isAuthConfigured } from "~/lib/env";

let warnedMissingConfig = false;

// Populates Astro.locals.user and .profile on every request that isn't a
// prerendered static file. Pages opt in by setting `export const prerender = false`.
export const onRequest = defineMiddleware(async (ctx, next) => {
  ctx.locals.user = null;
  ctx.locals.profile = null;

  // Don't try to talk to the DB during prerender — there's no request context.
  if (ctx.isPrerendered) return next();

  const env = getEnv(ctx);

  // Skip auth entirely if D1 / auth secret aren't configured. Lets the dev
  // server boot and visitor-facing SSR pages render without bindings.
  if (!isDbConfigured(ctx) || !isAuthConfigured(env)) {
    if (!warnedMissingConfig) {
      console.warn(
        "[middleware] D1 or BETTER_AUTH_SECRET not configured; auth disabled. " +
          "Run `wrangler d1 create americansforpropriety` and set BETTER_AUTH_SECRET to enable.",
      );
      warnedMissingConfig = true;
    }
    return next();
  }

  try {
    const auth = createAuth({
      d1: env.DB,
      baseUrl: getSiteUrl(ctx),
      authSecret: env.BETTER_AUTH_SECRET,
      awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
      awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      awsRegion: env.AWS_REGION,
      fromAddress: env.EMAIL_FROM,
    });

    const session = await auth.api.getSession({
      headers: ctx.request.headers,
    });

    if (session?.user) {
      ctx.locals.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
      };

      const db = getDb(ctx);
      const [row] = await db
        .select()
        .from(profileTable)
        .where(eq(profileTable.userId, session.user.id))
        .limit(1);

      if (row) {
        ctx.locals.profile = {
          userId: row.userId,
          displayName: row.displayName,
          zip: row.zip,
          state: row.state,
          city: row.city,
          congressionalDistrict: row.congressionalDistrict,
          stateLegislativeLowerDistrict: row.stateLegislativeLowerDistrict,
          stateLegislativeUpperDistrict: row.stateLegislativeUpperDistrict,
        };
      }
    }
  } catch (err) {
    // Auth failure should never block the page. Log only.
    console.error("[middleware] auth lookup failed", err);
  }

  return next();
});
