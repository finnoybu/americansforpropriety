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
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — SQLite at the edge; member accounts, action log, generated letters, AI brief drafts
- [Better Auth](https://www.better-auth.com/) + [Drizzle ORM](https://orm.drizzle.team/) — magic-link sessions and type-safe queries
- [Resend](https://resend.com) — outbound magic-link email
- [Tailwind CSS 4](https://tailwindcss.com) — design tokens in `src/styles/global.css`
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

You don't strictly *need* any keys to run the dev server — visitor-facing pages work without them. To exercise the member toolkit locally, fill in `BETTER_AUTH_SECRET`, `RESEND_API_KEY` (or none, and copy the magic-link URL from the server console), `ANTHROPIC_API_KEY`, and `GEOCODIO_API_KEY`. See `.env.example`.

> **Windows note:** running `npm install` directly on Windows will strip Linux-only platform binaries from the lockfile and break Cloudflare's `npm ci` build. Always regenerate the lockfile through WSL: `npm run lock:wsl`.

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
  db/
    schema.ts                Drizzle schema (auth + app tables)
    index.ts                 getDb(ctx) — returns a Drizzle client over D1
  layouts/BaseLayout.astro
  components/                Header, Footer, Section, Logo, ThemeToggle, ...
  lib/
    auth.ts                  Better Auth server config (magic-link + Resend)
    auth-client.ts           Browser-side auth client
    anthropic.ts             Letter generation via Claude Messages API
    geocodio.ts              ZIP → reps lookup + normalization
    env.ts                   Env shim (dev .env / Cloudflare bindings)
  middleware.ts              Populates Astro.locals.user / .profile from session
  pages/
    api/
      auth/[...all].ts       Catch-all Better Auth handler
      me/                    Member-scoped writes (action log)
      reps/lookup            ZIP → reps + persist to profile
      letters/generate       Anthropic letter generator
      admin/briefs/          Brief drafting + edit endpoints
    member/                  Authenticated UI: dashboard, setup, reps, write, actions
    admin/briefs/            Editorial UI for the brief drafter
    signin.astro
    (issues|briefs|letters|news)/
    about.astro, principles.astro, take-action.astro, index.astro
migrations/
  0000_init.sql              Initial D1 schema
public/
  admin/                     Decap CMS mount
  favicon.svg, robots.txt, hero/
```

---

## Setup checklist

You need three external accounts plus the Cloudflare resources. Free tiers cover everything until you have meaningful traffic.

### 1. Cloudflare D1

```bash
wrangler d1 create americansforpropriety
```

Paste the returned `database_id` into `wrangler.toml`'s `[[d1_databases]]` block. Then apply migrations:

```bash
npm run db:migrate:local   # local D1 emulator
npm run db:migrate:prod    # production D1
```

### 2. Better Auth secret

Generate a 32-byte random secret for signing session tokens:

```bash
openssl rand -base64 32
```

Set as `BETTER_AUTH_SECRET` in `.env` for local dev and as an encrypted secret in Cloudflare Pages → Settings → Variables and Secrets for production.

### 3. Resend (outbound email)

1. Create an account at <https://resend.com>
2. Verify the sending domain (`americansforpropriety.org`) — add the DKIM/SPF records Resend provides to Cloudflare DNS
3. Create an API key
4. Set `RESEND_API_KEY=re_...` and `EMAIL_FROM="Americans for Propriety <hello@americansforpropriety.org>"`

### 4. Anthropic (Claude API)

1. Create an API key at <https://console.anthropic.com>
2. Set `ANTHROPIC_API_KEY=sk-ant-...`

The letter generator defaults to `claude-opus-4-7`. Web search is on by default per request and capped at 3 searches; rate-limited to 8 generations per user per hour at the application level.

### 5. Geocodio

1. Sign up at <https://www.geocod.io>
2. Create an API key (free tier: 2,500 lookups/day)
3. Set `GEOCODIO_API_KEY=...`

---

## Deploying to Cloudflare Pages

This is configured for Cloudflare Pages with Functions (the `@astrojs/cloudflare` adapter generates a `_worker.js` automatically).

### One-time

1. **Connect the repo** in the Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. **Build settings:**
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Bind D1** under Settings → Bindings: name `DB`, point at the `americansforpropriety` database created above.
4. **Environment variables** (Settings → Variables and Secrets → Production):
   - `BETTER_AUTH_SECRET` (encrypted)
   - `RESEND_API_KEY` (encrypted)
   - `EMAIL_FROM` (plain text)
   - `ANTHROPIC_API_KEY` (encrypted)
   - `GEOCODIO_API_KEY` (encrypted)
   - `PUBLIC_SITE_URL` (plain text, e.g. `https://americansforpropriety.org`)
   - `ADMIN_EMAILS` (plain text, comma-separated)
5. **Run production migrations** with `npm run db:migrate:prod` (requires `wrangler login` and the D1 database created in step 3).

### Every deploy

Push to the configured branch — Cloudflare builds and deploys automatically.

---

## Adding content

All editorial content lives in `src/content/<collection>/`. The schema for each collection is defined in `src/content.config.ts`; `astro check` will reject malformed frontmatter at build time.

Three ways to author:

1. **Direct git** — drop a `.md` or `.mdx` file in the right collection folder.
2. **Decap CMS** — visit `/admin` once `backend.repo` and OAuth are configured in `public/admin/config.yml`. For local CMS testing, run `npx decap-server` in one terminal and `npm run dev` in another, then go to `http://localhost:4321/admin`.
3. **AI-assisted authoring** — admins (set via `ADMIN_EMAILS`) can use the brief drafter at `/admin/briefs` to generate weekly research briefs from a topic and a news hook. Drafts are reviewed before publication.

---

## Privacy commitments enforced in code

These are not aspirational — they're how the system is built.

- **Member auth uses magic link only.** No password is stored. Better Auth manages session cookies; we read the session via `auth.api.getSession()` and clear it on signout.
- **No tracking on visitor pages.** Visitor pages are statically prerendered and ship no analytics scripts.
- **Member data ownership is enforced in app code.** Every query that reads or writes member-owned rows filters by `userId = session.user.id`. The schema has foreign keys to the Better Auth `user` table with `ON DELETE CASCADE` so deleting an account purges everything.
- **No "send on behalf of."** The letter generator returns text; the user copies it and sends it themselves. Logging that you sent something is a separate, voluntary button click.
- **Rate limits** on letter generation (8/hour/user, enforced via a Drizzle count query against `generated_letter`).
- **No data sales, no third-party sharing.** Period.

---

## License

MIT for code (see [LICENSE](LICENSE)). Editorial content is © Americans for Propriety and is governed by the site's [Terms of Use](https://americansforpropriety.org/terms).
