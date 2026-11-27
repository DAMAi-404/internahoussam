-- Web Push dispatch: each notification flagged `push` is posted to the `notify` edge function (pg_net).
-- The function URL and a shared secret are stored in app_config at go-live (see docs/GO_LIVE.md).

create table public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

create function public.dispatch_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select value from app_config where key = 'notify_url');
  v_secret text := (select value from app_config where key = 'notify_secret');
begin
  if new.push and v_url is not null and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(v_secret, '')),
      body := jsonb_build_object('record', to_jsonb(new))
    );
  end if;
  return null;
end $$;
revoke execute on function public.dispatch_push() from public, anon, authenticated;

create trigger notifications_push after insert on public.notifications for each row execute function public.dispatch_push();

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;
