# Mahroussa Pro

Internal ordering app for **El Mahroussa**: shop → owner → labo (central kitchen) → shop.
It replaces WhatsApp messages and the paper register with one live, tracked order.

> No prices, no payment, no stock, no export. It carries the order, shows each step as it happens, and counts quantities.

## How it works

| Role | Does |
|---|---|
| **Shop** ×12 | Filters the catalogue, taps "+" on a product, picks the quantity, sends. Can edit or delete while the order waits. Sees it go En attente → Acceptée → En préparation → Prête → Livrée. |
| **Owner** + deputy | Gets a notification per order. Lines are accepted by default: pen to reduce, × to refuse, note for the labo. Follows everything in "Suivi", sees weekly/monthly activity, manages the catalogue. |
| **Labo** (morning / night) | Shared phone or tablet with a team handover and PIN. New orders first. Tap a line when it's prepared, report a problem on a line, close the order. |

Shops: El Madania, 1er Mai, Sidi Abdelah, Kouba, Rouiba, Birtouta, Boulevard, Aïn Naadja, Bir Mourad Raïs, Bachedjerah, Kitani, Koucha.

## Documentation

| Doc | Content |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Requirements, notification matrix, statistics, state machine, release plan, decisions |
| [docs/ROLES.md](docs/ROLES.md) | Roles, permission matrix, auth model |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, schema, RPCs, notifications pipeline, retention, **file tree** |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Brand tokens, components, UX rules |
| [prototype/index.html](prototype/index.html) | Clickable visual reference (v0): https://claude.ai/artifact/W4cty4yk6mQHQ94L8hDtJ8 |
| [CLAUDE.md](CLAUDE.md) | Rules for AI-assisted development |

## Stack

React 19 + TypeScript 6 + Vite 8 (PWA) · Tailwind CSS 4 · React Router 8 · TanStack Query · Zustand + IndexedDB · i18next (fr/ar) · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) · Web Push · Cloudflare Pages.

## Try it now (demo mode)

Without Supabase keys the app runs entirely in the browser with realistic data (20 days of history, live orders in every state).

```bash
pnpm install
```

```bash
pnpm dev
```

Open http://localhost:5173 and pick a role on the login screen (shop PIN `123456`, labo team PINs `1111` / `2222`). Open several tabs to play several devices at once: they stay in sync.

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Database (migrations + 67 pgTAP tests on a plain Postgres 16, no Docker):

```bash
PGHOST=/tmp PGPORT=54329 scripts/db/test-local.sh
```

## Go live

Follow [docs/GO_LIVE.md](docs/GO_LIVE.md): create the Supabase project, apply the migrations, run `scripts/setup-supabase.mjs`, deploy the `notify` function, set three env vars. The app switches from demo to Supabase automatically.

## Status

| Part | State |
|---|---|
| Shop app (catalogue, product sheet, cart, offline send, my orders, edit/delete, stats) | ✅ built, tested on an emulated iPhone (fr + ar) |
| Owner / deputy app (inbox, review, Suivi, notes, catalogue editor with photos, Activité) | ✅ |
| Labo app (team themes, handover PIN, alarm, problem sheet, close) | ✅ |
| Notifications (centre, live banners, sounds, Web Push pipeline) | ✅ push needs go-live keys |
| Database (schema, RLS, RPCs, notifications, stats, purge, backups) | ✅ 67 pgTAP tests |
| Supabase project + accounts | ⏳ owner creates the project ([GO_LIVE](docs/GO_LIVE.md)) |
