# Mahroussa Pro

Internal ordering app for **El Mahroussa**: shop → owner → labo (central kitchen).
It replaces the WhatsApp messages, paper register and manual re-typing with one live, tracked order.

> No prices, no payment, no stock. It carries the order and shows each step as it happens.

## How it works

| Role | Does |
|---|---|
| **Shop** (12) | Taps products, picks quantities, sends. Follows status: 🟠 waiting → 🟢 accepted → ready, or 🔴 refused with the reason. |
| **Owner** (+ deputy) | Receives all orders with a push notification. Accepts, reduces or refuses each line, adds a labo note, assigns a team, and follows preparation live. Manages the catalog. |
| **Labo** | Shared tablet, morning/night team. Sees only validated orders, ticks lines, notes anything not completed, closes the order. |

Shops: El Madania, 1er Mai, Sidi Abdelah, Kouba, Rouiba, Birtouta, Boulevard, Aïn Naadja, Bir Mourad Raïs, Bachedjerah, Kitani, Koucha.

## Documentation

| Doc | Content |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Problem, requirements, state machine, release plan, **open questions** |
| [docs/ROLES.md](docs/ROLES.md) | Roles, permission matrix, auth model |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, data model, RPCs, realtime, offline, push |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens, components, screens, accessibility |
| [CLAUDE.md](CLAUDE.md) | Rules for AI-assisted development in this repo |

## Stack

React + TypeScript + Vite PWA · iOS-style UI (Tailwind + Radix + Vaul) · TanStack Query · Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) · Web Push · Cloudflare Pages.

## Getting started

> The app is not scaffolded yet (Phase 0). These commands are the target setup.

```bash
pnpm install
```

```bash
supabase start
```

```bash
supabase db reset
```

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

## Status

Phase 0: planning. See the release plan in [PRD §11](docs/PRD.md#11-release-plan).
