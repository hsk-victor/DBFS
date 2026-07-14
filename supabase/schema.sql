-- Straits Digital Bank · Stocks — Supabase schema
-- The Flask backend uses the service-role key. RLS remains enabled with no
-- client policies, so browser-side anon/authenticated access is denied while
-- the trusted backend can continue to read and write.

create table if not exists watchlist (
  user_id    text primary key,
  layout     jsonb not null default '[]',
  updated_at bigint not null default 0
);

create table if not exists holdings (
  user_id   text not null,
  symbol    text not null,
  qty       double precision not null,
  avg_price double precision not null,
  primary key (user_id, symbol)
);

create table if not exists orders (
  order_id   text primary key,
  user_id    text not null,
  symbol     text not null,
  side       text not null,             -- buy | sell
  order_type text not null,             -- market | limit
  shares     double precision not null,
  price_usd  double precision not null,
  usd_total  double precision not null,
  fx_rate    double precision not null,
  sgd_total  double precision not null,
  status     text not null,             -- pending_approval | filled | working | cancelled | failed
  time_label text not null default '',
  created_at bigint not null default 0
);
create index if not exists orders_user_idx on orders (user_id, created_at desc);

create table if not exists api_cache (
  key        text primary key,
  payload    jsonb,
  fetched_at bigint not null default 0
);

alter table watchlist enable row level security;
alter table holdings enable row level security;
alter table orders enable row level security;
alter table api_cache enable row level security;

revoke all on table watchlist, holdings, orders, api_cache from anon, authenticated;
grant all on table watchlist, holdings, orders, api_cache to service_role;

drop policy if exists "deny browser access" on watchlist;
drop policy if exists "deny browser access" on holdings;
drop policy if exists "deny browser access" on orders;
drop policy if exists "deny browser access" on api_cache;

create policy "deny browser access" on watchlist
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy "deny browser access" on holdings
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy "deny browser access" on orders
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy "deny browser access" on api_cache
  as restrictive for all to anon, authenticated using (false) with check (false);
