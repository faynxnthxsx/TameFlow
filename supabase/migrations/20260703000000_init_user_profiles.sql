-- Phase 0: baseline schema — user_profiles (1:1 with auth.users)
-- Holds display info plus the DB-side sync target for language/theme
-- preferences (see app/composables/useTheme.ts, useLocalePreference.ts).

create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'th', 'ja')),
  preferred_theme text not null default 'corporate-blue'
    check (preferred_theme in ('corporate-blue', 'emerald-green', 'sunset-orange', 'purple-neon', 'dark-mode')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Any authenticated user can read basic profile info (needed to show
-- names/avatars of teammates across a shared workspace).
create policy "user_profiles are viewable by authenticated users"
  on public.user_profiles for select
  to authenticated
  using (true);

-- Users may only update their own profile row.
create policy "users can update their own profile"
  on public.user_profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Generic BEFORE UPDATE trigger to keep updated_at current. Reused by
-- later migrations on every mutable table.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_touch_updated_at
  before update on public.user_profiles
  for each row
  execute function public.touch_updated_at();

-- Auto-create a user_profiles row whenever a new auth.users row is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
