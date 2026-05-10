-- AI-drafted briefs.
--
-- Lives alongside the static src/content/briefs/ collection. Drafts are produced
-- by the letter-generator infrastructure (extended for briefs), reviewed by an
-- admin in /admin/briefs, and published from there. Public /briefs index merges
-- both sources.

create table if not exists public.ai_briefs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  issue text not null,
  body text not null,                    -- markdown
  status text not null default 'draft' check (status in ('draft','published','archived')),
  used_web_search boolean default true,
  model text,
  input_tokens integer,
  output_tokens integer,
  reading_minutes int default 6,
  authors text[] default array[]::text[],
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists ai_briefs_status_idx
  on public.ai_briefs(status, published_at desc);
create index if not exists ai_briefs_issue_idx
  on public.ai_briefs(issue, status);

drop trigger if exists ai_briefs_touch_updated_at on public.ai_briefs;
create trigger ai_briefs_touch_updated_at
before update on public.ai_briefs
for each row execute function public.touch_updated_at();

-- RLS:
--   - Anyone can SELECT published briefs (public reading).
--   - Authenticated admins (gated in app code via env-based allowlist) can do everything.
--     The migration enforces RLS but the app layer is the admin gate; service-role
--     access is used by the admin endpoints to bypass RLS.
alter table public.ai_briefs enable row level security;

drop policy if exists "ai_briefs public read published" on public.ai_briefs;
create policy "ai_briefs public read published" on public.ai_briefs
  for select using (status = 'published');
