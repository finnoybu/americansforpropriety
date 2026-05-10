/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
  // Cloudflare bindings
  DB: D1Database;

  // Better Auth
  BETTER_AUTH_SECRET: string;

  // Outbound email
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;

  // AI / lookup services
  ANTHROPIC_API_KEY: string;
  GEOCODIO_API_KEY: string;

  // Site config
  PUBLIC_SITE_URL?: string;
  ADMIN_EMAILS?: string;
}

declare namespace App {
  interface Locals extends Runtime {
    user: {
      id: string;
      email: string;
      name: string | null;
    } | null;
    profile: {
      userId: string;
      zip: string | null;
      state: string | null;
      city: string | null;
      congressionalDistrict: string | null;
      stateLegislativeLowerDistrict: string | null;
      stateLegislativeUpperDistrict: string | null;
      displayName: string | null;
    } | null;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
