-- Phase 5: task checklists (subtasks).
-- Checklist items belong to a task; workspace_id is denormalized from the
-- parent task (via trigger) so RLS can call workspace_role() without a join,
-- exactly like tasks does from projects. Edit rights mirror canEditTask() in
-- app/utils/permissions.ts through the can_edit_task() helper below.

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 200),
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists task_checklist_items_task_id_idx
  on public.task_checklist_items (task_id);

alter table public.task_checklist_items enable row level security;

-- Denormalize workspace_id from the parent task; clients never send it.
create or replace function public.checklist_sync_workspace()
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

create trigger task_checklist_items_sync_workspace
  before insert or update of task_id on public.task_checklist_items
  for each row
  execute function public.checklist_sync_workspace();

-- Whether the caller may edit a given task — mirrors canEditTask() in
-- app/utils/permissions.ts (owner/admin edit any task, members only their
-- own). security definer so it can read tasks.created_by without recursing
-- into RLS.
create or replace function public.can_edit_task(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select public.workspace_role(t.workspace_id) in ('owner', 'admin')
        or (
          public.workspace_role(t.workspace_id) = 'member'
          and t.created_by = auth.uid()
        )
      from public.tasks t
      where t.id = t_id
    ),
    false
  )
$$;

-- Any workspace member can view checklist items; only those who can edit the
-- parent task may add, toggle, or remove them.
create policy "members can view checklist items"
  on public.task_checklist_items for select
  to authenticated
  using (public.workspace_role(workspace_id) is not null);

create policy "task editors can add checklist items"
  on public.task_checklist_items for insert
  to authenticated
  with check (public.can_edit_task(task_id));

create policy "task editors can update checklist items"
  on public.task_checklist_items for update
  to authenticated
  using (public.can_edit_task(task_id))
  with check (public.can_edit_task(task_id));

create policy "task editors can delete checklist items"
  on public.task_checklist_items for delete
  to authenticated
  using (public.can_edit_task(task_id));
