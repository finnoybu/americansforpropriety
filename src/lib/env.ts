import type { APIContext, AstroGlobal } from "astro";

// Cloudflare Pages exposes env via `Astro.locals.runtime.env` (Workers Functions).
// Local `astro dev` reads from `.env` via `import.meta.env`. This shim returns
// the right source so callsites can stay simple.
export function getEnv(ctx: APIContext | AstroGlobal): Env {
  const runtimeEnv = (ctx.locals as App.Locals).runtime?.env as Env | undefined;
  if (runtimeEnv && runtimeEnv.PUBLIC_SUPABASE_URL) return runtimeEnv;

  // Fallback: read from process.env (Node dev) and import.meta.env (Vite-resolved publics).
  // process is `any` here because it isn't typed in the Workers runtime.
  const proc = (globalThis as any).process?.env ?? {};
  return {
    PUBLIC_SUPABASE_URL:
      import.meta.env.PUBLIC_SUPABASE_URL ?? proc.PUBLIC_SUPABASE_URL ?? "",
    PUBLIC_SUPABASE_ANON_KEY:
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? proc.PUBLIC_SUPABASE_ANON_KEY ?? "",
    SUPABASE_SERVICE_ROLE_KEY: proc.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: proc.ANTHROPIC_API_KEY ?? "",
    GEOCODIO_API_KEY: proc.GEOCODIO_API_KEY ?? "",
    PUBLIC_SITE_URL:
      import.meta.env.PUBLIC_SITE_URL ?? proc.PUBLIC_SITE_URL ?? "http://localhost:4321",
    ADMIN_EMAILS: proc.ADMIN_EMAILS,
  };
}

// True only when both Supabase env values are populated. Lets pages and
// middleware skip auth/db calls cleanly when running locally without .env.
export function isSupabaseConfigured(env: Env): boolean {
  return Boolean(env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY);
}

// Returns true if the email is in the comma-separated ADMIN_EMAILS env var.
// Case-insensitive. If ADMIN_EMAILS is empty/unset, no one is admin.
export function isAdminEmail(email: string | null | undefined, env: Env): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
