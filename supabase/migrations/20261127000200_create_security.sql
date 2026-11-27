-- Row-level security (docs/ROLES.md). Reads go through RLS; writes only through functions.

create function public.auth_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where user_id = auth.uid()
$$;

create function public.auth_shop_id() returns text
language sql stable security definer set search_path = public as $$
  select shop_id from profiles where user_id = auth.uid()
$$;

create function public.auth_name() returns text
language sql stable security definer set search_path = public as $$
  select display_name from profiles where user_id = auth.uid()
$$;

-- Notification recipient key of the caller: 'owner' | 'deputy' | 'labo' | 'shop:<id>'.
create function public.my_recipient() returns text
language sql stable security definer set search_path = public as $$
  select case when role = 'shop' then 'shop:' || shop_id else role::text end from profiles where user_id = auth.uid()
$$;

create function public.business_date(ts timestamptz) returns date
language sql immutable as $$
  select ((ts at time zone 'Africa/Algiers') - interval '4 hours')::date
$$;

create function public.is_reviewer() returns boolean
language sql stable as $$ select public.auth_role() in ('owner', 'deputy') $$;

alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_packs enable row level security;
alter table public.labo_teams enable row level security;
alter table public.labo_state enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_notes enable row level security;
alter table public.order_events enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.scheduled_sent enable row level security;
alter table public.daily_totals enable row level security;
alter table public.daily_shop_stats enable row level security;
alter table public.purge_runs enable row level security;

-- No direct writes for app roles, anywhere.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on public.labo_teams, public.push_subscriptions, public.scheduled_sent, public.daily_totals, public.daily_shop_stats, public.purge_runs from anon, authenticated;

-- Reference data: shop names are shown on the login screen (before sign-in).
create policy shops_read on public.shops for select to anon, authenticated using (true);
create policy categories_read on public.categories for select to authenticated using (true);
create policy products_read on public.products for select to authenticated using (true);
create policy packs_read on public.product_packs for select to authenticated using (true);

create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.auth_role() = 'owner');

create policy labo_state_read on public.labo_state for select to authenticated
  using (public.auth_role() in ('owner', 'deputy', 'labo'));

-- Orders: reviewers see all, a shop its own, the labo only what was sent to it (ROLES §2).
create policy orders_read on public.orders for select to authenticated using (
  public.is_reviewer()
  or (public.auth_role() = 'shop' and shop_id = public.auth_shop_id())
  or (public.auth_role() = 'labo' and (status in ('validated', 'in_preparation', 'ready') or (status = 'received' and ready_at > now() - interval '1 day')))
);

-- Lines follow their order; the labo never sees refused lines.
create policy lines_read on public.order_lines for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id)
  and (public.auth_role() <> 'labo' or decision <> 'refused')
);

-- Owner notes are for the labo: shops don't see them.
create policy notes_read on public.order_notes for select to authenticated using (
  public.auth_role() in ('owner', 'deputy', 'labo') and exists (select 1 from public.orders o where o.id = order_id)
);

create policy events_read on public.order_events for select to authenticated using (
  public.auth_role() in ('owner', 'deputy', 'shop') and exists (select 1 from public.orders o where o.id = order_id)
);

create policy notifications_read on public.notifications for select to authenticated using (recipient = public.my_recipient());

grant usage on schema public to anon, authenticated;
grant select on public.shops to anon;
grant select on public.shops, public.categories, public.products, public.product_packs, public.profiles, public.labo_state,
  public.orders, public.order_lines, public.order_notes, public.order_events, public.notifications to authenticated;
