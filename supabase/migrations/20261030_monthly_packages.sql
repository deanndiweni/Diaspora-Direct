-- Monthly packages: care bundles (from quotation DD-GW-1026) and live-in maid.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Run 20261029_service_prices.sql first.
--
-- Day to day:
--   * Change a package's price, wording or what it includes in
--     Table Editor > packages. Untick "active" to hide it from the app.
--   * The live-in maid package starts hidden. Set its monthly_price, then tick
--     "active" to show it.
--   * Add or reword welfare check tasks in Table Editor > welfare_tasks.
-- Price changes apply to new sign ups. Existing subscribers keep the price
-- they signed up at until they change bundle.

create table if not exists public.packages (
  id                text primary key,
  kind              text not null check (kind in ('care_bundle', 'live_in_maid')),
  name              text not null,
  tagline           text,
  monthly_price     numeric(10,2) not null check (monthly_price >= 0),
  groceries_amount  numeric(10,2),
  welfare_fee       numeric(10,2),
  visit_duration    text,
  adhoc_fee         numeric(10,2),
  annual_saving     numeric(10,2),
  includes          jsonb not null default '[]'::jsonb,
  sort              int not null default 0,
  active            boolean not null default true,
  updated_at        timestamptz not null default now()
);

create table if not exists public.welfare_tasks (
  id      text primary key,
  label   text not null,
  sort    int not null default 0,
  active  boolean not null default true
);

create table if not exists public.subscriptions (
  id                          uuid primary key default gen_random_uuid(),
  client_id                   uuid not null references auth.users(id) on delete cascade,
  package_id                  text not null references public.packages(id),
  package_name                text not null,
  monthly_price               numeric(10,2) not null,
  tasks                       jsonb not null default '[]'::jsonb,
  other_task                  text,
  recipient_name              text,
  city                        text,
  address                     text,
  notes                       text,
  start_month                 text,
  status                      text not null default 'pending_payment'
                              check (status in ('pending_payment', 'active', 'past_due', 'cancelling', 'cancelled')),
  stripe_checkout_session_id  text,
  stripe_customer_id          text,
  stripe_subscription_id      text unique,
  current_period_end          timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists subscriptions_client_idx on public.subscriptions (client_id);

-- One row per paid monthly invoice, so each month creates exactly one job
-- for the agents even if Stripe tells us about the payment twice.
create table if not exists public.subscription_invoices (
  invoice_id       text primary key,
  subscription_id  uuid not null references public.subscriptions(id) on delete cascade,
  request_id       text,
  amount           numeric(10,2),
  created_at       timestamptz not null default now()
);

-- Security. Packages and tasks are public so the guest screen can show them.
-- Subscriptions are only ever written by the server (Vercel /api functions
-- using the service role key); clients can read their own, admins read all.
alter table public.packages enable row level security;
alter table public.welfare_tasks enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_invoices enable row level security;

drop policy if exists "Packages are public" on public.packages;
create policy "Packages are public" on public.packages
  for select to anon, authenticated using (true);

drop policy if exists "Welfare tasks are public" on public.welfare_tasks;
create policy "Welfare tasks are public" on public.welfare_tasks
  for select to anon, authenticated using (true);

drop policy if exists "Clients read own subscriptions" on public.subscriptions;
create policy "Clients read own subscriptions" on public.subscriptions
  for select to authenticated
  using (
    client_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Admins read subscription invoices" on public.subscription_invoices;
create policy "Admins read subscription invoices" on public.subscription_invoices
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists packages_touch on public.packages;
create trigger packages_touch before update on public.packages
  for each row execute function public.touch_updated_at();

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- Care bundles, exactly as quoted to Miyanda Nehwati (DD-GW-1026, 29 Oct 2026).
insert into public.packages
  (id, kind, name, tagline, monthly_price, groceries_amount, welfare_fee, visit_duration, adhoc_fee, annual_saving, includes, sort, active)
values
  ('bronze', 'care_bundle', 'Bronze', 'Smaller household', 98, 60, 38,
   '30 min, then £2 per extra 5 min', 12, 24,
   '["Monthly grocery shop delivered to the home", "One welfare check during the delivery visit", "Written update with photos after every visit"]', 10, true),
  ('silver', 'care_bundle', 'Silver', 'Bigger household', 135, 100, 35,
   'No time limit, agent''s discretion', 10, 60,
   '["Monthly grocery shop delivered to the home", "One welfare check during the delivery visit", "Written update with photos after every visit"]', 20, true),
  ('gold', 'care_bundle', 'Gold', 'Full family shop', 180, 150, 30,
   '30 min plus 15 min free', 8, 120,
   '["Monthly grocery shop delivered to the home", "One welfare check during the delivery visit", "Written update with photos after every visit"]', 30, true),
  ('platinum', 'care_bundle', 'Platinum', 'Extended family', 225, 200, 25,
   'No time limit, agent''s discretion', 8, 180,
   '["Monthly grocery shop delivered to the home", "One welfare check during the delivery visit", "Written update with photos after every visit"]', 40, true),
  -- Hidden until you set a real monthly_price and tick active.
  ('live_in_maid', 'live_in_maid', 'Live-in maid', 'Fully managed by Diaspora Direct', 0, null, null,
   null, null, null,
   '["We find, vet and place a live-in maid", "Her monthly wage paid on time by us", "Regular supervision and check-ins by our agent", "Monthly update sent to you"]', 50, false)
on conflict (id) do nothing;

insert into public.welfare_tasks (id, label, sort) values
  ('chat',          'A sit down chat and general wellbeing check', 10),
  ('home_check',    'A look around the home for safety, cleanliness and repairs', 20),
  ('supplies',      'Checking food stock, water and ZESA units', 30),
  ('prescriptions', 'Checking regular prescriptions are collected and in date', 40),
  ('call',          'Helping set up a phone or video call with you', 50),
  ('next_shop',     'Noting items needed for next month''s shop', 60),
  ('concerns',      'Reporting any concerns to you straight away', 70)
on conflict (id) do nothing;
