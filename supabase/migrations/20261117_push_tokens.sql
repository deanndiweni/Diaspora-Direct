-- Push notifications (17 Nov 2026): one row per phone that has allowed
-- notifications. The app registers its token after login and removes it on
-- sign out. Only the server (service role) reads tokens to send pushes.
-- Safe to re-run.

create table if not exists public.push_tokens (
  token text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_profile_idx on public.push_tokens (profile_id);
alter table public.push_tokens enable row level security;
-- No direct table access for app users: they go through the two functions below.
drop policy if exists "Users see own push tokens" on public.push_tokens;
create policy "Users see own push tokens" on public.push_tokens for select using (profile_id = auth.uid());

create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if coalesce(p_token, '') = '' or p_platform not in ('ios', 'android') then
    raise exception 'Invalid push token.';
  end if;
  -- A phone belongs to whoever is signed in on it now.
  insert into public.push_tokens (token, profile_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set profile_id = excluded.profile_id, platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.remove_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and profile_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.remove_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.remove_push_token(text) to authenticated;
