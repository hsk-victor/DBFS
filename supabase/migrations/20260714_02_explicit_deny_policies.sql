-- Browser clients never access DBFS persistence directly. Flask authenticates
-- PayPal users and performs database operations with the service role.

create policy "deny browser access" on watchlist
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy "deny browser access" on holdings
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy "deny browser access" on orders
  as restrictive for all to anon, authenticated using (false) with check (false);
create policy "deny browser access" on api_cache
  as restrictive for all to anon, authenticated using (false) with check (false);
