# supabase

Backend for Mahroussa Pro: schema, row-level security, order RPCs, triggers, cron jobs, edge functions and their tests. See `docs/ARCHITECTURE.md` §3–§10 and `docs/ROLES.md`.

## Planned migrations (Phase 0, in order)

| File | Content |
|---|---|
| `…_create_enums_and_reference.sql` | enums, shops, profiles, categories, labo_teams, refusal_reasons |
| `…_create_catalog.sql` | products (+ description ≤ 80), product_packs |
| `…_create_orders.sql` | orders, order_lines, order_notes, order_events (append-only grants), CHECK limits |
| `…_create_rls.sql` | helper functions `auth_role()`, `auth_shop_id()` + every policy from ROLES.md |
| `…_create_order_rpcs.sql` | submit / update_pending / cancel / start_review / release_review / decide / set_line_prep / close / confirm_received / add_note / switch_labo_team |
| `…_create_notifications.sql` | notifications table, `notify_recipients()`, trigger on order_events, `mark_notifications_read()` |
| `…_create_stats_and_retention.sql` | daily_totals, daily_shop_stats, `aggregate_day()`, `purge_old_orders()`, `stats_range()`, pg_cron schedules |

`tests/` holds one pgTAP file per area (`rls_*.sql`, `rpc_*.sql`, `purge_*.sql`). `functions/` holds `shop-login` and `notify`.

## Commands

```bash
supabase start
```

```bash
supabase db reset
```

```bash
supabase test db
```
