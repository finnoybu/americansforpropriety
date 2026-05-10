# Americans for Propriety

A civic research and action project. Briefs that name the stakes, letters constituents can actually send, and a public record of what their representatives do with their votes.

> **Power with limits. Policy with purpose.**

---

## What this is

Americans for Propriety is a small civic project advancing public policy that respects democratic limits, serves the common good, and treats public power as a trust — not a tool of private fortune.

We do three things: research, drafting, record-keeping.

- **Research.** Short, sourced briefs on policy questions in front of US legislators. Written for constituents.
- **Drafting.** Letter and testimony templates, plus an AI-assisted drafting tool for members that generates personalized letters to specific representatives on specific topics.
- **Record-keeping.** Public summaries of what representatives are doing. Members get a private action log of what *they* have done.

### Visitors vs members

The site has two faces, on purpose.

- **Visitors** (anonymous): static research, briefs, and letter templates. No tracking, no analytics that identify individuals, no email forms, no cookies beyond what's needed to render a page.
- **Members** (signed in): get the personalized toolkit — rep lookup by ZIP, AI-drafted letters, and a private action log. Members give us their email and ZIP. We store the district, drafts, and actions. Nothing else. Member tooling never sends anything on the user's behalf.

---

## Stack

- [Astro 5](https://astro.build) — static-first, with selective SSR for member pages and API routes
- [Cloudflare Pages](https://pages.cloudflare.com) — deploy target via `@astrojs/cloudflare`
- [Tailwind CSS 4](https://tailwindcss.com) — design tokens in `src/styles/global.css`
- [Supabase](https://supabase.com) — Postgres + auth (magic link). Schema in `supabase/migrations/`
- [Anthropic Claude](https://www.anthropic.com) — letter generation; uses web search tool for "recent positions" grounding
- [Geocodio](https://www.geocod.io) — ZIP → state, congressional district, federal + state legislators
- [Decap CMS](https://decapcms.org) — git-based editing at `/admin` (mounted at `public/admin/`)

No tracking. No analytics. No third-party JS on visitor pages.

---

## Local development

```bash
npm install
cp .env.example .env       # then fill in keys
npm run dev                # http://localhost:4321
npm run build              # type-check + production build
npm run preview            # serves the production build via wrangler pages dev
```

You'll need `.env` populated with **at minimum** the Supabase, Anthropic, and Geocodio keys. See `.env.example`.

---

## Project structure

```
src/
  config/site.ts             Site name, nav, issue ordering
  content.config.ts          Content collection schemas (Zod)
  content/
    issues/                  Issue cluster pages
    briefs/                  Research briefs (MDX)
    letters/                 Constituent letter templates
    actions/                 Take-action items
    posts/                   News & field notes (MDX)
  layouts/BaseLayout.astro
  components/                Header, Footer, Section, IssueCard, PostCard, MemberNav, ...
  lib/
    supabase.ts              Server-side Supabase client + cookie adapter
    anthropic.ts             Letter generation via Claude Messages API
    geocodio.ts              ZIP → reps lookup + normalization
    env.ts                   Env shim (dev .env / Cloudflare bindings)
  middleware.ts              Populates Astro.locals.user / .profile from session
  pages/
    api/
      auth/                  Magic-link callback, signout
      me/                    Member-scoped writes (action log, locale)
      reps/lookup            ZIP → reps + persist to profile
      letters/generate       Anthropic letter generator
    member/                  Authenticated UI: dashboard, setup, reps, write, actions
    signin.astro
    (issues|briefs|letters|news)/
    about.astro, principles.astro, take-action.astro, index.astro
supabase/
  migrations/                SQL schema (profiles, action_log, generated_letters, RLS)
public/
  admin/                     Decap CMS mount
  favicon.svg, robots.txt
```

---

## Setup checklist

You need three external accounts. Free tiers cover everything until you have meaningful traffic.

### 1. Supabase

1. Create a project at https://supabase.com/dashboard
2. Run `supabase/migrations/20260509000001_init.sql` against the project (Dashboard → SQL Editor → New query → paste → run, or via the [Supabase CLI](https://supabase.com/docs/guides/cli)).
3. Configure auth:
   - Settings → Authentication → URL configuration: add `http://localhost:4321` and your production URL.
   - Settings → Authentication → Email templates → Magic Link: ensure the link uses `{{ .RedirectTo }}` so the `?next=` param passes through.
4. Copy `Project URL` → `PUBLIC_SUPABASE_URL`
5. Copy `anon` key → `PUBLIC_SUPABASE_ANON_KEY`
6. Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (only used by your local migration scripts; never bundled to the client)

### 2. Anthropic (Claude API)

1. Create an API key at https://console.anthropic.com
2. Set `ANTHROPIC_API_KEY=sk-ant-...`

The letter generator defaults to `claude-opus-4-7`. Web search is on by default per request and capped at 3 searches; rate-limited to 8 generations per user per hour at the API level.

### 3. Geocodio

1. Sign up at https://www.geocod.io
2. Create an API key (free tier: 2,500 lookups/day)
3. Set `GEOCODIO_API_KEY=...`

---

## Deploying to Cloudflare Pages

This is configured for Cloudflare Pages with Functions (the `@astrojs/cloudflare` adapter generates a `_worker.js` automatically).

### One-time

1. **Connect the repo** in the Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git
2. **Build settings:**
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Environment variables** (Settings → Environment variables → Production):
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` (mark as encrypted)
   - `GEOCODIO_API_KEY` (mark as encrypted)
   - `PUBLIC_SITE_URL` (e.g. `https://americansforpropriety.org`)
4. **Update Supabase** → Auth → URL configuration to include the production URL.
5. **Set the production site URL** in `astro.config.mjs` (`site:`), commit, push.

### Every deploy

Push to the configured branch — Cloudflare builds and deploys automatically.

---

## Adding content

All editorial content lives in `src/content/<collection>/`. The schema for each collection is defined in `src/content.config.ts`; `astro check` will reject malformed frontmatter at build time.

Three ways to author:

1. **Direct git** — drop a `.md` or `.mdx` file in the right collection folder.
2. **Decap CMS** — visit `/admin` once `backend.repo` and OAuth are configured in `public/admin/config.yml`. For local CMS testing, run `npx decap-server` in one terminal and `npm run dev` in another, then go to `http://localhost:4321/admin`.
3. **AI-assisted authoring** — for letter templates, members can use the in-product letter generator and a moderator can promote a generated letter into a public template by saving its body as a new file in `src/content/letters/`.

---

## Privacy commitments enforced in code

These are not aspirational — they're how the system is built.

- **Member auth uses magic link only.** No password is stored in our database. Supabase manages session tokens; we read the session via `@supabase/ssr` and clear it on signout.
- **No tracking on visitor pages.** Visitor pages are statically prerendered and ship no analytics scripts.
- **Member data is row-level-isolated** via Postgres RLS. The migration in `supabase/migrations/` enables RLS on `profiles`, `action_log`, and `generated_letters`, and policies restrict reads/writes to `auth.uid() = user_id`.
- **No "send on behalf of."** The letter generator returns text; the user copies it and sends it themselves. Logging that you sent something is a separate, voluntary button click.
- **Rate limits** on letter generation (8/hour/user, enforced via a Postgres function, not just client-side).
- **No data sales, no third-party sharing.** Period.

---

## License

MIT. Reuse and adapt freely; attribution appreciated; no endorsement implied.
