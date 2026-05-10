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
- **Members** (signed in): get the personalized toolkit — rep lookup by ZIP, hand-written letter templates that auto-personalize for the right representative when picked, and a private action log of letters they've sent. Members give us their email and ZIP. We store the district and the actions they log. Nothing else. Member tooling never sends anything on the user's behalf.

---

## Stack

- [Astro 5](https://astro.build) — static-first, with selective SSR for member pages and API routes
- [Cloudflare Pages](https://pages.cloudflare.com) — deploy target via `@astrojs/cloudflare`
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — SQLite at the edge; member accounts, action log, generated letters, AI brief drafts
- [Better Auth](https://www.better-auth.com/) + [Drizzle ORM](https://orm.drizzle.team/) — magic-link sessions and type-safe queries
- [AWS SES](https://aws.amazon.com/ses/) — outbound magic-link email (signed via [`aws4fetch`](https://github.com/mhart/aws4fetch))
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

You don't strictly *need* any keys to run the dev server — visitor-facing pages work without them. To exercise the member toolkit locally, fill in `BETTER_AUTH_SECRET`, the `AWS_*` variables (or skip them and copy the magic-link URL from the server console — the auth library logs it when SES isn't configured), `ANTHROPIC_API_KEY`, and `GEOCODIO_API_KEY`. See `.env.example`.

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
    auth.ts                  Better Auth server config (magic-link + AWS SES)
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
      admin/briefs/          Brief drafting + edit endpoints
    member/                  Authenticated UI: dashboard, setup, reps, actions
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

### 3. AWS SES (outbound email)

1. Create or sign in to an AWS account at <https://aws.amazon.com>.
2. In the SES console (us-east-1 recommended), create a Domain identity for `americansforpropriety.org` with Easy DKIM. Paste the three CNAME records SES generates into Cloudflare DNS (DNS-only, not proxied). Wait for DKIM verification.
3. Submit a "Request production access" form from the SES Account dashboard. Approval is typically same-day.
4. In IAM, create a user with `AmazonSESFullAccess` (or scoped to `ses:SendEmail`). Generate access keys.
5. Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION=us-east-1`, and `EMAIL_FROM="Americans for Propriety <hello@americansforpropriety.org>"`.

The same AWS account can verify additional domains (other Finnoybu projects, etc.); each gets its own DKIM CNAMEs but shares the IAM user / production-access status.

### 4. Anthropic (Claude API)

1. Create an API key at <https://console.anthropic.com>
2. Set `ANTHROPIC_API_KEY=sk-ant-...`

Used by the AI brief drafter at `/admin/briefs` (admin-only, low volume). Defaults to `claude-opus-4-7` with web search enabled per request. The on-demand letter generator was removed in favor of hand-written templates with placeholder substitution, so the API key is only needed if you intend to use the brief drafter.

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
   - `AWS_ACCESS_KEY_ID` (encrypted)
   - `AWS_SECRET_ACCESS_KEY` (encrypted)
   - `AWS_REGION` (plain text, e.g. `us-east-1`)
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
- **No "send on behalf of."** Letter templates personalize client-side and the result is copied to the member's clipboard; the site never transmits anything outbound to a representative on the member's behalf. Logging that you sent something is a separate, voluntary button click.
- **No data sales, no third-party sharing.** Period.

---

## License

MIT for code (see [LICENSE](LICENSE)). Editorial content is © Americans for Propriety and is governed by the site's [Terms of Use](https://americansforpropriety.org/terms).
