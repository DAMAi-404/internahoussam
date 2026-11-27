-- Row-level security matches docs/ROLES.md: who can read what, and nobody writes tables directly.
begin;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@t'), ('00000000-0000-0000-0000-000000000003', 'labo@t'),
  ('00000000-0000-0000-0000-000000000004', 'madania@t'), ('00000000-0000-0000-0000-000000000005', 'kouba@t');
insert into profiles (user_id, role, shop_id, display_name) values
  ('00000000-0000-0000-0000-000000000001', 'owner', null, 'Patron'), ('00000000-0000-0000-0000-000000000003', 'labo', null, 'Labo'),
  ('00000000-0000-0000-0000-000000000004', 'shop', 'madania', 'El Madania'), ('00000000-0000-0000-0000-000000000005', 'shop', 'kouba', 'Kouba');
insert into products (id, category_id, name_fr, mode, step) values ('cornet', 'glaces', 'Cornet', 'count', 10);
create function pg_temp.as_user(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, true) $$;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select submit_order('20000000-0000-0000-0000-000000000001', '[{"productId":"cornet","packId":null,"qty":10}]', 'note boutique');
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select submit_order('20000000-0000-0000-0000-000000000002', '[{"productId":"cornet","packId":null,"qty":20}]', '');

-- shops see only themselves
select is((select count(*) from orders)::int, 1, 'a shop sees only its own orders');
select is((select count(*) from order_lines)::int, 1, 'and only its own lines');
select is(jsonb_array_length(list_orders()), 1, 'list_orders is scoped the same way');
select is((select count(*) from notifications)::int, 0, 'a shop does not see the owner''s notifications');

-- owner sees everything
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select is((select count(*) from orders)::int, 2, 'the owner sees every shop');
select is((select count(*) from notifications where recipient = 'owner')::int, 2, 'the owner sees his notifications');

-- labo sees nothing until validated
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select is((select count(*) from orders)::int, 0, 'the labo sees no order before validation');

-- nobody writes tables directly
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select throws_ok($$ update orders set status = 'ready' $$, '42501', null, 'no direct update of orders, even for the owner');
select throws_ok($$ insert into order_events (order_id, type, actor_role, actor_name) values ('20000000-0000-0000-0000-000000000001', 'x', 'owner', 'x') $$, '42501', null, 'no direct insert into the event log');
select throws_ok($$ delete from order_events $$, '42501', null, 'the event log cannot be deleted by users');
select throws_ok($$ update products set active = false $$, '42501', null, 'catalogue changes go through functions only');
select throws_ok($$ select pin_hash from labo_teams $$, '42501', null, 'team PIN hashes are never readable');
select throws_ok($$ select set_team_pin('matin', '0000') $$, '42501', null, 'only the service role can set team PINs');
select throws_ok($$ select purge_old_orders(0) $$, '42501', null, 'users cannot run the purge');

-- anonymous visitors (login screen) only see shop names
reset role;
set local role anon;
select is((select count(*) from shops)::int, 12, 'anon can list the 12 shops for the login screen');
select throws_ok($$ select count(*) from orders $$, '42501', null, 'anon cannot read orders');

select * from finish();
rollback;
