-- Live pricing for Diaspora Direct.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- After that, change prices in Table Editor > service_prices. The app picks
-- up new prices next time it opens; no app build or store review needed.

create table if not exists public.service_prices (
  id          text primary key,           -- service id, or "tip" / "extra_task"
  amount      numeric(10,2) not null check (amount >= 0),
  note        text,                       -- small print shown under the price
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- Anyone (including signed out visitors on the guest screen) can read prices.
-- Nobody can change them from the app; edit them in the Supabase dashboard.
alter table public.service_prices enable row level security;

drop policy if exists "Prices are public" on public.service_prices;
create policy "Prices are public"
  on public.service_prices for select
  to anon, authenticated
  using (true);

create or replace function public.touch_service_prices()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists service_prices_touch on public.service_prices;
create trigger service_prices_touch
  before update on public.service_prices
  for each row execute function public.touch_service_prices();

-- Current prices (Family welfare raised to £40, per the Oct 2026 rate card).
insert into public.service_prices (id, amount, note) values
  ('property',   25, '30 min included, then £2 per extra 5 min'),
  ('family',     40, '30 min included, then £2 per extra 5 min'),
  ('errand',     12, null),
  ('urgent',     37, '30 min included, then £2 per extra 5 min'),
  ('documents',  20, null),
  ('funeral',    52, 'Billed per hour'),
  ('tip',         5, null),
  ('extra_task',  8, null)
on conflict (id) do nothing;
