-- Phase 4: workspace invitations.
-- A manager invites by email; the invitee accepts from /invitations after
-- logging in with that email. Roles exclude 'owner' — ownership is never
-- transferred through an invite.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  invited_by uuid references public.user_profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

-- At most one pending invite per (workspace, email), case-insensitive.
create unique index if not exists workspace_invitations_unique_pending
  on public.workspace_invitations (workspace_id, lower(email))
  where status = 'pending';

create index if not exists workspace_invitations_email_idx
  on public.workspace_invitations (lower(email));

alter table public.workspace_invitations enable row level security;

-- Managers see every invite for their workspace; an invitee sees invites
-- addressed to their own email (matched against the JWT email claim).
create policy "managers and invitees can view invitations"
  on public.workspace_invitations for select
  to authenticated
  using (
    public.workspace_role(workspace_id) in ('owner', 'admin')
    or lower(email) = lower(auth.jwt() ->> 'email')
  );

create policy "managers can send invitations"
  on public.workspace_invitations for insert
  to authenticated
  with check (
    public.workspace_role(workspace_id) in ('owner', 'admin')
    and invited_by = auth.uid()
    and status = 'pending'
  );

create policy "managers can cancel invitations"
  on public.workspace_invitations for delete
  to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'));

-- Pending invitations addressed to the current user, with the workspace name
-- for display. SECURITY DEFINER so the invitee (not yet a member, so
-- workspace_role() is null) can still read the workspace name.
create or replace function public.my_invitations()
returns table (
  id uuid,
  workspace_id uuid,
  workspace_name text,
  role text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.workspace_id, w.name, i.role, i.created_at
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.status = 'pending'
    and lower(i.email) = lower(auth.jwt() ->> 'email')
  order by i.created_at desc
$$;

-- Accept an invitation: add the caller as a member and mark it accepted.
-- SECURITY DEFINER to bypass the member-insert policy (the invitee has no
-- role in the workspace yet).
create or replace function public.accept_invitation(invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.workspace_invitations;
begin
  select * into inv from public.workspace_invitations
  where id = invitation_id
    and status = 'pending'
    and lower(email) = lower(auth.jwt() ->> 'email');
  if not found then
    raise exception 'invitation not found';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations
  set status = 'accepted'
  where id = invitation_id;

  return inv.workspace_id;
end;
$$;

-- Decline an invitation addressed to the current user.
create or replace function public.decline_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workspace_invitations
  set status = 'declined'
  where id = invitation_id
    and status = 'pending'
    and lower(email) = lower(auth.jwt() ->> 'email');
end;
$$;
