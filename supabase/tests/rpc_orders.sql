-- Order functions: the full flow, plus a wrong-role and a stale-version case for every mutation (CLAUDE.md DoD).
begin;
select plan(42);

-- fixtures (as postgres)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@t'), ('00000000-0000-0000-0000-000000000002', 'deputy@t'),
  ('00000000-0000-0000-0000-000000000003', 'labo@t'), ('00000000-0000-0000-0000-000000000004', 'madania@t'),
  ('00000000-0000-0000-0000-000000000005', 'kouba@t');
insert into profiles (user_id, role, shop_id, display_name) values
  ('00000000-0000-0000-0000-000000000001', 'owner', null, 'Patron'), ('00000000-0000-0000-0000-000000000002', 'deputy', null, 'Adjoint'),
  ('00000000-0000-0000-0000-000000000003', 'labo', null, 'Labo'), ('00000000-0000-0000-0000-000000000004', 'shop', 'madania', 'El Madania'),
  ('00000000-0000-0000-0000-000000000005', 'shop', 'kouba', 'Kouba');
insert into products (id, category_id, name_fr, mode, step) values ('cornet', 'glaces', 'Cornet', 'count', 10), ('pistache', 'ingredients', 'Pistache', 'weight', 250);
insert into products (id, category_id, name_fr, mode, step, active) values ('sorbet', 'glaces', 'Sorbet', 'pack', 1, false);
insert into products (id, category_id, name_fr, mode, step) values ('chantilly', 'glaces', 'Chantilly', 'pack', 1);
insert into product_packs (product_id, id, label) values ('chantilly', '5l', '5 L'), ('chantilly', '10l', '10 L'), ('sorbet', '5l', '5 L');
select set_team_pin('matin', '1111');
select set_team_pin('nuit', '2222');

create function pg_temp.as_user(p text) returns void language sql as $$ select set_config('request.jwt.claim.sub', p, true) $$;
create function pg_temp.v(p uuid) returns int language sql as $$ select version from public.orders where id = p $$;
-- reads the audit trail as the database owner (the labo is not allowed to read it, by design)
create function pg_temp.events(p uuid, t text) returns int language sql security definer as $$ select count(*)::int from public.order_events where order_id = p and type = t $$;
create function pg_temp.event_team(p uuid, t text) returns text language sql security definer as $$ select team::text from public.order_events where order_id = p and type = t $$;

set local role authenticated;

-- shop submits ---------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select ok((submit_order('10000000-0000-0000-0000-000000000001', '[{"productId":"cornet","packId":null,"qty":150},{"productId":"chantilly","packId":"10l","qty":2},{"productId":"pistache","packId":null,"qty":500}]', 'Vite') ->> 'code') like 'EMD-____-01', 'submit_order builds a readable code');
select is((submit_order('10000000-0000-0000-0000-000000000001', '[{"productId":"cornet","packId":null,"qty":10}]', '') -> 'lines' -> 0 ->> 'requested')::int, 150, 'submit_order is idempotent on the client UUID (retry returns the first order)');
select is((select count(*) from orders where id = '10000000-0000-0000-0000-000000000001')::int, 1, 'a retried submit never creates a second order');
select throws_ok($$ select submit_order(gen_random_uuid(), '[{"productId":"cornet","packId":null,"qty":15}]', '') $$, 'P0001', 'invalid_quantity', 'quantity must be a multiple of the step');
select throws_ok($$ select submit_order(gen_random_uuid(), '[{"productId":"sorbet","packId":"5l","qty":1}]', '') $$, 'P0001', 'product_unavailable', 'inactive products cannot be ordered');
select throws_ok($$ select submit_order(gen_random_uuid(), '[]', '') $$, 'P0001', 'empty_order', 'empty orders are rejected');
select throws_ok($$ select submit_order(gen_random_uuid(), '[{"productId":"cornet","packId":null,"qty":10}]', repeat('x', 161)) $$, 'P0001', 'text_too_long', 'shop note is limited to 160 characters');
select throws_ok($$ select submit_order(gen_random_uuid(), '[{"productId":"cornet","packId":null,"qty":10},{"productId":"cornet","packId":null,"qty":20}]', '') $$, 'P0001', 'invalid_quantity', 'the same product cannot appear twice');

-- other shop and other roles cannot act on it
select pg_temp.as_user('00000000-0000-0000-0000-000000000005');
select throws_ok($$ select cancel_order('10000000-0000-0000-0000-000000000001', 1) $$, 'P0001', 'not_found', 'another shop cannot delete the order');
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select throws_ok($$ select submit_order(gen_random_uuid(), '[{"productId":"cornet","packId":null,"qty":10}]', '') $$, 'P0001', 'forbidden', 'the owner cannot submit orders');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select throws_ok($$ select start_review('10000000-0000-0000-0000-000000000001') $$, 'P0001', 'forbidden', 'the labo cannot review');

-- review lock ----------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select is(start_review('10000000-0000-0000-0000-000000000001') ->> 'status', 'in_review', 'owner takes the review lock');
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select throws_ok($$ select start_review('10000000-0000-0000-0000-000000000001') $$, 'P0001', 'locked', 'deputy is refused while the owner reviews');

-- shop edits during review: unchanged lines keep their id, version moves on
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select is(update_pending_order('10000000-0000-0000-0000-000000000001', 1, '[{"productId":"cornet","packId":null,"qty":150},{"productId":"chantilly","packId":"10l","qty":3},{"productId":"pistache","packId":null,"qty":500}]', '') ->> 'editedDuringReview', 'true', 'shop can still edit while in review');
select is((select count(*) from order_lines where order_id = '10000000-0000-0000-0000-000000000001' and changed_by_shop)::int, 1, 'only the changed line is flagged for the reviewer');
select throws_ok($$ select update_pending_order('10000000-0000-0000-0000-000000000001', 1, '[{"productId":"cornet","packId":null,"qty":10}]', '') $$, 'P0001', 'stale_version', 'shop edit with an old version is rejected');

-- decide ---------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select throws_ok($$ select decide_order('10000000-0000-0000-0000-000000000001', 1, '[]', '', 'matin') $$, 'P0001', 'stale_version', 'owner decision based on an old version is rejected');
select throws_ok(format($$ select decide_order('10000000-0000-0000-0000-000000000001', %s, (select jsonb_agg(jsonb_build_object('lineId', id, 'decision', 'reduced', 'approved', requested + step)) from order_lines where order_id = '10000000-0000-0000-0000-000000000001'), '', 'matin') $$, pg_temp.v('10000000-0000-0000-0000-000000000001')),
  'P0001', 'invalid_quantity', 'a reviewer can never raise a quantity');
select throws_ok(format($$ select decide_order('10000000-0000-0000-0000-000000000001', %s, (select jsonb_agg(jsonb_build_object('lineId', id, 'decision', 'refused', 'approved', 0, 'refusalReason', '')) from order_lines where order_id = '10000000-0000-0000-0000-000000000001'), '', 'matin') $$, pg_temp.v('10000000-0000-0000-0000-000000000001')),
  'P0001', 'reason_required', 'refusing needs a reason');
select is(decide_order('10000000-0000-0000-0000-000000000001', pg_temp.v('10000000-0000-0000-0000-000000000001'),
  (select jsonb_agg(case when product_id = 'cornet' then jsonb_build_object('lineId', id, 'decision', 'reduced', 'approved', 100, 'note', 'Bien froid')
                         when product_id = 'pistache' then jsonb_build_object('lineId', id, 'decision', 'refused', 'approved', 0, 'refusalReason', 'Rupture')
                         else jsonb_build_object('lineId', id, 'decision', 'accepted', 'approved', requested) end)
   from order_lines where order_id = '10000000-0000-0000-0000-000000000001'), 'Chantilly en premier', 'matin') ->> 'status', 'validated', 'owner sends to the labo');
select is((select decision::text || approved from order_lines where order_id = '10000000-0000-0000-0000-000000000001' and product_id = 'cornet'), 'reduced100', 'reduced line keeps the reduced quantity');
select is((select count(*) from order_notes where order_id = '10000000-0000-0000-0000-000000000001')::int, 2, 'line note and order note are stored');

-- shop can no longer edit or delete
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select throws_ok(format($$ select cancel_order('10000000-0000-0000-0000-000000000001', %s) $$, pg_temp.v('10000000-0000-0000-0000-000000000001')), 'P0001', 'invalid_state', 'shop cannot delete once sent to the labo');

-- labo -----------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select throws_ok($$ select switch_labo_team('matin', '0000') $$, 'P0001', 'wrong_pin', 'wrong team PIN is refused');
select is(switch_labo_team('matin', '1111') ->> 'team', 'matin', 'right PIN sets the active team');
select is(jsonb_array_length(order_json('10000000-0000-0000-0000-000000000001', 'labo') -> 'lines'), 2, 'labo never sees refused lines');
select is(order_json('10000000-0000-0000-0000-000000000001', 'owner') ->> 'shopNote', '', 'labo cannot read the shop note, even by claiming another role');
select is(set_line_prep('10000000-0000-0000-0000-000000000001', (select id from order_lines where product_id = 'cornet' and order_id = '10000000-0000-0000-0000-000000000001'), 'done', null, null) ->> 'status', 'in_preparation', 'first tick starts the preparation');
select is(pg_temp.events('10000000-0000-0000-0000-000000000001', 'line_prepped'), 1, 'tick is recorded once');
select lives_ok($$ select set_line_prep('10000000-0000-0000-0000-000000000001', (select id from order_lines where product_id = 'cornet' and order_id = '10000000-0000-0000-0000-000000000001'), 'done', null, null) $$, 'replaying the same tick is safe');
select is(pg_temp.events('10000000-0000-0000-0000-000000000001', 'line_prepped'), 1, 'replayed tick adds no event (idempotent)');
select throws_ok(format($$ select close_order('10000000-0000-0000-0000-000000000001', %s) $$, pg_temp.v('10000000-0000-0000-0000-000000000001')), 'P0001', 'invalid_state', 'cannot close with lines left');
select throws_ok($$ select set_line_prep('10000000-0000-0000-0000-000000000001', (select id from order_lines where product_id = 'chantilly' and order_id = '10000000-0000-0000-0000-000000000001'), 'partial', 1, '') $$, 'P0001', 'reason_required', 'a problem needs a reason');
select lives_ok($$ select set_line_prep('10000000-0000-0000-0000-000000000001', (select id from order_lines where product_id = 'chantilly' and order_id = '10000000-0000-0000-0000-000000000001'), 'partial', 1, 'Rupture') $$, 'partial preparation with a reason');
select throws_ok($$ select close_order('10000000-0000-0000-0000-000000000001', 1) $$, 'P0001', 'stale_version', 'close with an old version is rejected');
select is(close_order('10000000-0000-0000-0000-000000000001', pg_temp.v('10000000-0000-0000-0000-000000000001')) ->> 'status', 'ready', 'labo closes the order');
select is(pg_temp.event_team('10000000-0000-0000-0000-000000000001', 'ready'), 'matin', 'the closing team is stamped');

-- owner notes after validation are append-only and limited
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select throws_ok($$ select add_note('10000000-0000-0000-0000-000000000001', null, 'trop tard') $$, 'P0001', 'invalid_state', 'no notes once the order is ready');

-- shop receives
select pg_temp.as_user('00000000-0000-0000-0000-000000000004');
select is(confirm_received('10000000-0000-0000-0000-000000000001') ->> 'status', 'received', 'shop confirms reception');
select is(confirm_received('10000000-0000-0000-0000-000000000001') ->> 'status', 'received', 'confirming twice is harmless');

-- notifications (PRD §6.8)
reset role;
select is((select array_agg(recipient || ':' || type order by recipient, type) from notifications where order_id = '10000000-0000-0000-0000-000000000001' and push and type in ('order_submitted', 'order_validated_changed', 'order_validated', 'order_ready')),
  array['deputy:order_ready', 'deputy:order_submitted', 'labo:order_validated', 'owner:order_ready', 'owner:order_submitted', 'shop:madania:order_ready', 'shop:madania:order_validated_changed'],
  'pushes go to the right people');
select is((select count(*) from notifications where order_id = '10000000-0000-0000-0000-000000000001' and recipient = 'owner' and type = 'order_received')::int, 1, 'owner is told the order was delivered');

select * from finish();
rollback;
