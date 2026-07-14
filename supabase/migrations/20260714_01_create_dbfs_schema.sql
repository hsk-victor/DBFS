-- DBFS application persistence. PayPal OAuth is handled by Flask, so only the
-- backend service role is allowed to access these tables.

create table if not exists watchlist (
  user_id    text primary key,
  layout     jsonb not null default '[]',
  updated_at bigint not null default 0
);

create table if not exists holdings (
  user_id   text not null,
  symbol    text not null,
  qty       double precision not null check (qty > 0),
  avg_price double precision not null check (avg_price >= 0),
  primary key (user_id, symbol)
);

create table if not exists orders (
  order_id   text primary key,
  user_id    text not null,
  symbol     text not null,
  side       text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('market', 'limit')),
  shares     double precision not null check (shares > 0),
  price_usd  double precision not null check (price_usd >= 0),
  usd_total  double precision not null check (usd_total >= 0),
  fx_rate    double precision not null check (fx_rate > 0),
  sgd_total  double precision not null check (sgd_total >= 0),
  status     text not null check (status in ('pending_approval', 'filled', 'working', 'cancelled', 'failed')),
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
