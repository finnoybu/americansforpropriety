-- Americans for Propriety — initial schema
--
-- Three tables:
--   profiles            — extends auth.users with civic locale (district, etc.)
--   action_log          — what a member has done (sent letter, made call, etc.)
--   generated_letters   — drafts produced by the letter generator
--
-- RLS is on for all three. Members can only see/edit their own rows.

create extension if not exists "pgcrypto";

-- =============================================================================
-- profiles
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  zip text,
  state text,
  city text,
  congressional_district text,
  state_legislative_lower_district text,
  state_legislative_upper_district text,
  representatives_cache jsonb,        -- last Geocodio lookup result, normalized
  representatives_cached_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists profiles_state_idx on public.profiles(state);

-- =============================================================================
-- action_log
-- =============================================================================
create table if not exists public.action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in (
    'sent_letter','made_call','submitted_testimony','attended_event','signed_petition','other'
  )),
  issue_slug text,
  representative_name text,
  representative_office text,
  topic text,
  notes text,
  generated_letter_id uuid,           -- soft link, allows pruning the letter while keeping the action
  occurred_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

create index if not exists action_log_user_idx on public.action_log(user_id, occurred_at desc);

-- =============================================================================
-- generated_letters
-- =============================================================================
create table if not exists public.generated_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  representative_name text,
  representative_office text,
  topic text,
  stance text,                        -- 'support','oppose','ask_for_position','other'
  body text not null,
  issue_slug text,
  used_web_search boolean default false,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz default now() not null
);

create index if not exists generated_letters_user_idx
  on public.generated_letters(user_id, created_at desc);

-- =============================================================================
-- updated_at trigger
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- =============================================================================
-- new-user trigger: create a profile row when a user signs up
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.action_log enable row level security;
alter table public.generated_letters enable row level security;

-- profiles: a user can read/insert/update their own row only
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles self upsert" on public.profiles;
create policy "profiles self upsert" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

-- action_log: own rows only
drop policy if exists "action_log self all" on public.action_log;
create policy "action_log self all" on public.action_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- generated_letters: own rows only
drop policy if exists "letters self all" on public.generated_letters;
create policy "letters self all" on public.generated_letters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- per-user rate limit helper (used by /api/letters/generate)
-- =============================================================================
create or replace function public.recent_letter_count(window_minutes int default 60)
returns int language sql security definer set search_path = public as $$
  select count(*)::int
  from public.generated_letters
  where user_id = auth.uid()
    and created_at > now() - (window_minutes || ' minutes')::interval
$$;
