-- Order state machine (PRD §8), mirroring src/domain/orders.ts rule for rule.
-- Errors: SQLSTATE P0001, MESSAGE = domain error code (forbidden, stale_version, locked…), DETAIL = json params.

create function public._err(p_code text, p_params jsonb default '{}') returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = p_params::text;
end $$;

create function public._require_role(p_roles public.user_role[]) returns public.user_role
language plpgsql stable security definer set search_path = public as $$
declare v public.user_role := auth_role();
begin
  if v is null then perform _err('not_signed_in'); end if;
  if not v = any (p_roles) then perform _err('forbidden'); end if;
  return v;
end $$;

create function public._labo_team() returns public.team_code
language sql stable security definer set search_path = public as $$ select team from labo_state where singleton $$;

create function public._event(p_order uuid, p_type text, p_from public.order_status, p_to public.order_status, p_line uuid default null, p_detail text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_role public.user_role := auth_role();
begin
  insert into order_events (order_id, type, from_status, to_status, actor_user, actor_role, actor_name, team, line_id, detail)
  values (p_order, p_type, p_from, p_to, auth.uid(), v_role, coalesce(auth_name(), v_role::text),
          case when v_role = 'labo' then _labo_team() end, p_line, p_detail);
end $$;

/* ---------------- JSON views (shape of src/domain/types.ts Order) ---------------- */

-- SECURITY INVOKER: when called directly by a client, RLS applies; when called from a SECURITY DEFINER
-- RPC (which already checked access), it runs with the definer's rights. The viewer role always comes
-- from the session (auth_role()), never from the caller: p_viewer is only a fallback for jobs.
create function public.order_json(p_id uuid, p_viewer public.user_role) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'shopId', o.shop_id, 'status', o.status, 'businessDate', o.business_date,
    'version', o.version, 'team', o.team,
    'shopNote', case when vv.v = 'labo' then '' else o.shop_note end,
    'reviewer', case when o.reviewer_role is null then null else jsonb_build_object('role', o.reviewer_role, 'name', o.reviewer_name) end,
    'editedDuringReview', o.edited_during_review,
    'at', jsonb_strip_nulls(jsonb_build_object(
      'submitted', o.submitted_at, 'reviewStarted', o.review_started_at, 'validated', o.validated_at, 'refused', o.refused_at,
      'prepStarted', o.prep_started_at, 'ready', o.ready_at, 'received', o.received_at, 'cancelled', o.cancelled_at)),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'productId', l.product_id, 'packId', l.pack_id, 'name', jsonb_build_object('fr', l.name_fr, 'ar', l.name_ar),
        'categoryId', l.category_id, 'mode', l.mode, 'step', l.step, 'packLabel', l.pack_label,
        'requested', l.requested, 'approved', l.approved, 'decision', l.decision, 'refusalReason', l.refusal_reason,
        'prep', l.prep, 'preparedQty', l.prepared_qty, 'laboReason', l.labo_reason, 'prepTeam', l.prep_team,
        'changedByShop', l.changed_by_shop) order by l.position)
      from order_lines l where l.order_id = o.id and (vv.v <> 'labo' or l.decision <> 'refused')), '[]'),
    'notes', case when vv.v = 'shop' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'lineId', n.line_id, 'audience', 'labo', 'body', n.body,
        'author', jsonb_build_object('role', n.author_role, 'name', n.author_name), 'at', n.created_at) order by n.created_at)
      from order_notes n where n.order_id = o.id), '[]') end,
    'events', case when vv.v = 'labo' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id::text, 'type', e.type, 'at', e.created_at,
        'actor', jsonb_strip_nulls(jsonb_build_object('role', e.actor_role, 'name', e.actor_name, 'team', e.team)),
        'from', e.from_status, 'to', e.to_status, 'lineId', e.line_id, 'detail', e.detail) order by e.id)
      from order_events e where e.order_id = o.id), '[]') end)
  from orders o cross join (select coalesce(public.auth_role(), p_viewer) as v) vv where o.id = p_id
$$;

-- RLS decides visibility (security invoker); order_json applies the per-role projection.
create function public.list_orders() returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(order_json(o.id, auth_role()) order by o.submitted_at desc), '[]')
  from orders o
  where o.business_date >= business_date(now()) - 31
$$;

/* ---------------- lines ---------------- */

create function public._insert_line(p_order uuid, p_pos int, p_elem jsonb, p_changed boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pid text := p_elem ->> 'productId';
  v_pack text := nullif(p_elem ->> 'packId', '');
  v_qty int;
  p products;
  k product_packs;
begin
  begin
    v_qty := (p_elem ->> 'qty')::int;
  exception when others then
    perform _err('invalid_quantity');
  end;
  select * into p from products where id = v_pid;
  if not found or not p.active then perform _err('product_unavailable', jsonb_build_object('productId', v_pid)); end if;
  if p.mode = 'pack' then
    select * into k from product_packs where product_id = p.id and id = v_pack;
    if not found or not k.active then perform _err('product_unavailable', jsonb_build_object('productId', v_pid)); end if;
  elsif v_pack is not null then
    perform _err('invalid_quantity');
  end if;
  if v_qty is null or v_qty < p.step or v_qty % p.step <> 0 or (p.max_qty is not null and v_qty > p.max_qty) then
    perform _err('invalid_quantity');
  end if;
  if exists (select 1 from order_lines where order_id = p_order and product_id = p.id and pack_id is not distinct from v_pack) then
    perform _err('invalid_quantity');
  end if;
  insert into order_lines (order_id, position, product_id, pack_id, name_fr, name_ar, category_id, mode, step, pack_label, requested, approved, changed_by_shop)
  values (p_order, p_pos, p.id, v_pack, p.name_fr, p.name_ar, p.category_id, p.mode, p.step, k.label, v_qty, v_qty, p_changed);
end $$;

/* ---------------- shop ---------------- */

create function public.submit_order(p_id uuid, p_lines jsonb, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_shop text;
  v_biz date := business_date(now());
  v_seq int;
  v_existing orders;
  v_elem jsonb;
  v_pos int := 0;
begin
  perform _require_role(array['shop']::user_role[]);
  v_shop := auth_shop_id();
  select * into v_existing from orders where id = p_id;
  if found then -- idempotent retry of the same order
    if v_existing.shop_id <> v_shop then perform _err('forbidden'); end if;
    return order_json(p_id, 'shop');
  end if;
  if char_length(coalesce(p_note, '')) > 160 then perform _err('text_too_long', '{"limit":"160"}'); end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then perform _err('empty_order'); end if;
  perform pg_advisory_xact_lock(hashtext('order-code:' || v_shop));
  select count(*) + 1 into v_seq from orders where shop_id = v_shop and business_date = v_biz;
  insert into orders (id, code, shop_id, business_date, shop_note)
  values (p_id, (select code from shops where id = v_shop) || '-' || to_char(v_biz, 'MMDD') || '-' || lpad(v_seq::text, 2, '0'), v_shop, v_biz, btrim(coalesce(p_note, '')));
  for v_elem in select * from jsonb_array_elements(p_lines) loop
    v_pos := v_pos + 1;
    perform _insert_line(p_id, v_pos, v_elem, false);
  end loop;
  perform _event(p_id, 'submitted', null, 'submitted');
  return order_json(p_id, 'shop');
end $$;

create function public.update_pending_order(p_id uuid, p_version int, p_lines jsonb, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  v_elem jsonb;
  v_pos int := 0;
  v_keep uuid[] := '{}';
  v_match uuid;
begin
  perform _require_role(array['shop']::user_role[]);
  select * into o from orders where id = p_id for update;
  if not found or o.shop_id <> auth_shop_id() then perform _err('not_found'); end if;
  if o.status not in ('submitted', 'in_review') then perform _err('invalid_state', jsonb_build_object('status', o.status)); end if;
  if o.version <> p_version then perform _err('stale_version'); end if;
  if char_length(coalesce(p_note, '')) > 160 then perform _err('text_too_long', '{"limit":"160"}'); end if;
  if p_lines is null or jsonb_array_length(p_lines) = 0 then perform _err('empty_order'); end if;
  -- unchanged lines (same product, pack and quantity) keep their id and the reviewer's decision
  for v_elem in select * from jsonb_array_elements(p_lines) loop
    select id into v_match from order_lines
    where order_id = p_id and product_id = v_elem ->> 'productId' and pack_id is not distinct from nullif(v_elem ->> 'packId', '')
      and requested = (v_elem ->> 'qty')::int and not (id = any (v_keep));
    if found then v_keep := v_keep || v_match; end if;
  end loop;
  delete from order_lines where order_id = p_id and not (id = any (v_keep));
  for v_elem in select * from jsonb_array_elements(p_lines) loop
    v_pos := v_pos + 1;
    select id into v_match from order_lines
    where order_id = p_id and product_id = v_elem ->> 'productId' and pack_id is not distinct from nullif(v_elem ->> 'packId', '')
      and requested = (v_elem ->> 'qty')::int;
    if found then
      update order_lines set position = v_pos where id = v_match;
    else
      perform _insert_line(p_id, v_pos, v_elem, o.status = 'in_review');
    end if;
  end loop;
  update orders set shop_note = btrim(coalesce(p_note, '')), version = version + 1,
    edited_during_review = edited_during_review or status = 'in_review'
  where id = p_id;
  perform _event(p_id, 'shop_edited', o.status, o.status);
  return order_json(p_id, 'shop');
end $$;

create function public.cancel_order(p_id uuid, p_version int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := _require_role(array['shop', 'owner', 'deputy']::user_role[]);
  o orders;
begin
  select * into o from orders where id = p_id for update;
  if not found or (v_role = 'shop' and o.shop_id <> auth_shop_id()) then perform _err('not_found'); end if;
  if o.version <> p_version then perform _err('stale_version'); end if;
  if (v_role = 'shop' and o.status not in ('submitted', 'in_review')) or (v_role <> 'shop' and o.status <> 'validated') then
    perform _err('invalid_state', jsonb_build_object('status', o.status));
  end if;
  update orders set status = 'cancelled', cancelled_at = now(), version = version + 1 where id = p_id;
  perform _event(p_id, 'cancelled', o.status, 'cancelled');
  return order_json(p_id, v_role);
end $$;

create function public.confirm_received(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  perform _require_role(array['shop']::user_role[]);
  select * into o from orders where id = p_id for update;
  if not found or o.shop_id <> auth_shop_id() then perform _err('not_found'); end if;
  if o.status = 'received' then return order_json(p_id, 'shop'); end if; -- idempotent
  if o.status <> 'ready' then perform _err('invalid_state', jsonb_build_object('status', o.status)); end if;
  update orders set status = 'received', received_at = now(), version = version + 1 where id = p_id;
  perform _event(p_id, 'received', 'ready', 'received');
  return order_json(p_id, 'shop');
end $$;

/* ---------------- review (owner / deputy) ---------------- */

create function public.start_review(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := _require_role(array['owner', 'deputy']::user_role[]);
  o orders;
begin
  select * into o from orders where id = p_id for update;
  if not found then perform _err('not_found'); end if;
  if o.status not in ('submitted', 'in_review') then perform _err('invalid_state', jsonb_build_object('status', o.status)); end if;
  if o.status = 'in_review' then
    if o.reviewer_role = v_role then return order_json(p_id, v_role); end if;
    if o.review_started_at > now() - interval '10 minutes' then perform _err('locked', jsonb_build_object('by', o.reviewer_name)); end if;
  end if;
  update orders set status = 'in_review', reviewer_role = v_role, reviewer_name = auth_name(), review_started_at = now() where id = p_id;
  perform _event(p_id, 'review_started', o.status, 'in_review');
  return order_json(p_id, v_role);
end $$;

create function public.release_review(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := _require_role(array['owner', 'deputy']::user_role[]);
  o orders;
begin
  select * into o from orders where id = p_id for update;
  if not found or o.status <> 'in_review' or o.reviewer_role <> v_role then return; end if;
  update orders set status = 'submitted', reviewer_role = null, reviewer_name = null where id = p_id;
  perform _event(p_id, 'review_released', 'in_review', 'submitted');
end $$;

create function public.decide_order(p_id uuid, p_version int, p_decisions jsonb, p_lab_note text, p_team public.team_code) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := _require_role(array['owner', 'deputy']::user_role[]);
  o orders;
  l order_lines;
  d jsonb;
  v_approved int;
  v_note text;
  v_reason text;
  v_kept int := 0;
begin
  select * into o from orders where id = p_id for update;
  if not found then perform _err('not_found'); end if;
  if o.status <> 'in_review' then perform _err('invalid_state', jsonb_build_object('status', o.status)); end if;
  if o.reviewer_role is distinct from v_role then perform _err('locked', jsonb_build_object('by', coalesce(o.reviewer_name, ''))); end if;
  if o.version <> p_version then perform _err('stale_version'); end if;
  if char_length(coalesce(p_lab_note, '')) > 160 then perform _err('text_too_long', '{"limit":"160"}'); end if;
  if p_team is null then perform _err('invalid_state'); end if;

  for l in select * from order_lines where order_id = p_id order by position loop
    select e.value into d from jsonb_array_elements(p_decisions) e where e.value ->> 'lineId' = l.id::text;
    if d is null then perform _err('invalid_state', jsonb_build_object('line', l.id)); end if;
    v_note := nullif(btrim(coalesce(d ->> 'note', '')), '');
    v_reason := nullif(btrim(coalesce(d ->> 'refusalReason', '')), '');
    if char_length(v_note) > 80 or char_length(v_reason) > 80 then perform _err('text_too_long', '{"limit":"80"}'); end if;
    if d ->> 'decision' = 'refused' then
      if v_reason is null then perform _err('reason_required'); end if;
      update order_lines set decision = 'refused', approved = 0, refusal_reason = v_reason, changed_by_shop = false where id = l.id;
    else
      v_approved := case when d ->> 'decision' = 'accepted' then l.requested else (d ->> 'approved')::int end;
      if v_approved is null or v_approved < l.step or v_approved > l.requested or v_approved % l.step <> 0 then perform _err('invalid_quantity'); end if;
      update order_lines set approved = v_approved, decision = case when v_approved < l.requested then 'reduced' else 'accepted' end::line_decision,
        refusal_reason = null, changed_by_shop = false where id = l.id;
      v_kept := v_kept + 1;
      if v_note is not null then
        insert into order_notes (order_id, line_id, body, author_role, author_name) values (p_id, l.id, v_note, v_role, auth_name());
      end if;
    end if;
    d := null;
  end loop;
  if nullif(btrim(coalesce(p_lab_note, '')), '') is not null then
    insert into order_notes (order_id, body, author_role, author_name) values (p_id, btrim(p_lab_note), v_role, auth_name());
  end if;

  if v_kept = 0 then
    update orders set status = 'refused', refused_at = now(), version = version + 1, edited_during_review = false where id = p_id;
    perform _event(p_id, 'refused', 'in_review', 'refused');
  else
    update orders set status = 'validated', validated_at = now(), team = p_team, version = version + 1, edited_during_review = false where id = p_id;
    perform _event(p_id, 'validated', 'in_review', 'validated', null, p_team::text);
  end if;
  return order_json(p_id, v_role);
end $$;

create function public.add_note(p_order uuid, p_line uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := _require_role(array['owner', 'deputy']::user_role[]);
  o orders;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into o from orders where id = p_order for update;
  if not found then perform _err('not_found'); end if;
  if o.status not in ('validated', 'in_preparation') then perform _err('invalid_state', jsonb_build_object('status', o.status)); end if;
  if v_body = '' then perform _err('reason_required'); end if;
  if char_length(v_body) > (case when p_line is null then 160 else 80 end) then perform _err('text_too_long'); end if;
  if p_line is not null and not exists (select 1 from order_lines where id = p_line and order_id = p_order) then perform _err('not_found'); end if;
  insert into order_notes (order_id, line_id, body, author_role, author_name) values (p_order, p_line, v_body, v_role, auth_name());
  perform _event(p_order, 'note_added', o.status, o.status, p_line);
  return order_json(p_order, v_role);
end $$;

/* ---------------- labo ---------------- */

create function public.get_labo_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s labo_state;
begin
  perform _require_role(array['labo', 'owner', 'deputy']::user_role[]);
  select * into s from labo_state where singleton;
  return jsonb_build_object('team', s.team, 'since', s.since);
end $$;

create function public.switch_labo_team(p_team public.team_code, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text;
begin
  perform _require_role(array['labo']::user_role[]);
  select pin_hash into v_hash from labo_teams where code = p_team;
  if v_hash is null or crypt(coalesce(p_pin, ''), v_hash) <> v_hash then
    perform pg_sleep(0.5); -- slows down guessing
    perform _err('wrong_pin');
  end if;
  insert into labo_state (singleton, team, since) values (true, p_team, now())
  on conflict (singleton) do update set team = excluded.team, since = excluded.since;
  return get_labo_state();
end $$;

create function public.set_line_prep(p_order uuid, p_line uuid, p_prep public.prep_status, p_qty int, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  l order_lines;
  v_team team_code := _labo_team();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform _require_role(array['labo']::user_role[]);
  if v_team is null then perform _err('forbidden'); end if;
  select * into o from orders where id = p_order for update;
  if not found then perform _err('not_found'); end if;
  if o.status not in ('validated', 'in_preparation') then perform _err('invalid_state', jsonb_build_object('status', o.status)); end if;
  select * into l from order_lines where id = p_line and order_id = p_order;
  if not found or l.decision = 'refused' then perform _err('not_found'); end if;
  if p_prep in ('partial', 'not_done') then
    if v_reason is null then perform _err('reason_required'); end if;
    if char_length(v_reason) > 80 then perform _err('text_too_long', '{"limit":"80"}'); end if;
  end if;
  if p_prep = 'partial' and (p_qty is null or p_qty <= 0 or p_qty >= l.approved or p_qty % l.step <> 0) then perform _err('invalid_quantity'); end if;
  -- idempotent replay from the outbox
  if l.prep = p_prep and l.prepared_qty is not distinct from (case when p_prep = 'partial' then p_qty end)
     and l.labo_reason is not distinct from (case when p_prep in ('partial', 'not_done') then v_reason end) then
    return order_json(p_order, 'labo');
  end if;
  update order_lines set prep = p_prep,
    prepared_qty = case when p_prep = 'partial' then p_qty end,
    labo_reason = case when p_prep in ('partial', 'not_done') then v_reason end,
    prep_team = case when p_prep = 'todo' then null else v_team end
  where id = p_line;
  if o.status = 'validated' then
    update orders set status = 'in_preparation', prep_started_at = now() where id = p_order;
    perform _event(p_order, 'prep_started', 'validated', 'in_preparation');
  end if;
  perform _event(p_order, case when p_prep in ('partial', 'not_done') then 'line_problem' else 'line_prepped' end,
    'in_preparation', 'in_preparation', p_line, p_prep::text);
  return order_json(p_order, 'labo');
end $$;

create function public.close_order(p_id uuid, p_version int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  v_team team_code := _labo_team();
begin
  perform _require_role(array['labo']::user_role[]);
  if v_team is null then perform _err('forbidden'); end if;
  select * into o from orders where id = p_id for update;
  if not found then perform _err('not_found'); end if;
  if o.status <> 'in_preparation' then perform _err('invalid_state', jsonb_build_object('status', o.status)); end if;
  if o.version <> p_version then perform _err('stale_version'); end if;
  if exists (select 1 from order_lines where order_id = p_id and decision <> 'refused' and prep = 'todo') then
    perform _err('invalid_state', '{"reason":"lines_todo"}');
  end if;
  update orders set status = 'ready', ready_at = now(), version = version + 1 where id = p_id;
  perform _event(p_id, 'ready', 'in_preparation', 'ready', null, v_team::text);
  return order_json(p_id, 'labo');
end $$;
