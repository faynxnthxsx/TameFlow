-- Phase 6: task comments.
-- Comments belong to a task; workspace_id is denormalized from the parent task
-- (via trigger) so RLS can call workspace_role() without a join, like
-- task_checklist_items. Contributors (owner/admin/member, not viewers) may
-- comment; the author or a manager may delete.

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id uuid not null references public.user_profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx
  on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;

-- Denormalize workspace_id from the parent task; clients never send it.
create or replace function public.comment_sync_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select workspace_id into new.workspace_id
  from public.tasks
  where id = new.task_id;
  return new;
end;
$$;

create trigger task_comments_sync_workspace
  before insert on public.task_comments
  for each row
  execute function public.comment_sync_workspace();

create policy "members can view comments"
  on public.task_comments for select
  to authenticated
  using (public.workspace_role(workspace_id) is not null);

create policy "contributors can add comments"
  on public.task_comments for insert
  to authenticated
  with check (
    public.workspace_role(workspace_id) in ('owner', 'admin', 'member')
    and author_id = auth.uid()
  );

create policy "authors and managers can delete comments"
  on public.task_comments for delete
  to authenticated
  using (
    author_id = auth.uid()
    or public.workspace_role(workspace_id) in ('owner', 'admin')
  );
