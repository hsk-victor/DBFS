-- REVIEW/APPLY WITH THE DATABASE OWNER (Victor).
-- Guarded, idempotent Forex completion in one database transaction.

create or replace function public.complete_forex_order(
  p_user_id text,
  p_order_id text
)
returns setof public.forex_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  current_order public.forex_orders%rowtype;
  completed_order public.forex_orders%rowtype;
  quote_rows integer;
begin
  select * into current_order
  from public.forex_orders
  where user_id = p_user_id and order_id = p_order_id
  for update;

  if not found then
    return;
  end if;

  if current_order.status = 'filled' then
    return next current_order;
    return;
  end if;

  if current_order.status <> 'pending_paypal' then
    return;
  end if;

  insert into public.forex_holdings (
    user_id, currency, amount, avg_sgd_rate, updated_at
  ) values (
    p_user_id, current_order.currency, current_order.amount,
    current_order.sgd_rate, extract(epoch from now())::bigint
  )
  on conflict (user_id, currency) do update set
    avg_sgd_rate = (
      (public.forex_holdings.amount * public.forex_holdings.avg_sgd_rate) +
      (excluded.amount * excluded.avg_sgd_rate)
    ) / (public.forex_holdings.amount + excluded.amount),
    amount = public.forex_holdings.amount + excluded.amount,
    updated_at = excluded.updated_at;

  update public.forex_quotes
  set status = 'used'
  where user_id = p_user_id
    and quote_id = current_order.quote_id
    and status = 'active';
  get diagnostics quote_rows = row_count;

  if quote_rows <> 1 then
    raise exception 'Forex quote is not active for order %', p_order_id;
  end if;

  update public.forex_orders
  set status = 'filled'
  where user_id = p_user_id
    and order_id = p_order_id
    and status = 'pending_paypal'
  returning * into completed_order;

  if not found then
    raise exception 'Forex order completion conflict for %', p_order_id;
  end if;

  return next completed_order;
end;
$$;

revoke all on function public.complete_forex_order(text, text) from public, anon, authenticated;
grant execute on function public.complete_forex_order(text, text) to service_role;
