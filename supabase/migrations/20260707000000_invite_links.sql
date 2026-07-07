-- Discord-style shareable invite links.
-- A workspace manager creates a link (bound to a role, not an email); anyone
-- who opens the link and signs in can redeem it to join the workspace. Roles
-- exclude 'owner' — ownership is never handed out through a link.
-- Mirrors the workspace_invitations pattern (RLS keyed off workspace_role()
-- plus SECURITY DEFINER RPCs so a not-yet-member can resolve and redeem it).

create table if not exists public.invite_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- 32-char URL-safe token (uuid with dashes stripped); the shareable secret.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invite_links_workspace_idx
  on public.invite_links (workspace_id);

alter table public.invite_links enable row level security;

-- Only workspace managers manage their links. Non-members never read this table
-- directly — they resolve a link through invite_link_info() below.
create policy "managers can view invite links"
  on public.invite_links for select
  to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'));

create policy "managers can create invite links"
  on public.invite_links for insert
  to authenticated
  with check (
    public.workspace_role(workspace_id) in ('owner', 'admin')
    and created_by = auth.uid()
  );

create policy "managers can revoke invite links"
  on public.invite_links for delete
  to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'));

-- Resolve a link token to the workspace name + role for the /join landing page.
-- SECURITY DEFINER so a not-yet-member (workspace_role() is null) — or even a
-- signed-out visitor — can read the workspace name. Also reports whether the
-- caller is already a member so the UI can offer "go to workspace" instead.
create or replace function public.invite_link_info(link_token text)
returns table (
  workspace_id uuid,
  workspace_name text,
  role text,
  already_member boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.workspace_id,
    w.name,
    l.role,
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = l.workspace_id and m.user_id = auth.uid()
    )
  from public.invite_links l
  join public.workspaces w on w.id = l.workspace_id
  where l.token = link_token
$$;

-- Redeem a link: add the caller to the workspace with the link's role.
-- SECURITY DEFINER to bypass the member-insert policy (the joiner has no role
-- in the workspace yet). Idempotent — re-redeeming keeps the existing role and
-- just returns the workspace id.
create or replace function public.redeem_invite_link(link_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lnk public.invite_links;
begin
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  select * into lnk from public.invite_links where token = link_token;
  if not found then
    raise exception 'invite link not found';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (lnk.workspace_id, auth.uid(), lnk.role)
  on conflict (workspace_id, user_id) do nothing;

  return lnk.workspace_id;
end;
$$;
