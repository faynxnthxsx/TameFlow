-- Migration to add support for updating chat messages

alter table public.chat_messages
add column if not exists updated_at timestamptz;

-- Add updated_at trigger if it doesn't already exist for this table
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'chat_messages_touch_updated_at') then
    create trigger chat_messages_touch_updated_at
      before update on public.chat_messages
      for each row
      execute function public.touch_updated_at();
  end if;
end $$;

-- Allow authors to edit their own messages
create policy "authors can update chat"
  on public.chat_messages for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
