-- Reference data (real) + Supabase platform wiring. Products are NOT seeded: the owner enters them.

insert into public.shops (id, code, name_fr, name_ar, sort) values
  ('madania', 'EMD', 'El Madania', 'المدنية', 1),
  ('1er-mai', 'PRM', '1er Mai', 'أول ماي', 2),
  ('sidi-abdelah', 'SAB', 'Sidi Abdelah', 'سيدي عبد الله', 3),
  ('kouba', 'KOU', 'Kouba', 'القبة', 4),
  ('rouiba', 'ROU', 'Rouiba', 'الرويبة', 5),
  ('birtouta', 'BIR', 'Birtouta', 'بئر توتة', 6),
  ('boulevard', 'BOU', 'Boulevard', 'البولفار', 7),
  ('ain-naadja', 'AIN', 'Aïn Naadja', 'عين النعجة', 8),
  ('bir-mourad-rais', 'BMR', 'Bir Mourad Raïs', 'بئر مراد رايس', 9),
  ('bachedjerah', 'BAC', 'Bachedjerah', 'باش جراح', 10),
  ('kitani', 'KIT', 'Kitani', 'الكيتاني', 11),
  ('koucha', 'KCH', 'Koucha', 'كوشة', 12);

insert into public.categories (id, name_fr, name_ar, sort) values
  ('glaces', 'Glaces', 'مثلجات', 1),
  ('crepes', 'Crêpes', 'كريب', 2),
  ('kachtouta', 'Kachtouta', 'كشطوطة', 3),
  ('patisserie', 'Pâtisserie', 'حلويات', 4),
  ('pizza', 'Pizza', 'بيتزا', 5),
  ('jus', 'Jus', 'عصير', 6),
  ('fruits', 'Fruits', 'فواكه', 7),
  ('supplements', 'Suppléments', 'إضافات', 8),
  ('ingredients', 'Ingrédients', 'مكونات', 9),
  ('emballage', 'Emballage', 'تغليف', 10);

-- Team PINs are set by scripts/setup-supabase.mjs. Until then they are random (nobody can switch team).
insert into public.labo_teams (code, pin_hash) values
  ('matin', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf'))),
  ('nuit', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')));
insert into public.labo_state (singleton, team, since) values (true, null, null);

-- Service role only: set a team PIN (used by the setup script).
create function public.set_team_pin(p_team public.team_code, p_pin text) returns void
language sql security definer set search_path = public, extensions as $$
  update labo_teams set pin_hash = crypt(p_pin, gen_salt('bf')) where code = p_team
$$;
revoke execute on function public.set_team_pin(public.team_code, text) from public, anon, authenticated;

-- Realtime: clients subscribe to these tables (RLS still applies to what they receive).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders, public.order_lines, public.order_notes,
      public.notifications, public.products, public.product_packs, public.labo_state;
  end if;
end $$;

-- Product photos: public read, owner writes (PRD CAT-5).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('product-photos', 'product-photos', true) on conflict (id) do nothing;
    execute $p$create policy product_photos_owner_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'product-photos' and public.auth_role() = 'owner')$p$;
    execute $p$create policy product_photos_owner_update on storage.objects for update to authenticated
      using (bucket_id = 'product-photos' and public.auth_role() = 'owner')$p$;
  end if;
end $$;

-- Scheduled jobs (needs the pg_cron extension, enabled by default on Supabase).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mahroussa-reminders', '*/5 * * * *', 'select public.run_scheduled_notifications()');
    perform cron.schedule('mahroussa-purge', '0 2 * * *', 'select public.purge_old_orders(30)'); -- 03:00 Algiers
  end if;
end $$;
