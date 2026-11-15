-- Diaspora Direct booking app: match the website and take custom requests (15 Nov 2026)
-- 1. Prices and services now match diaspora-direct.com.
-- 2. "Quote" services: the client describes the job for free, Diaspora Direct
--    sets a price, then the client pays by card or bank transfer.
--    Used for doctor visits, ambulance, legal help, the monthly care plan and
--    "Something else" (anything outside the listed services).
-- Safe to re-run.

begin;

-- ---------- 1. Services table: quote flag and blurb ----------
alter table public.services add column if not exists quote boolean not null default false;
alter table public.services add column if not exists blurb text;

insert into public.services (id, label, base_fee, fee_note, quote, blurb, sort_order) values
  ('property',  'Property checks',        45, '30 min, photo report, then £2 per extra 5 min', false, 'Photo inspection of your home, stand or build, same or next day', 1),
  ('land',      'Land title and boundary check', 45, 'Written report', false, 'Deeds office title search and boundary check', 2),
  ('family',    'Family welfare',         45, '30 min included, then £2 per extra 5 min', false, 'Welfare visits, photos and video calls with your relatives', 3),
  ('errand',    'Errands',                30, null, false, 'ZESA and bills, banks, school fees, government offices', 4),
  ('shopping',  'Shopping and gifts',     45, 'Plus cost of goods, photo proof of delivery', false, 'Groceries, gifts and essentials bought and delivered', 5),
  ('documents', 'Documents',              45, 'Per task', false, 'Collection, notarisation and courier abroad', 6),
  ('urgent',    'Urgent support',         45, '30 min, then £2 per extra 5 min, 24/7 WhatsApp', false, 'Hospital liaison, emergency family contact, crisis support', 7),
  ('funeral',   'Funeral care',           45, 'Billed per hour', false, 'Liaison, notifications and transport, handled with care', 8),
  ('doctor',    'Doctor home visit',       0, 'Price on request', true, 'Home visits, health checks and hospital liaison by our doctor', 9),
  ('ambulance', 'Ambulance call-out',      0, 'Price on request', true, 'Arranged through our ambulance partners', 10),
  ('legal',     'Legal help',              0, 'Price on request', true, 'Advice and representation by our in-house lawyer', 11),
  ('careplan',  'Monthly care plan',       0, 'From £130 per month, we confirm your plan', true, '2 welfare visits a month, £60 of groceries, monthly photo report, priority WhatsApp', 12),
  ('other',     'Something else',          0, 'Tell us what you need and we send a price', true, 'Anything not listed. Describe the job and we quote', 13)
on conflict (id) do update set
  label = excluded.label, base_fee = excluded.base_fee, fee_note = excluded.fee_note,
  quote = excluded.quote, blurb = excluded.blurb, sort_order = excluded.sort_order,
  active = true, updated_at = now();

-- ---------- 2. Requests: allow new categories, quote statuses and no fee until quoted ----------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.requests'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%status%' or pg_get_constraintdef(oid) ilike '%category%')
  loop
    execute format('alter table public.requests drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.requests add constraint requests_status_check check (status in (
  'quote_requested', 'quoted', 'pending_payment', 'awaiting_transfer', 'payment_review',
  'requested', 'assigned', 'in_progress', 'completed', 'cancelled', 'refunded'
));
alter table public.requests alter column fee drop not null;
alter table public.requests add column if not exists quote_note text;
alter table public.requests add column if not exists quoted_at timestamptz;

create or replace function public.service_is_quote(p_category text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select quote from public.services where id = p_category and active), false);
$$;

-- New requests: the server decides the fee, status and reference.
create or replace function public.prepare_new_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_fee numeric;
begin
  new.payment_ref := 'DD-' || upper(substr(replace(new.id::text, '-', ''), 1, 6));
  if public.is_service_role() or public.is_admin() then
    if new.fee is null and not public.service_is_quote(new.category) then
      new.fee := public.service_price(new.category);
    end if;
    return new;
  end if;

  new.client_id := auth.uid();
  new.agent_id := null;
  new.agent_fee := null;
  new.completed_at := null;
  new.paid_out_at := null;
  new.paid_at := null;
  new.stripe_session_id := null;
  new.acknowledged_at := null;
  new.quote_note := null;
  new.quoted_at := null;

  if public.service_is_quote(new.category) then
    -- Nothing to pay yet: Diaspora Direct sends a price first.
    new.fee := null;
    new.pay_method := null;
    new.status := 'quote_requested';
    return new;
  end if;

  v_fee := public.service_price(new.category);
  if v_fee is null then raise exception 'That service is not available right now.'; end if;
  if coalesce(new.pay_method, '') not in ('card', 'bank', 'paypal') then
    raise exception 'Please choose card or bank transfer.';
  end if;
  new.fee := v_fee;
  new.status := case new.pay_method when 'card' then 'pending_payment' else 'awaiting_transfer' end;
  return new;
end $$;

-- Updates: clients and agents can only make the moves their role allows.
create or replace function public.lock_request_money()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin() then
    if new.status = 'completed' and old.status is distinct from 'completed' and new.completed_at is null then
      new.completed_at := now();
    end if;
    if new.status = 'quoted' and old.status is distinct from 'quoted' then
      if new.fee is null or new.fee <= 0 then raise exception 'Set a price before sending the quote.'; end if;
      new.quoted_at := now();
    end if;
    return new;
  end if;

  new.fee := old.fee; new.client_id := old.client_id; new.agent_fee := old.agent_fee;
  new.paid_out_at := old.paid_out_at; new.category := old.category;
  new.paid_at := old.paid_at; new.payment_ref := old.payment_ref;
  new.stripe_session_id := old.stripe_session_id; new.acknowledged_at := old.acknowledged_at;
  new.completed_at := old.completed_at;
  new.quote_note := old.quote_note; new.quoted_at := old.quoted_at;

  if auth.uid() = old.client_id then
    new.agent_id := old.agent_id;
    if old.status = 'quoted' and new.status in ('pending_payment', 'awaiting_transfer') then
      -- Accepting a quote: the client picks how to pay, the price stays as quoted.
      if new.status = 'pending_payment' then new.pay_method := 'card'; else new.pay_method := 'bank'; end if;
      return new;
    end if;
    new.pay_method := old.pay_method;
    if new.status is distinct from old.status and not (
         (old.status = 'awaiting_transfer' and new.status = 'payment_review')
      or (old.status in ('pending_payment', 'awaiting_transfer', 'quote_requested', 'quoted') and new.status = 'cancelled')
      -- A quoted job whose payment was abandoned goes back to the quote, so the client can pay another way.
      or (old.status in ('pending_payment', 'awaiting_transfer') and new.status = 'quoted' and old.quoted_at is not null)
    ) then
      raise exception 'Only Diaspora Direct can change the status of this request.';
    end if;
    return new;
  end if;

  -- Agents
  new.pay_method := old.pay_method;
  new.title := old.title; new.description := old.description;
  new.city := old.city; new.country := old.country;
  if new.status is distinct from old.status then
    if not (
         (old.status = 'requested' and new.status = 'assigned')
      or (old.status = 'assigned' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'completed')
    ) then
      raise exception 'That status change is not allowed.';
    end if;
    if new.status = 'completed' then new.completed_at := now(); end if;
  end if;
  return new;
end $$;

commit;
