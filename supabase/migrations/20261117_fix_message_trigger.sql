-- Fix (17 Nov 2026): chat messages could never be saved.
-- post_request_event() is shared by the requests and messages triggers. Its
-- check "tg_table_name = 'requests' and new.status ..." is not short-circuited
-- by PL/pgSQL, so on a messages insert it read new.status, which does not
-- exist, raised an error and rolled back every message. Check the table first.

create or replace function public.post_request_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'requests' then
    if new.status is not distinct from old.status then
      return null;
    end if;
  end if;
  perform net.http_post(
    url := 'https://app.diaspora-direct.com/api/request-events',
    body := jsonb_build_object('table', tg_table_name, 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return null;
end $$;
