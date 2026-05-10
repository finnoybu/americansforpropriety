import { drizzle } from "drizzle-orm/d1";
import type { APIContext, AstroGlobal } from "astro";
import * as schema from "./schema";

// Returns a Drizzle client wrapping the D1 binding for the request context.
// Cloudflare exposes the binding via Astro.locals.runtime.env.DB.
export function getDb(ctx: APIContext | AstroGlobal) {
  const env = (ctx.locals as App.Locals).runtime?.env;
  if (!env?.DB) {
    throw new Error(
      "D1 binding `DB` not found on runtime env. Make sure wrangler.toml " +
        "declares the binding and the Pages project has it bound.",
    );
  }
  return drizzle(env.DB as D1Database, { schema });
}

// Returns true if the D1 binding is available. Useful for graceful no-op
// in dev when the local D1 hasn't been initialized.
export function isDbConfigured(ctx: APIContext | AstroGlobal): boolean {
  const env = (ctx.locals as App.Locals).runtime?.env;
  return Boolean(env?.DB);
}

export { schema };
export type Db = ReturnType<typeof getDb>;
