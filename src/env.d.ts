/// <reference path="../.astro/types.d.ts" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ANTHROPIC_API_KEY: string;
  GEOCODIO_API_KEY: string;
  PUBLIC_SITE_URL?: string;
  ADMIN_EMAILS?: string;
}

declare namespace App {
  interface Locals extends Runtime {
    user: {
      id: string;
      email: string;
    } | null;
    profile: {
      id: string;
      zip: string | null;
      state: string | null;
      congressional_district: string | null;
      state_legislative_lower_district: string | null;
      state_legislative_upper_district: string | null;
      display_name: string | null;
    } | null;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_SITE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
