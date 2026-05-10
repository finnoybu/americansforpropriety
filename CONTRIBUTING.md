# Contributing to Americans for Propriety

Thank you for thinking about helping. This is a small civic project with a deliberately small surface area, and outside contributions are not just welcome — they're a real part of how the project stays alive and accurate. **The single most useful thing most people can do is fix a thing that's wrong.**

This document covers how. It's longer than it needs to be because we've tried to make the no-fork path obvious for non-developers and the full-fork path concrete for people writing code or content.

## Code of conduct

We follow the [Contributor Covenant](.github/CODE_OF_CONDUCT.md). The short version: be respectful of people and rigorous about claims. Bad-faith argument, harassment, or personal attacks get you removed. Disagreement on the merits is fine and expected.

## Where to start

Before you do anything else, **search [open issues](https://github.com/finnoybu/americansforpropriety/issues)** to see whether your idea, fix, or report is already in flight. If it's not, open a new one.

Three rough categories of contribution, in roughly increasing effort:

1. **Reporting** — file an issue. No fork, no code. ~2 minutes.
2. **Editing** — propose a change to a single file. Web-based fork on GitHub works fine. ~10 minutes.
3. **Building** — clone the repo, run it locally, change multiple files, run checks, open a PR. Standard contributor flow. 30 minutes to multiple hours.

Each is described below.

---

## Reporting (no fork required)

If you spot something wrong or have a clear suggestion, file an issue. We have templates for the common cases:

- **Factual correction** — a brief, issue page, or news post is wrong about a fact, a quote, a bill number, a vote count, a status. [Open a correction issue](https://github.com/finnoybu/americansforpropriety/issues/new?template=correction.md).
- **Suggestion** — a brief topic we should cover, a letter template we should add, a bill we should be tracking, a state-level pattern worth surfacing. [Open a suggestion issue](https://github.com/finnoybu/americansforpropriety/issues/new?template=suggestion.md).
- **Bug** — a page renders wrong, a link is broken, a feature doesn't work. [Open a bug](https://github.com/finnoybu/americansforpropriety/issues/new?template=bug.md).
- **Accessibility** — a barrier you've encountered using the site. [Open an accessibility issue](https://github.com/finnoybu/americansforpropriety/issues/new?template=accessibility.md), or email <accessibility@americansforpropriety.org> if you'd rather not file publicly.

Issues are read by a person within five business days. Corrections are typically fixed within two.

---

## Editing (web-based fork)

If you want to propose the actual change yourself but don't want to set up a local development environment, GitHub's web interface works fine for any single-file change.

1. Navigate to the file you want to edit on GitHub (e.g., `src/content/issues/healthcare.md`).
2. Click the pencil icon ("Edit this file"). GitHub will offer to fork the repo into your account if you don't already have one.
3. Make your changes in the web editor.
4. Scroll to the bottom and write a short description of what changed and why.
5. Choose "Create a new branch for this commit and start a pull request."
6. Submit the PR.

This is the right path for typo fixes, factual corrections, adding a missing source URL, adding a `state:` field to a state bill, updating a status field, and similar small, single-file edits.

---

## Building (clone and contribute locally)

For changes that touch multiple files, add new components, or modify the site's behavior, run the project locally.

### Prerequisites

- **Node.js 20** or newer (Astro 5 requires 20.3+, 22+ recommended). Use [`nvm`](https://github.com/nvm-sh/nvm), [`fnm`](https://github.com/Schniz/fnm), or [Volta](https://volta.sh) to manage versions.
- **Git**.
- **A GitHub account.**

You do *not* need: a Cloudflare D1 binding, a `BETTER_AUTH_SECRET`, AWS credentials, an Anthropic API key, or a Geocodio key, unless you're working on member-account features or the AI drafting tools specifically. The site degrades gracefully when those services aren't configured — every page that needs auth/DB checks `isDbConfigured()` first.

### Fork and clone

```bash
# Fork the repo on GitHub first, then:
git clone https://github.com/<your-username>/americansforpropriety.git
cd americansforpropriety
git remote add upstream https://github.com/finnoybu/americansforpropriety.git
```

### Install and run

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:4321` by default (or the next available port). Edits hot-reload.

### Optional: environment variables

If you want to work on member-facing features, copy the example file and fill in your own keys:

```bash
cp .env.example .env  # if .env.example exists; otherwise create .env
```

Variables the site reads (all optional unless noted):

- `BETTER_AUTH_SECRET` — required for member auth (any 32+ byte random string for local dev; production uses a secret stored in Cloudflare). Generate one with `openssl rand -base64 32`.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `EMAIL_FROM` — required if you want magic-link emails to actually send via AWS SES. Without them, the auth library logs the magic-link URL to the server console so you can copy it manually for local testing.
- The D1 database itself is bound via `wrangler.toml` (no env var). For local dev with `wrangler pages dev`, run `npm run db:migrate:local` to apply migrations to the local D1 emulator.
- `ANTHROPIC_API_KEY` — required for the AI brief drafter at `/admin/briefs` (admin-only). The letter side of the toolkit doesn't use AI — letters are hand-written templates with client-side placeholder substitution.
- `GEOCODIO_API_KEY` — required for ZIP-to-representative lookups.
- `ADMIN_EMAILS` — comma-separated list of emails treated as admin.
- `PUBLIC_SITE_URL` — base URL for OG/canonical tags. Defaults sensibly.

You can ignore all of these unless your change touches the corresponding feature.

### Run checks

Before opening a PR, run:

```bash
npx astro check
```

This is the type-checker and content-schema validator. It must pass with **0 errors**. Warnings should be addressed if you introduced them; pre-existing ones are tracked separately.

If your change touches CSS or layout, also start the dev server and verify the page works in both light and dark mode (toggle is in the header). Verify keyboard navigation hasn't broken — Tab through the page; focus must stay visible.

### Commit and PR

```bash
git checkout -b descriptive-branch-name
# make changes
git add <files>
git commit -m "Concise summary of the change"
git push origin descriptive-branch-name
```

Open the PR on GitHub. Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md) — it asks you to describe what changed, why, and how you tested it.

---

## Code conventions

- **Astro components** in `src/components/`. Keep them small, single-purpose, and prop-typed.
- **Pages** in `src/pages/`. Each `.astro` file is a route.
- **Content** in `src/content/{issues,briefs,letters,actions,posts}/`. Schemas live in `src/content.config.ts` — match them.
- **Styling**: Tailwind v4 with our brand tokens. Use canonical utilities (`text-ink`, `bg-paper`, `border-rule`) — *do not* use arbitrary values like `bg-[var(--color-paper)]` or `text-[#0E1B33]`. The brand tokens are defined in `src/styles/global.css` under `@theme`. If you need a new shade, add it as a token first.
- **No emojis** in shipped UI text or content unless explicitly requested in the issue. The brand voice is editorial, not casual.
- **No inline analytics, telemetry, or third-party trackers.** Ever. This is a hard constraint of the project per [Principle 05](https://americansforpropriety.org/principles).
- **Comments**: write them only when the *why* is non-obvious. Don't narrate the *what* — well-named code does that.

---

## Content conventions

Content lives in MDX/Markdown files with structured frontmatter. Each collection has a Zod schema in `src/content.config.ts` — read it before adding new entries. Below are the practical fields per collection.

### Briefs (`src/content/briefs/`)

```yaml
---
title: "Short, declarative — what's the brief about?"
summary: "One- or two-sentence editorial summary. Shows on cards and OG previews."
issue: "issue-slug"             # must match an existing issue slug
publishedAt: 2026-05-10          # ISO date
authors: ["Editorial team"]      # array; "Editorial team" for unbylined work
readingMinutes: 6                # honest estimate
draft: false                     # true to hide from listings
---
```

Body: structure with `## Sections`. Source every factual claim. Link to primary records (bill texts, court opinions, agency rulemakings) where they exist. Cite secondary reporting when you're relying on a journalist's investigation.

### Issues (`src/content/issues/`)

These are the long-running issue cluster pages. The frontmatter is rich; see an existing file (e.g., `src/content/issues/labor-and-wages.md`) for a complete example. Key fields:

- `title`, `short`, `eyebrow`, `summary`, `headline`, `stance`
- `accent`: `coral | gold | leaf | ink`
- `pillars: [{ title, body }]` — three-card "where we plant our flag" section
- `facts: [string]` — discrete factual claims, one per bullet
- `subtopics: [{ slug, title, summary, body }]` — the big middle section
- `keyBills: [{ name, chamber, state?, summary, status }]` — for state bills, include the optional `state` field so the search link is more specific
- `glossary: [{ term, definition }]`
- `whoAffected: string` — long-form prose, paragraph-separated by blank lines
- `timeline: [{ date, event }]`

### Letters (`src/content/letters/`)

```yaml
---
title: "Subject line of the letter, declarative"
summary: "What the letter asks the recipient to do."
audience: "US Senator"           # exact label as displayed
issue: "issue-slug"
updatedAt: 2026-05-10
---
```

Body: the letter template itself. Use Markdown. Include placeholders in `[brackets]` for personalization fields. **Templates are templates** — they should be designed for the constituent to personalize, not blast unmodified. See [Editorial standards](https://americansforpropriety.org/editorial-standards) §06.

### Actions (`src/content/actions/`)

```yaml
---
title: "Verb-led action title"
summary: "What the reader does and why."
issue: "issue-slug"
cta: "Call your senator"          # button label
href: "/letters/relevant-letter"  # what the button links to
urgency: "high" | "medium" | "low"
expiresAt: 2026-12-31              # optional; auto-hide after this date (future feature)
---
```

### News posts (`src/content/posts/`)

```yaml
---
title: "Editorial title"
summary: "One-sentence summary"
publishedAt: 2026-05-10
authors: ["Editorial team"]
tags: ["scotus", "voting-rights"]   # lowercase, hyphenated; used by the topic filter
draft: false
---
```

Body: long-form post. Use `## Sections` for structure. Cite sources inline.

---

## Editorial review

Content PRs go through editorial review before merge. We check sourcing, framing, and consistency with the project's stated standards. This is not gatekeeping — it's the same standard our own drafts go through. Expect:

- A request for a citation if a factual claim doesn't have one.
- A push to soften framing that reads more polemical than substantive.
- A push to *strengthen* framing that reads vague when the underlying evidence is clear.
- Suggestions on structure, length, and headline phrasing.

Reviewers will tell you if a piece needs significant rework or if it's a non-fit (off-topic, advocacy without sourcing, etc.). We aim to give first-pass review within seven business days.

---

## Disclosing AI assistance

If you used a large language model to draft any part of your contribution — code or content — say so in the PR description. We're not opposed to AI-assisted work; we use it ourselves and disclose it on AI-drafted briefs. We just need to know so reviewers can apply the same scrutiny we apply to our own AI drafts.

This is not an excuse to ship sloppy work. The author of a PR is responsible for the contents of the PR, regardless of which tool generated the first draft.

---

## Conflicts of interest

If you have a personal, professional, or financial relationship that could reasonably create a conflict on the piece you're contributing — a family member at the agency in question, recent paid work for an advocacy group quoted in the piece, a financial interest in a company affected — disclose it in the PR description. We'll figure out together whether the conflict is one we can manage with disclosure, one that requires a different reviewer, or one that means the piece needs a different author.

---

## License

Code in this repository is licensed under the MIT License — see [LICENSE](LICENSE). By submitting a PR you agree to license your code contribution under the same terms.

**Content** (briefs, issues, letter templates, news posts) is © Americans for Propriety and is licensed under the site's [Terms of Use](https://americansforpropriety.org/terms), not the MIT License. Content contributions, by being submitted, are licensed to the project under the same terms. You retain the right to credit and to a byline.

---

## Questions

- **About contributing in general** — open a [Discussion](https://github.com/finnoybu/americansforpropriety/discussions) (preferred) or email <hello@americansforpropriety.org>.
- **About a specific issue or PR** — comment on the issue or PR.
- **About something private** (security, conflict of interest, sensitive correction) — email the relevant address from the [Contact page](https://americansforpropriety.org/contact).

Thank you, again, for any help you give. The site is better because people outside our small editorial team take the time to read it, push back on it, and fix what's wrong.
