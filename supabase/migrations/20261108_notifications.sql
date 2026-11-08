-- Automatic client and admin emails (8 Nov 2026)
-- Sends request status changes and new messages to the app's
-- /api/request-events endpoint, which emails the client or admin.
-- Before running: store the shared secret in Supabase Vault, using the same
-- value as DB_WEBHOOK_SECRET in Vercel:
--   select vault.create_secret('<secret>', 'db_webhook_secret');

create extension if not exists pg_net;

create or replace function public.post_request_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'db_webhook_secret' limit 1;
  if v_secret is null then return null; end if;
  if tg_table_name = 'requests' and tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  perform net.http_post(
    url := 'https://app.diaspora-direct.com/api/request-events',
    body := jsonb_build_object(
      'table', tg_table_name, 'type', tg_op,
      'record', to_jsonb(new),
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret)
  );
  return null;
end $$;

drop trigger if exists trg_request_events on public.requests;
create trigger trg_request_events after update on public.requests
  for each row execute function public.post_request_event();

drop trigger if exists trg_message_events on public.messages;
create trigger trg_message_events after insert on public.messages
  for each row execute function public.post_request_event();
