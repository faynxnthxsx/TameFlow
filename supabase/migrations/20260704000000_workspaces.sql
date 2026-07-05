-- Phase 2: workspaces + membership.
-- Roles here must stay in sync with WorkspaceRole in app/utils/permissions.ts.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  -- set null (not cascade): the workspace belongs to the team, it must
  -- survive the creator deleting their account.
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create trigger workspaces_touch_updated_at
  before update on public.workspaces
  for each row
  execute function public.touch_updated_at();

-- user_id references user_profiles (itself 1:1 with auth.users) so that
-- PostgREST can embed profile info when listing members.
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

-- Current user's role in a workspace. SECURITY DEFINER so policies on
-- workspaces/workspace_members can call it without recursing into RLS.
create or replace function public.workspace_role(ws_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = ws_id and user_id = auth.uid()
$$;

-- workspaces: no INSERT policy on purpose — creation goes through the
-- create_workspace() RPC below so the owner membership is written atomically.
create policy "members can view their workspaces"
  on public.workspaces for select
  to authenticated
  using (public.workspace_role(id) is not null);

create policy "owners can update their workspaces"
  on public.workspaces for update
  to authenticated
  using (public.workspace_role(id) = 'owner')
  with check (public.workspace_role(id) = 'owner');

create policy "owners can delete their workspaces"
  on public.workspaces for delete
  to authenticated
  using (public.workspace_role(id) = 'owner');

-- workspace_members: managers (owner/admin) run membership, except nobody
-- may touch an owner row and members may always remove themselves (leave).
create policy "members can view membership of their workspaces"
  on public.workspace_members for select
  to authenticated
  using (public.workspace_role(workspace_id) is not null);

create policy "managers can add members"
  on public.workspace_members for insert
  to authenticated
  with check (
    public.workspace_role(workspace_id) in ('owner', 'admin')
    and role <> 'owner'
  );

create policy "managers can update member roles"
  on public.workspace_members for update
  to authenticated
  using (
    public.workspace_role(workspace_id) in ('owner', 'admin')
    and role <> 'owner'
  )
  with check (role <> 'owner');

create policy "managers can remove members and members can leave"
  on public.workspace_members for delete
  to authenticated
  using (
    (
      public.workspace_role(workspace_id) in ('owner', 'admin')
      or user_id = auth.uid()
    )
    and role <> 'owner'
  );

-- Atomic create: workspace row + owner membership in one transaction.
create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.workspaces (name, created_by)
  values (workspace_name, auth.uid())
  returning id into new_id;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;
