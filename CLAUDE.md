# CLAUDE.md

Guidance for Claude Code (and any contributor) working in this repository.

## What this is

**Mahroussa Pro**: an internal PWA that carries an order from a shop → the owner → the labo (central kitchen) for El Mahroussa (12 shops). Read `docs/PRD.md` before any feature work. The spec docs are the source of truth:

- `docs/PRD.md`: requirements (IDs like `SHP-3`, `OWN-5`), state machine, open questions
- `docs/ROLES.md`: permission matrix (must match RLS)
- `docs/ARCHITECTURE.md`: stack, schema, RPCs, offline, push
- `docs/DESIGN_SYSTEM.md`: tokens, components, UX rules

If code and docs disagree, stop and ask. Don't silently pick one. Update the doc in the same PR when a decision changes.

## Priorities, in order

1. **No lost or corrupted orders.** Correctness beats features.
2. **Simplicity for shop users.** Fewer taps, no typing, no jargon. If a flow needs explaining, redesign it.
3. **Accurate tracking.** Every state change is audited.
4. Speed and polish.

## Hard rules

### Scope
- **Never** add prices, payment, stock or invoicing. They are out of scope by decision.

### Data integrity
- Order state changes happen **only** through Postgres RPCs in `supabase/migrations`. The client never `insert`s/`update`s `orders`, `order_lines` or `order_events` directly.
- Every RPC that mutates an order: checks role + scope + current status + `version`, writes the change **and** an `order_events` row in the same transaction.
- `order_events` is append-only. The **only** deletion is the nightly retention job `purge_old_orders()` (30 days, final-status orders only, see ARCHITECTURE §10). Never write any other update or delete on it.
- After validation, nothing changes quantities. Owner/deputy additions go through `add_note` (append-only).
- Quantities are **integers in base units** (pieces, grams, millilitres, packs). No floats anywhere in the quantity path. Formatting lives in `src/lib/quantity.ts` only.
- Reviewer actions accept role `owner` **or** `deputy` and always store who acted.
- Order lines store a **snapshot** of product name/pack/mode. Never join to `products` to display a historical order.
- Order IDs are client-generated UUIDs. `submit_order` must stay idempotent.
- Products, packs and categories are deactivated, never hard-deleted.
- Times are stored in UTC and displayed in `Africa/Algiers`. Use `business_date` (04:00 cutoff = shift change) for "today", not the calendar date.

### Security
- RLS enabled on every table. A new table without policies + pgTAP tests is not mergeable.
- Any change to `docs/ROLES.md` requires matching changes in `supabase/tests/rls_*.sql`, and vice versa.
- Never ship the service-role key to the client. Never log PINs, tokens or push keys.

### Offline & realtime
- Realtime events only **invalidate** queries. Never patch cache from realtime payloads.
- Always refetch on focus / reconnect.
- Anything queued offline goes through the outbox (`src/lib/outbox.ts`) with an idempotency key, and must be visible to the user until confirmed.

### UI
- Use design-system components from `src/components/ui`. Don't hand-roll buttons, pills or sheets in features.
- Status is displayed only via `<StatusPill>` (coloured dot + word).
- Touch targets ≥ 48 px (labo ≥ 64 px). One primary action per screen, at the bottom.
- CSS logical properties only (`ms-`, `pe-`, `start-`). No `left`/`right`/`ml`/`pr`. Must work in RTL.
- Every user-facing string goes through i18n with both `ar` and `fr` keys. No hard-coded text.
- Wrap number+unit in `<bdi>` so it never reorders in RTL.
- Brand: **Mahroussa green + beige** (tokens in DESIGN_SYSTEM.md). **No decorative icons**: no coloured icon tiles, no icon per category, no emoji. Products are shown with the owner's photos. Icons only where they do a job (back, share, search, tab bar).
- Visual language is **iOS (Apple HIG)**: inset grouped lists, sheets with a grabber, segmented controls, translucent bars, spring motion. No Material patterns (ripples, FABs, floating labels). Follow `docs/DESIGN_SYSTEM.md`.
- Never use SF Pro font files or SF Symbols: their licence only allows Apple platforms. Use the system font stack + Lucide icons as specified.
- Inputs use a font size ≥ 16 px (iOS zooms the page on smaller inputs).
- Avoid ambiguous labels. The owner rejected "Recommander" for this reason. Test labels against "could a tired shop manager misread this?"

## Conventions

- TypeScript strict. No `any` (use `unknown` + narrowing). DB types come from `src/types/database.ts` (generated, never hand-edited).
- Feature folders under `src/features/<feature>`. Shared code goes in `src/lib` and `src/components/ui`.
- TanStack Query keys: `['orders', scope, id?]`, `['catalog']`, etc. Define them in `src/lib/queryKeys.ts`.
- Migrations: `supabase migration new <verb_noun>`. Never edit a migration that is already merged; add a new one.
- Commits: conventional (`feat(review): …`, `fix(outbox): …`). Reference the PRD ID when relevant.

## Commands (target, filled in once scaffolded)

```bash
pnpm dev                 # client
supabase start           # local backend
supabase db reset        # apply migrations + seed
supabase test db         # pgTAP (RLS + RPC)
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e                 # Playwright (pass --trace off unless debugging)
supabase gen types typescript --local > src/types/database.ts
```

## Definition of done (per PR)

- [ ] Typecheck, lint, unit, pgTAP and e2e pass
- [ ] New/changed RPC has pgTAP tests, including a wrong-role case and a stale-version case
- [ ] UI checked in `ar` (RTL) and `fr`, at 360 px width, plus the labo tablet at 1024 × 768 landscape when relevant
- [ ] Offline behaviour considered for any new mutation
- [ ] Docs updated if behaviour or a decision changed
