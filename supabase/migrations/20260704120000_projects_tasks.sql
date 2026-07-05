-- Phase 3: projects + tasks.
-- Task status/priority values must stay in sync with app/utils/tasks.ts,
-- and priority names match the --tf-color-priority-* theme tokens.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  created_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_workspace_id_idx
  on public.projects (workspace_id);

alter table public.projects enable row level security;

create trigger projects_touch_updated_at
  before update on public.projects
  for each row
  execute function public.touch_updated_at();

create policy "members can view projects"
  on public.projects for select
  to authenticated
  using (public.workspace_role(workspace_id) is not null);

create policy "managers can create projects"
  on public.projects for insert
  to authenticated
  with check (
    public.workspace_role(workspace_id) in ('owner', 'admin')
    and created_by = auth.uid()
  );

create policy "managers can update projects"
  on public.projects for update
  to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'));

create policy "managers can delete projects"
  on public.projects for delete
  to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'));

-- tasks.workspace_id is denormalized from the project so RLS policies can
-- call workspace_role() directly (no join, no RLS recursion). The trigger
-- below keeps it correct; clients never send it.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  assignee_id uuid references public.user_profiles (id) on delete set null,
  due_date date,
  created_by uuid references public.user_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_workspace_id_idx on public.tasks (workspace_id);

alter table public.tasks enable row level security;

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row
  execute function public.touch_updated_at();

create or replace function public.tasks_sync_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select workspace_id into new.workspace_id
  from public.projects
  where id = new.project_id;
  return new;
end;
$$;

create trigger tasks_sync_workspace
  before insert or update of project_id on public.tasks
  for each row
  execute function public.tasks_sync_workspace();

-- Task policies mirror resolveCapabilities() in app/utils/permissions.ts:
-- owner/admin edit and delete anything, members create and edit their own,
-- viewers read only.
create policy "members can view tasks"
  on public.tasks for select
  to authenticated
  using (public.workspace_role(workspace_id) is not null);

create policy "contributors can create tasks"
  on public.tasks for insert
  to authenticated
  with check (
    public.workspace_role(workspace_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

create policy "managers edit any task, members their own"
  on public.tasks for update
  to authenticated
  using (
    public.workspace_role(workspace_id) in ('owner', 'admin')
    or (
      public.workspace_role(workspace_id) = 'member'
      and created_by = auth.uid()
    )
  );

create policy "managers can delete tasks"
  on public.tasks for delete
  to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'admin'));
