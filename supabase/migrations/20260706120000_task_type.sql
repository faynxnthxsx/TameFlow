-- Phase 6: task "type" (dev/design/test/other) powering the "task type" donut
-- on the company overview. Values must stay in sync with TASK_TYPES in
-- app/utils/tasks.ts. Adding a column needs no new RLS policy — the existing
-- task policies already gate every row.
alter table public.tasks
  add column if not exists type text not null default 'other'
  check (type in ('dev', 'design', 'test', 'other'));
