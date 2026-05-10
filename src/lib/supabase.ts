import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { APIContext, AstroGlobal } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

type Ctx = APIContext | AstroGlobal;

// SSR Supabase client. Reads cookies off the request, writes auth cookies via
// Astro.cookies. Use this in middleware, API routes, and .astro frontmatter.
export function getSupabase(ctx: Ctx): SupabaseClient {
  const env = getEnv(ctx);
  const cookies = ctx.cookies;
  const requestCookieHeader = ctx.request.headers.get("cookie") ?? "";

  return createServerClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(requestCookieHeader);
      },
      setAll(toSet: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value, options } of toSet) {
          cookies.set(name, value, asAstroCookieOptions(options));
        }
      },
    },
  });
}

// Service-role client. Bypasses RLS. Use ONLY in admin endpoints, after the
// admin gate has confirmed the caller. Never return the client to a request
// that hasn't been gated.
export function getSupabaseService(ctx: Ctx): SupabaseClient {
  const env = getEnv(ctx);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  return createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseCookieHeader(header: string): { name: string; value: string }[] {
  if (!header) return [];
  return header
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const eq = c.indexOf("=");
      const name = eq === -1 ? c : c.slice(0, eq);
      const raw = eq === -1 ? "" : c.slice(eq + 1);
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        // leave as-is
      }
      return { name, value };
    });
}

function asAstroCookieOptions(o: CookieOptions = {}) {
  return {
    domain: o.domain,
    expires: o.expires,
    httpOnly: o.httpOnly,
    maxAge: o.maxAge,
    path: o.path ?? "/",
    sameSite: (o.sameSite ?? "lax") as "lax" | "strict" | "none",
    secure: o.secure ?? true,
  };
}
