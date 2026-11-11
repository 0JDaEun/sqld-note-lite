-- Already applied to the shared devlog-hub Supabase project.
create table if not exists public.sqld_note_snapshots (
 user_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null default '{"done":[],"answers":{}}'::jsonb,
 updated_at timestamptz not null default now(),
 constraint sqld_note_state_object check (jsonb_typeof(state)='object')
);
alter table public.sqld_note_snapshots enable row level security;
revoke all on table public.sqld_note_snapshots from public, anon;
grant select, insert, update on public.sqld_note_snapshots to authenticated;
create policy sqld_note_select_own on public.sqld_note_snapshots for select to authenticated using ((select auth.uid())=user_id);
create policy sqld_note_insert_own on public.sqld_note_snapshots for insert to authenticated with check ((select auth.uid())=user_id);
create policy sqld_note_update_own on public.sqld_note_snapshots for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
