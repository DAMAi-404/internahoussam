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

React 18 + TypeScript + Vite (PWA) · Tailwind CSS · TanStack Query · Zustand + IndexedDB · i18next (fr/ar) · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) · Web Push · Cloudflare Pages.

## Getting started

Requires Node 20+ and pnpm. The database part also needs the Supabase CLI and Docker.

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

Checks:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Database (from Phase 0 step 2):

```bash
supabase start
```

```bash
supabase db reset
```

## Status

**Phase 0 (foundations)**: docs v1.0 and the app scaffold are done. The database schema, RLS and RPCs come next. See [PRD §11](docs/PRD.md#11-release-plan).
