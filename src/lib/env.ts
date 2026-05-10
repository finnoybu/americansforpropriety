import type { APIContext, AstroGlobal } from "astro";

// Cloudflare Pages exposes env via `Astro.locals.runtime.env` (Workers Functions).
// Local `astro dev` reads from `.env` via `import.meta.env` for PUBLIC_* vars
// and from `process.env` for server-only ones. This shim returns the right
// source so callsites can stay simple.
export function getEnv(ctx: APIContext | AstroGlobal): Env {
  const runtimeEnv = (ctx.locals as App.Locals).runtime?.env as Env | undefined;
  if (runtimeEnv && runtimeEnv.DB) return runtimeEnv;

  // Fallback: read from process.env (Node dev) and import.meta.env (Vite).
  const proc = (globalThis as any).process?.env ?? {};
  return {
    DB: undefined as unknown as D1Database,
    BETTER_AUTH_SECRET: proc.BETTER_AUTH_SECRET ?? "",
    RESEND_API_KEY: proc.RESEND_API_KEY,
    EMAIL_FROM: proc.EMAIL_FROM,
    ANTHROPIC_API_KEY: proc.ANTHROPIC_API_KEY ?? "",
    GEOCODIO_API_KEY: proc.GEOCODIO_API_KEY ?? "",
    PUBLIC_SITE_URL:
      import.meta.env.PUBLIC_SITE_URL ??
      proc.PUBLIC_SITE_URL ??
      "http://localhost:4321",
    ADMIN_EMAILS: proc.ADMIN_EMAILS,
  };
}

// True when the D1 binding and Better Auth secret are both populated.
// Lets pages/middleware skip auth/db calls cleanly when running in an
// environment without bindings (e.g., a freshly-cloned dev server before
// `wrangler d1 create`).
export function isAuthConfigured(env: Env): boolean {
  return Boolean(env.DB && env.BETTER_AUTH_SECRET);
}

// Returns true if the email is in the comma-separated ADMIN_EMAILS env var.
// Case-insensitive. If ADMIN_EMAILS is empty/unset, no one is admin.
export function isAdminEmail(
  email: string | null | undefined,
  env: Env,
): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

// Resolve the site URL used for absolute links (canonical, OG, magic-link
// callbacks). Falls back to the request origin if nothing else is set.
export function getSiteUrl(ctx: APIContext | AstroGlobal): string {
  const env = getEnv(ctx);
  return env.PUBLIC_SITE_URL || ctx.url.origin;
}
