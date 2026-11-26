# CLAUDE.md

Guidance for Claude Code (and any contributor) working in this repository.

## What this is

**Mahroussa Pro**: an internal PWA that carries an order **shop → owner → labo → shop** for El Mahroussa (12 shops, one central kitchen). The specs are the source of truth. Read the relevant one before any change:

| Doc | Owns |
|---|---|
| `docs/PRD.md` | Requirements (IDs like `SHP-4`, `LAB-5`, `NTF-3`), state machine, notification matrix, decisions log |
| `docs/ROLES.md` | Permission matrix (must match RLS) |
| `docs/ARCHITECTURE.md` | Stack, schema, RPCs, notifications pipeline, stats, retention, file tree |
| `docs/DESIGN_SYSTEM.md` | Tokens, components, UX rules |
| `prototype/index.html` | Visual reference only (v0). **Docs win** where they differ. |

If code and docs disagree, stop and ask. Update the doc in the same PR when a decision changes, and add a line to the PRD decisions log.

## Priorities, in order

1. **No lost or corrupted orders.** Correctness beats features.
2. **Simplicity for shop users.** Fewer taps, no typing, no jargon. If a flow needs explaining, redesign it.
3. **Accurate tracking.** Every state change is audited and team-stamped.
4. Speed and polish.

## Hard rules

### Scope
- **Never** add prices, payment, stock, invoicing or data export. Statistics are about **quantities** only.

### Data integrity
- Order state changes happen **only** through Postgres RPCs in `supabase/migrations`. The client never `insert`s/`update`s `orders`, `order_lines`, `order_notes`, `order_events` or `notifications` directly (except `mark_notifications_read`).
- Every RPC that mutates an order checks role + scope + current status + `version`, and writes the change **and** an `order_events` row in the same transaction.
- `order_events` is append-only. The **only** deletion is the nightly `purge_old_orders()` (30 days, final-status orders, after `aggregate_day()`). Never write any other update or delete on it.
- After validation, quantities are frozen. Owner/deputy additions go through `add_note` (append-only).
- Quantities are **integers in base units** (pieces, grams, millilitres, packs). No floats in the quantity path. Formatting lives in `src/lib/quantity.ts` only.
- Text limits (`src/lib/limits.ts`) are mirrored by `CHECK` constraints in SQL: product description 80, line notes 80, order notes 160.
- Reviewer actions accept role `owner` **or** `deputy` and store who acted.
- Order lines store a **snapshot** of product name/pack/mode. Never join to `products` to display a past order.
- Order IDs are client-generated UUIDs. `submit_order` must stay idempotent.
- Products, packs and categories are deactivated, never hard-deleted.
- Times are stored in UTC and shown in `Africa/Algiers`. Use `businessDate()` (04:00 cutoff = shift change) for "today".

### Security
- RLS on every table. A new table without policies + pgTAP tests is not mergeable.
- `docs/ROLES.md` and `supabase/tests/rls_*.sql` change together.
- Never ship the service-role key to the client. Never log PINs, tokens or push keys.

### Offline & realtime
- Realtime events only **invalidate** queries. Never patch cache from realtime payloads.
- Always refetch on focus / reconnect.
- Anything queued offline goes through `src/lib/outbox.ts` with an idempotency key and stays visible until confirmed.

### Notifications
- Recipients are decided in SQL from the PRD §6.8 matrix, never in the client. Never notify the actor of their own action.
- One push per order at a time (`tag = order id`). Copy comes from i18n keys, short, starting with the shop or order code.

### UI (see DESIGN_SYSTEM.md)
- Use components from `src/components/ui`. Don't hand-roll buttons, pills, sheets or bubbles in features.
- Status only via `<StatusPill>` (dot + word, one colour per step).
- **An icon appears only when its action or state exists.** No note → no note icon. Not editable → no pen.
- **Functional icons replace sentences.** If a state can be an icon, it is not a sentence. No decorative icons, no emoji.
- **Repeated elements keep their size in every state.** Product cards never grow; quantity is a badge on the photo.
- **User text never overflows.** Enforce the limit, show a counter, `overflow-wrap: anywhere`. Long text lives in a `NoteBubble`, never inline in a row.
- **Sheets, bubbles and dialogs always use the light surface**, including in the labo night theme.
- Most urgent first: ready/new sections at the top of lists.
- Touch targets ≥ 44 px (labo rows ≥ 68 px). One primary action per screen, at the bottom.
- CSS logical properties only (`ms-`, `pe-`, `start-`). Must work in RTL. Number+unit in `<bdi>`.
- Every user-facing string goes through i18n with both `fr` and `ar` keys.
- Brand tokens and **Readex Pro** only (self-hosted). Tokens live in `src/styles/tokens.css` and are exposed to Tailwind 4 via `@theme` in `src/styles/index.css` (no `tailwind.config`). Lucide icons. Never SF Pro or SF Symbols (Apple-only licence).
- Inputs ≥ 16 px font (iOS zoom). Avoid ambiguous labels ("Recommander" was rejected): could a tired shop manager misread it?

## Conventions

- TypeScript strict. No `any` (use `unknown` + narrowing). DB types come from `src/types/database.ts` (generated).
- Feature folders `src/features/<feature>` (each has a README listing its PRD IDs). Shared code in `src/lib` and `src/components/ui`.
- TanStack Query keys only from `src/lib/queryKeys.ts`.
- Migrations: `supabase migration new <verb_noun>`. Never edit a merged migration.
- Commits: conventional (`feat(review): …`, `fix(outbox): …`), referencing PRD IDs.

## Commands

```bash
pnpm install
pnpm dev                 # client on http://localhost:5173
pnpm typecheck           # tsc --noEmit
pnpm lint
pnpm test                # vitest (unit)
pnpm build
supabase start           # local backend (Docker)
supabase db reset        # apply migrations + seed
supabase test db         # pgTAP (RLS + RPC)
supabase gen types typescript --local > src/types/database.ts
pnpm e2e                 # Playwright (pass --trace off unless debugging)
```

## Definition of done (per PR)

- [ ] typecheck, lint, unit, build, pgTAP (and e2e once present) pass
- [ ] New/changed RPC has pgTAP tests incl. a wrong-role and a stale-version case
- [ ] UI checked in `ar` (RTL) and `fr` at 360 px; labo in both team themes
- [ ] DESIGN_SYSTEM §8 checklist passes
- [ ] Offline behaviour considered for any new mutation
- [ ] Docs + PRD decisions log updated if behaviour changed
