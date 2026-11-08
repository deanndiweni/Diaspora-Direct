-- Automatic client and admin emails (8 Nov 2026)
-- When a request's status changes or a message is sent, the database pings
-- the app's /api/request-events endpoint with just the table and row id.
-- The endpoint re-reads the row and only emails about changes not yet
-- notified (tracked in notified_status / notified_at), so no secret is needed.

create extension if not exists pg_net;

alter table public.requests add column if not exists notified_status text;
alter table public.messages add column if not exists notified_at timestamptz;
-- Everything that already happened counts as notified.
update public.requests set notified_status = status where notified_status is null;
update public.messages set notified_at = now() where notified_at is null;

create or replace function public.post_request_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'requests' and new.status is not distinct from old.status then
    return null;
  end if;
  perform net.http_post(
    url := 'https://app.diaspora-direct.com/api/request-events',
    body := jsonb_build_object('table', tg_table_name, 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return null;
end $$;

drop trigger if exists trg_request_events on public.requests;
create trigger trg_request_events after update on public.requests
  for each row execute function public.post_request_event();

drop trigger if exists trg_message_events on public.messages;
create trigger trg_message_events after insert on public.messages
  for each row execute function public.post_request_event();
