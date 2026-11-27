-- Retention (PRD §6.10) and statistics (PRD §6.9).
begin;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000001', 'owner@t'), ('00000000-0000-0000-0000-000000000004', 'madania@t'), ('00000000-0000-0000-0000-000000000005', 'kouba@t');
insert into profiles (user_id, role, shop_id, display_name) values
  ('00000000-0000-0000-0000-000000000001', 'owner', null, 'Patron'),
  ('00000000-0000-0000-0000-000000000004', 'shop', 'madania', 'El Madania'),
  ('00000000-0000-0000-0000-000000000005', 'shop', 'kouba', 'Kouba');

-- three old orders (40 days ago): one finished, one still open, one finished for Kouba; one recent finished order
insert into orders (id, code, shop_id, status, business_date, submitted_at, validated_at, ready_at, received_at) values
  ('30000000-0000-0000-0000-000000000001', 'EMD-OLD-1', 'madania', 'received', business_date(now()) - 40, now() - interval '40 days', now() - interval '40 days' + interval '10 min', now() - interval '40 days' + interval '1 hour', now() - interval '40 days' + interval '2 hours'),
  ('30000000-0000-0000-0000-000000000002', 'EMD-OLD-2', 'madania', 'in_preparation', business_date(now()) - 40, now() - interval '40 days', now() - interval '40 days', null, null),
  ('30000000-0000-0000-0000-000000000003', 'KOU-OLD-1', 'kouba', 'received', business_date(now()) - 40, now() - interval '40 days', now() - interval '40 days', now() - interval '40 days', now() - interval '40 days'),
  ('30000000-0000-0000-0000-000000000004', 'EMD-NEW-1', 'madania', 'received', business_date(now()) - 5, now() - interval '5 days', now() - interval '5 days', now() - interval '5 days', now() - interval '5 days');
insert into order_lines (order_id, position, product_id, name_fr, name_ar, category_id, mode, step, requested, approved, prep) values
  ('30000000-0000-0000-0000-000000000001', 1, 'cornet', 'Cornet', '', 'glaces', 'count', 10, 100, 100, 'done'),
  ('30000000-0000-0000-0000-000000000002', 1, 'cornet', 'Cornet', '', 'glaces', 'count', 10, 50, 50, 'todo'),
  ('30000000-0000-0000-0000-000000000003', 1, 'cornet', 'Cornet', '', 'glaces', 'count', 10, 30, 30, 'done'),
  ('30000000-0000-0000-0000-000000000004', 1, 'cornet', 'Cornet', '', 'glaces', 'count', 10, 20, 20, 'done');
insert into order_events (order_id, type, actor_role, actor_name) values ('30000000-0000-0000-0000-000000000001', 'submitted', 'shop', 'x');

select is(purge_old_orders(30), 2, 'only finished orders older than 30 days are deleted');
select ok(exists (select 1 from orders where id = '30000000-0000-0000-0000-000000000002'), 'an open order is never deleted, however old');
select ok(exists (select 1 from orders where id = '30000000-0000-0000-0000-000000000004'), 'recent orders are kept');
select is((select count(*) from order_events where order_id = '30000000-0000-0000-0000-000000000001')::int, 0, 'events go with their purged order');
select is((select quantity from daily_totals where shop_id = 'madania' and product_id = 'cornet' and business_date = business_date(now()) - 40), 150, 'statistics were aggregated before the purge (finished 100 + still preparing 50)');
select is((select count(*) from purge_runs)::int, 1, 'each purge is logged');

-- stats read aggregates for old days and live orders for recent ones
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((stats_range(business_date(now()) - 45, business_date(now()), null, null, 'cornet') -> 'products' -> 0 ->> 'quantity')::int, 200, 'owner stats combine aggregates (150 + 30) and live data (20)');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select is((stats_range(business_date(now()) - 45, business_date(now()), 'kouba', null, null) -> 'products' -> 0 ->> 'quantity')::int, 170, 'a shop is forced to its own data even when asking for another shop');
select is(jsonb_array_length(stats_range(business_date(now()) - 6, business_date(now()), null, null, null) -> 'perDay'), 7, 'every day of the range is present');

select * from finish();
rollback;
