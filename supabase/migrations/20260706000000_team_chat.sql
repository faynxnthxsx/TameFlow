-- Team group chat (Messenger-style) — one shared conversation per workspace,
-- plus a per-team chat color. Follows the same RLS conventions as the rest of
-- the schema: access keyed off public.workspace_role(workspace_id).

-- Messages ----------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_workspace_created_idx
  on public.chat_messages (workspace_id, created_at);

alter table public.chat_messages enable row level security;

create policy "members can read chat"
  on public.chat_messages for select
  to authenticated
  using (public.workspace_role(workspace_id) is not null);

-- Viewers are read-only everywhere else, so they can read but not post here.
create policy "members can send chat"
  on public.chat_messages for insert
  to authenticated
  with check (
    public.workspace_role(workspace_id) in ('owner', 'admin', 'member')
    and user_id = auth.uid()
  );

create policy "authors and managers can delete chat"
  on public.chat_messages for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.workspace_role(workspace_id) in ('owner', 'admin')
  );

-- Per-team chat appearance (shared across the team, like a Messenger theme) --
create table if not exists public.workspace_chat_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  color text not null default '#2563eb' check (char_length(color) between 1 and 32),
  updated_at timestamptz not null default now()
);

alter table public.workspace_chat_settings enable row level security;

create trigger workspace_chat_settings_touch_updated_at
  before update on public.workspace_chat_settings
  for each row
  execute function public.touch_updated_at();

create policy "members can read chat settings"
  on public.workspace_chat_settings for select
  to authenticated
  using (public.workspace_role(workspace_id) is not null);

create policy "managers can set chat settings"
  on public.workspace_chat_settings for insert
  to authenticated
  with check (public.workspace_role(workspace_id) in ('owner', 'admin'));

create policy "managers can update chat settings"
  on public.workspace_chat_settings for update
  to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'))
  with check (public.workspace_role(workspace_id) in ('owner', 'admin'));

-- Live updates: add chat_messages to the Supabase realtime publication.
-- Guarded so re-running the migration is safe.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'chat_messages'
     ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
