-- Diaspora Direct booking app: fit for purpose hardening (8 Nov 2026)
-- 1. Prices live in the database (services table) and the server sets every fee.
-- 2. Only Diaspora Direct (admin / server) can mark a request as paid.
-- 3. Clients and agents never message each other: every thread is with Diaspora Direct.
-- 4. Agents can no longer self register; only the admin creates agents.
-- Safe to re-run.

begin;

-- ---------- 1. Services and prices ----------
create table if not exists public.services (
  id text primary key,
  label text not null,
  base_fee numeric not null check (base_fee >= 0),
  fee_note text,
  active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.services enable row level security;
drop policy if exists "Anyone can read services" on public.services;
create policy "Anyone can read services" on public.services for select using (true);
drop policy if exists "Admins manage services" on public.services;
create policy "Admins manage services" on public.services for all using (public.is_admin()) with check (public.is_admin());

insert into public.services (id, label, base_fee, fee_note, sort_order) values
  ('property',  'Property checks', 25, '30 min included, then £2 per extra 5 min', 1),
  ('family',    'Family welfare',  40, '30 min included, then £2 per extra 5 min', 2),
  ('errand',    'Errands',         12, null, 3),
  ('urgent',    'Urgent support',  37, '30 min included, then £2 per extra 5 min', 4),
  ('documents', 'Documents',       20, null, 5),
  ('funeral',   'Funeral care',    52, 'Billed per hour', 6)
on conflict (id) do nothing;

create or replace function public.service_price(p_category text)
returns numeric language sql stable security definer set search_path = public as $$
  select base_fee from public.services where id = p_category and active;
$$;

-- ---------- 2. Payment columns ----------
alter table public.requests add column if not exists paid_at timestamptz;
alter table public.requests add column if not exists payment_ref text;
alter table public.requests add column if not exists stripe_session_id text;
alter table public.requests add column if not exists acknowledged_at timestamptz;

-- Requests that were already live before this change count as paid.
update public.requests set paid_at = coalesce(paid_at, created_at)
where status in ('requested', 'assigned', 'in_progress', 'completed') and paid_at is null;
update public.requests set payment_ref = 'DD-' || upper(substr(replace(id::text, '-', ''), 1, 6))
where payment_ref is null;

-- New requests: the server decides the fee, status and reference.
create or replace function public.prepare_new_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_fee numeric;
begin
  new.payment_ref := 'DD-' || upper(substr(replace(new.id::text, '-', ''), 1, 6));
  if public.is_service_role() or public.is_admin() then
    if new.fee is null then new.fee := public.service_price(new.category); end if;
    return new;
  end if;
  v_fee := public.service_price(new.category);
  if v_fee is null then raise exception 'That service is not available right now.'; end if;
  if coalesce(new.pay_method, '') not in ('card', 'bank', 'paypal') then
    raise exception 'Please choose card or bank transfer.';
  end if;
  new.fee := v_fee;
  new.client_id := auth.uid();
  new.agent_id := null;
  new.agent_fee := null;
  new.completed_at := null;
  new.paid_out_at := null;
  new.paid_at := null;
  new.stripe_session_id := null;
  new.acknowledged_at := null;
  new.status := case new.pay_method when 'card' then 'pending_payment' else 'awaiting_transfer' end;
  return new;
end $$;
drop trigger if exists trg_prepare_new_request on public.requests;
create trigger trg_prepare_new_request before insert on public.requests
  for each row execute function public.prepare_new_request();

-- Updates: clients and agents can only make the moves their role allows.
create or replace function public.lock_request_money()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() or public.is_admin() then
    if new.status = 'completed' and old.status is distinct from 'completed' and new.completed_at is null then
      new.completed_at := now();
    end if;
    return new;
  end if;

  new.fee := old.fee; new.client_id := old.client_id; new.agent_fee := old.agent_fee;
  new.paid_out_at := old.paid_out_at; new.category := old.category; new.pay_method := old.pay_method;
  new.paid_at := old.paid_at; new.payment_ref := old.payment_ref;
  new.stripe_session_id := old.stripe_session_id; new.acknowledged_at := old.acknowledged_at;
  new.completed_at := old.completed_at;

  if auth.uid() = old.client_id then
    new.agent_id := old.agent_id;
    if new.status is distinct from old.status and not (
         (old.status = 'awaiting_transfer' and new.status = 'payment_review')
      or (old.status in ('pending_payment', 'awaiting_transfer') and new.status = 'cancelled')
    ) then
      raise exception 'Only Diaspora Direct can change the status of this request.';
    end if;
    return new;
  end if;

  -- Agents
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

-- ---------- 3. Messages: client <-> Diaspora Direct, agent <-> Diaspora Direct ----------
alter table public.messages add column if not exists thread text not null default 'client';
alter table public.messages drop constraint if exists messages_thread_check;
alter table public.messages add constraint messages_thread_check check (thread in ('client', 'agent'));

drop policy if exists "Admins view all messages" on public.messages;
drop policy if exists "Participants can send messages" on public.messages;
drop policy if exists "Participants can view messages" on public.messages;
drop policy if exists "View own thread messages" on public.messages;
drop policy if exists "Send own thread messages" on public.messages;

create policy "View own thread messages" on public.messages for select using (
  public.is_admin()
  or (thread = 'client' and exists (
        select 1 from public.requests r where r.id = messages.request_id and r.client_id = auth.uid()))
  or (thread = 'agent' and exists (
        select 1 from public.requests r join public.agents a on a.id = r.agent_id
        where r.id = messages.request_id and a.profile_id = auth.uid()))
);
create policy "Send own thread messages" on public.messages for insert with check (
  auth.uid() = sender_id and (
    public.is_admin()
    or (thread = 'client' and exists (
          select 1 from public.requests r where r.id = messages.request_id and r.client_id = auth.uid()))
    or (thread = 'agent' and exists (
          select 1 from public.requests r join public.agents a on a.id = r.agent_id
          where r.id = messages.request_id and a.profile_id = auth.uid()))
  )
);

-- ---------- 4. Admin only agent registration ----------
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_service_role() then return new; end if;
  if tg_op = 'INSERT' then
    -- Everyone who signs up in the app is a client. Agents are created by the admin.
    new.role := 'client';
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then new.role := old.role; end if;
  if new.email is distinct from old.email and not public.is_admin() then new.email := old.email; end if;
  return new;
end $$;

drop policy if exists "Users create own agent row" on public.agents;

commit;
