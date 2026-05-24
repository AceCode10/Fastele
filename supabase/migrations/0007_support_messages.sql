-- Support messages: user → admin contact form (Help screen).

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_messages_status_idx on public.support_messages (status, created_at desc);
create index if not exists support_messages_user_idx on public.support_messages (user_id, created_at desc);

alter table public.support_messages enable row level security;

-- User can insert their own messages + read their own history.
drop policy if exists support_self_insert on public.support_messages;
create policy support_self_insert on public.support_messages
  for insert with check (auth.uid() = user_id);

drop policy if exists support_self_read on public.support_messages;
create policy support_self_read on public.support_messages
  for select using (auth.uid() = user_id or public.is_admin());

-- Admin can update (resolve, add notes).
drop policy if exists support_admin_update on public.support_messages;
create policy support_admin_update on public.support_messages
  for update using (public.is_admin()) with check (public.is_admin());

-- Realtime for admin live view.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.support_messages';
  end if;
end $$;
