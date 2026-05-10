// Catch-all Better Auth handler. Mounts every /api/auth/* route — sign-in,
// magic-link verification, sign-out, session, etc. — onto Better Auth's
// internal handler.
//
// Astro's [...all].ts pattern matches /api/auth, /api/auth/sign-in/magic-link,
// /api/auth/get-session, etc. Better Auth uses the request URL itself to
// route, so we just hand the request over.

import type { APIRoute } from "astro";
import { createAuth } from "~/lib/auth";
import { getEnv, getSiteUrl, isAuthConfigured } from "~/lib/env";
import { isDbConfigured } from "~/db";

export const prerender = false;

const handler: APIRoute = async (ctx) => {
  const env = getEnv(ctx);
  if (!isDbConfigured(ctx) || !isAuthConfigured(env)) {
    return new Response(
      JSON.stringify({
        error: "Auth not configured",
        detail:
          "Server is missing D1 binding or BETTER_AUTH_SECRET. Configure wrangler.toml and Cloudflare secrets.",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const auth = createAuth({
    d1: env.DB,
    baseUrl: getSiteUrl(ctx),
    authSecret: env.BETTER_AUTH_SECRET,
    awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    awsRegion: env.AWS_REGION,
    fromAddress: env.EMAIL_FROM,
  });

  return auth.handler(ctx.request);
};

export const GET = handler;
export const POST = handler;
