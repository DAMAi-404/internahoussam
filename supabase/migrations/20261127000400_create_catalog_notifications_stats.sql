/* ---------------- catalogue ---------------- */

create function public.get_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', jsonb_build_object('fr', c.name_fr, 'ar', c.name_ar), 'sort', c.sort, 'active', c.active) order by c.sort) from categories c), '[]'),
    'products', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'categoryId', p.category_id, 'name', jsonb_build_object('fr', p.name_fr, 'ar', p.name_ar),
        'description', jsonb_build_object('fr', p.desc_fr, 'ar', p.desc_ar), 'photo', p.photo_url, 'mode', p.mode,
        'step', p.step, 'max', p.max_qty, 'active', p.active, 'sort', p.sort,
        'packs', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'label', k.label, 'active', k.active) order by k.sort) from product_packs k where k.product_id = p.id), '[]'))
      order by p.sort) from products p), '[]'))
  where auth.uid() is not null
$$;

-- Owner only. Packs are upserted, never deleted (they may appear in past orders): switch them off instead.
create function public.save_product(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_id text := coalesce(nullif(p ->> 'id', ''), gen_random_uuid()::text);
  v_mode quantity_mode := (p ->> 'mode')::quantity_mode;
  k jsonb;
  v_sort int := 0;
begin
  perform _require_role(array['owner']::user_role[]);
  insert into products (id, category_id, name_fr, name_ar, desc_fr, desc_ar, photo_url, mode, step, max_qty, active, sort, updated_at)
  values (v_id, p ->> 'categoryId', btrim(p #>> '{name,fr}'), btrim(coalesce(p #>> '{name,ar}', '')),
          btrim(coalesce(p #>> '{description,fr}', '')), btrim(coalesce(p #>> '{description,ar}', '')), nullif(p ->> 'photo', ''),
          v_mode, case when v_mode = 'pack' then 1 else (p ->> 'step')::int end, nullif(p ->> 'max', '')::int,
          coalesce((p ->> 'active')::boolean, true), coalesce((p ->> 'sort')::int, (select coalesce(max(sort), 0) + 1 from products)), now())
  on conflict (id) do update set category_id = excluded.category_id, name_fr = excluded.name_fr, name_ar = excluded.name_ar,
    desc_fr = excluded.desc_fr, desc_ar = excluded.desc_ar, photo_url = excluded.photo_url, mode = excluded.mode, step = excluded.step,
    max_qty = excluded.max_qty, active = excluded.active, updated_at = now();
  for k in select * from jsonb_array_elements(coalesce(p -> 'packs', '[]')) loop
    v_sort := v_sort + 1;
    insert into product_packs (product_id, id, label, active, sort)
    values (v_id, k ->> 'id', btrim(k ->> 'label'), coalesce((k ->> 'active')::boolean, true), v_sort)
    on conflict (product_id, id) do update set label = excluded.label, active = excluded.active, sort = excluded.sort;
  end loop;
  if v_mode = 'pack' and not exists (select 1 from product_packs where product_id = v_id and active) and coalesce((p ->> 'active')::boolean, true) then
    perform _err('invalid_quantity');
  end if;
end $$;

create function public.set_product_active(p_id text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_role(array['owner', 'deputy']::user_role[]);
  update products set active = p_active, updated_at = now() where id = p_id;
  if not found then perform _err('not_found'); end if;
end $$;

create function public.set_pack_active(p_product text, p_pack text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_role(array['owner', 'deputy']::user_role[]);
  update product_packs set active = p_active where product_id = p_product and id = p_pack;
  if not found then perform _err('not_found'); end if;
end $$;

/* ---------------- notifications (PRD §6.8, mirrors src/domain/notifications.ts) ---------------- */

create function public._notify(p_recipient text, p_actor text, p_type text, p_push boolean, o orders, p_extra jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into notifications (recipient, type, order_id, params, push)
  select p_recipient, p_type, o.id,
    jsonb_build_object('code', o.code, 'shopId', o.shop_id, 'lines', (select count(*) from order_lines where order_id = o.id)) || p_extra, p_push
  where p_recipient is distinct from p_actor
$$;

create function public.notify_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  v_actor text;
  v_shop text;
  v_changed int;
  r text;
begin
  select * into o from orders where id = new.order_id;
  v_shop := 'shop:' || o.shop_id;
  v_actor := case when new.actor_role = 'shop' then v_shop else new.actor_role::text end;
  case new.type
    when 'submitted' then
      foreach r in array array['owner', 'deputy'] loop perform _notify(r, v_actor, 'order_submitted', true, o); end loop;
    when 'shop_edited', 'cancelled' then
      if new.type = 'cancelled' and new.actor_role <> 'shop' then
        perform _notify(v_shop, v_actor, 'order_deleted', true, o);
      else
        foreach r in array array['owner', 'deputy'] loop
          perform _notify(r, v_actor, case when new.type = 'shop_edited' then 'order_edited' else 'order_deleted' end,
            new.from_status = 'in_review' and o.reviewer_role::text = r, o);
        end loop;
      end if;
    when 'validated' then
      select count(*) into v_changed from order_lines where order_id = o.id and decision <> 'accepted';
      perform _notify(v_shop, v_actor, case when v_changed > 0 then 'order_validated_changed' else 'order_validated' end, true, o, jsonb_build_object('changed', v_changed));
      perform _notify('labo', v_actor, 'order_validated', true, o, jsonb_build_object('team', o.team));
    when 'refused' then
      perform _notify(v_shop, v_actor, 'order_refused', true, o);
    when 'prep_started' then
      foreach r in array array['owner', 'deputy', v_shop] loop perform _notify(r, v_actor, 'prep_started', false, o); end loop;
    when 'line_problem' then
      foreach r in array array['owner', 'deputy'] loop perform _notify(r, v_actor, 'line_problem', false, o); end loop;
    when 'note_added' then
      perform _notify('labo', v_actor, 'note_added', true, o);
    when 'ready' then
      foreach r in array array['owner', 'deputy', v_shop] loop perform _notify(r, v_actor, 'order_ready', true, o); end loop;
    when 'received' then
      foreach r in array array['owner', 'deputy'] loop perform _notify(r, v_actor, 'order_received', true, o); end loop;
    else null;
  end case;
  return null;
end $$;

create trigger order_events_notify after insert on public.order_events for each row execute function public.notify_event();

create function public.list_notifications() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id::text, 'recipient', n.recipient, 'type', n.type, 'orderId', n.order_id,
    'params', n.params, 'push', n.push, 'at', n.created_at, 'readAt', n.read_at) order by n.created_at desc), '[]')
  from (select * from notifications where recipient = my_recipient() order by created_at desc limit 200) n
$$;

create function public.mark_notifications_read(p_ids text[] default null) returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now()
  where recipient = my_recipient() and read_at is null and (p_ids is null or id::text = any (p_ids))
$$;

create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then perform _err('not_signed_in'); end if;
  insert into push_subscriptions (endpoint, user_id, recipient, p256dh, auth)
  values (p_endpoint, auth.uid(), my_recipient(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, recipient = excluded.recipient,
    p256dh = excluded.p256dh, auth = excluded.auth, last_seen_at = now();
end $$;

/* ---------------- scheduled reminders (pg_cron, every 5 min) ---------------- */

create function public.last_shift_start(ts timestamptz default now()) returns timestamptz
language sql immutable as $$
  select (date_trunc('hour', ts at time zone 'Africa/Algiers') - make_interval(hours =>
    case when extract(hour from ts at time zone 'Africa/Algiers') >= 16 then extract(hour from ts at time zone 'Africa/Algiers')::int - 16
         when extract(hour from ts at time zone 'Africa/Algiers') >= 4 then extract(hour from ts at time zone 'Africa/Algiers')::int - 4
         else extract(hour from ts at time zone 'Africa/Algiers')::int + 8 end)) at time zone 'Africa/Algiers'
$$;

create function public.run_scheduled_notifications() returns void
language plpgsql security definer set search_path = public as $$
declare
  o orders;
  r text;
  v_boundary timestamptz := last_shift_start(now());
  v_since timestamptz := (select since from labo_state where singleton);
begin
  for o in select * from orders where status = 'submitted' and submitted_at < now() - interval '15 minutes'
           and not exists (select 1 from scheduled_sent where key = 'waiting:' || orders.id) loop
    insert into scheduled_sent (key) values ('waiting:' || o.id);
    foreach r in array array['owner', 'deputy'] loop perform _notify(r, null, 'order_waiting', true, o); end loop;
  end loop;
  if (v_since is null or v_since < v_boundary) and now() > v_boundary + interval '15 minutes'
     and not exists (select 1 from scheduled_sent where key = 'handover:' || v_boundary) then
    insert into scheduled_sent (key) values ('handover:' || v_boundary);
    insert into notifications (recipient, type, params, push) values ('owner', 'handover_missing', '{}', true);
  end if;
end $$;

/* ---------------- statistics + retention (PRD §6.9, §6.10) ---------------- */

create function public.aggregate_day(p_date date) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from daily_totals where business_date = p_date;
  insert into daily_totals (business_date, shop_id, product_id, pack_label, mode, name_fr, name_ar, category_id, lines, refused_lines, problem_lines, quantity)
  select o.business_date, o.shop_id, l.product_id, coalesce(l.pack_label, ''), min(l.mode::text)::quantity_mode, min(l.name_fr), min(l.name_ar), min(l.category_id),
         count(*), count(*) filter (where l.decision = 'refused'), count(*) filter (where l.prep in ('partial', 'not_done')),
         coalesce(sum(case when l.decision = 'refused' or o.status not in ('validated', 'in_preparation', 'ready', 'received') then 0
                           when l.prep = 'partial' then l.prepared_qty when l.prep = 'not_done' then 0 else l.approved end), 0)
  from orders o join order_lines l on l.order_id = o.id
  where o.business_date = p_date and o.status <> 'cancelled'
  group by o.business_date, o.shop_id, l.product_id, coalesce(l.pack_label, '');

  delete from daily_shop_stats where business_date = p_date;
  insert into daily_shop_stats (business_date, shop_id, orders, refused_orders, median_review_min, median_ready_min)
  select business_date, shop_id, count(*), count(*) filter (where status = 'refused'),
         round(percentile_cont(0.5) within group (order by extract(epoch from coalesce(validated_at, refused_at) - submitted_at) / 60))::int,
         round(percentile_cont(0.5) within group (order by extract(epoch from ready_at - validated_at) / 60))::int
  from orders where business_date = p_date and status <> 'cancelled'
  group by business_date, shop_id;
end $$;

-- The ONLY code allowed to delete orders and their events (CLAUDE.md > Data integrity).
create function public.purge_old_orders(p_days int default 30) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_cutoff date := business_date(now()) - p_days;
  v_date date;
  v_count int;
begin
  for v_date in select distinct business_date from orders where business_date < v_cutoff loop
    perform aggregate_day(v_date); -- keep statistics before deleting
  end loop;
  delete from orders where business_date < v_cutoff and status in ('received', 'ready', 'refused', 'cancelled');
  get diagnostics v_count = row_count;
  delete from notifications where created_at < now() - interval '30 days';
  delete from scheduled_sent where created_at < now() - interval '30 days';
  delete from daily_totals where business_date < business_date(now()) - interval '13 months';
  delete from daily_shop_stats where business_date < business_date(now()) - interval '13 months';
  insert into purge_runs (cutoff_date, orders_deleted) values (v_cutoff, v_count);
  return v_count;
end $$;

-- Live data for the last 31 days, daily aggregates before that. Shops only ever see themselves.
create function public.stats_range(p_from date, p_to date, p_shop text default null, p_category text default null, p_product text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_role user_role := _require_role(array['owner', 'deputy', 'shop']::user_role[]);
  v_shop text := case when v_role = 'shop' then auth_shop_id() else p_shop end;
  v_live_from date := business_date(now()) - 31;
  v_result jsonb;
begin
  with
  lo as (
    select o.* from orders o
    where o.business_date between greatest(p_from, v_live_from) and p_to and o.status <> 'cancelled'
      and (v_shop is null or o.shop_id = v_shop)
      and exists (select 1 from order_lines l where l.order_id = o.id and (p_category is null or l.category_id = p_category) and (p_product is null or l.product_id = p_product))
  ),
  ll as (
    select o.business_date, o.shop_id, o.status, l.* from lo o join order_lines l on l.order_id = o.id
    where (p_category is null or l.category_id = p_category) and (p_product is null or l.product_id = p_product)
  ),
  agg as (
    select * from daily_totals t
    where t.business_date between p_from and least(p_to, v_live_from - 1) and (v_shop is null or t.shop_id = v_shop)
      and (p_category is null or t.category_id = p_category) and (p_product is null or t.product_id = p_product)
  ),
  agg_shop as (
    select * from daily_shop_stats s where s.business_date between p_from and least(p_to, v_live_from - 1) and (v_shop is null or s.shop_id = v_shop)
  ),
  days as (select d::date as d from generate_series(p_from, p_to, interval '1 day') d),
  per_day as (
    select d.d, coalesce((select count(*) from lo where lo.business_date = d.d), 0)
              + coalesce((select sum(orders) from agg_shop where agg_shop.business_date = d.d), 0) as n
    from days d
  ),
  prod as (
    select product_id, pack_label, mode, name_fr, name_ar, sum(q)::int as quantity, count(distinct shop_id) as shops from (
      select product_id, coalesce(pack_label, '') as pack_label, mode, name_fr, name_ar, shop_id,
        case when decision = 'refused' or status not in ('validated', 'in_preparation', 'ready', 'received') then 0
             when prep = 'partial' then prepared_qty when prep = 'not_done' then 0 else approved end as q
      from ll
      union all select product_id, pack_label, mode, name_fr, name_ar, shop_id, quantity from agg
    ) x group by product_id, pack_label, mode, name_fr, name_ar having sum(q) > 0
  ),
  shop_rows as (
    select shop_id, sum(orders)::int as orders, sum(lines)::int as lines, sum(refused)::int as refused from (
      select shop_id, count(*) as orders, 0 as lines, 0 as refused from lo group by shop_id
      union all select shop_id, 0, count(*), count(*) filter (where decision = 'refused') from ll group by shop_id
      union all select shop_id, orders, 0, 0 from agg_shop
      union all select shop_id, 0, sum(lines), sum(refused_lines) from agg group by shop_id
    ) x group by shop_id
  )
  select jsonb_build_object(
    'tiles', jsonb_build_object(
      'orders', (select count(*) from lo) + coalesce((select sum(orders) from agg_shop), 0),
      'lines', (select count(*) from ll) + coalesce((select sum(lines) from agg), 0),
      'refusedLines', (select count(*) filter (where decision = 'refused') from ll) + coalesce((select sum(refused_lines) from agg), 0),
      'problemLines', (select count(*) filter (where prep in ('partial', 'not_done')) from ll) + coalesce((select sum(problem_lines) from agg), 0),
      'medianReviewMin', (select round(percentile_cont(0.5) within group (order by extract(epoch from coalesce(validated_at, refused_at) - submitted_at) / 60))::int from lo where coalesce(validated_at, refused_at) is not null),
      'medianReadyMin', (select round(percentile_cont(0.5) within group (order by extract(epoch from ready_at - validated_at) / 60))::int from lo where ready_at is not null)),
    'perDay', (select jsonb_agg(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'orders', n) order by d) from per_day),
    'products', coalesce((select jsonb_agg(jsonb_build_object('productId', product_id, 'name', jsonb_build_object('fr', name_fr, 'ar', name_ar),
        'mode', mode, 'packLabel', nullif(pack_label, ''), 'quantity', quantity, 'shops', shops) order by shops desc, quantity desc) from prod), '[]'),
    'shops', coalesce((select jsonb_agg(jsonb_build_object('shopId', shop_id, 'orders', orders, 'lines', lines, 'refusedLines', refused) order by lines desc)
        from shop_rows where orders > 0), '[]'))
  into v_result;
  return v_result;
end $$;

/* ---------------- privileges ---------------- */

-- Supabase grants EXECUTE on new functions to anon/authenticated by default: lock everything, then open the API.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.auth_role(), public.auth_shop_id(), public.auth_name(), public.my_recipient(), public.business_date(timestamptz), public.is_reviewer(),
  public.list_orders(), public.order_json(uuid, public.user_role),
  public.submit_order(uuid, jsonb, text), public.update_pending_order(uuid, int, jsonb, text), public.cancel_order(uuid, int), public.confirm_received(uuid),
  public.start_review(uuid), public.release_review(uuid), public.decide_order(uuid, int, jsonb, text, public.team_code), public.add_note(uuid, uuid, text),
  public.get_labo_state(), public.switch_labo_team(public.team_code, text), public.set_line_prep(uuid, uuid, public.prep_status, int, text), public.close_order(uuid, int),
  public.get_catalog(), public.save_product(jsonb), public.set_product_active(text, boolean), public.set_pack_active(text, text, boolean),
  public.list_notifications(), public.mark_notifications_read(text[]), public.save_push_subscription(text, text, text),
  public.stats_range(date, date, text, text, text), public.last_shift_start(timestamptz)
to authenticated;
