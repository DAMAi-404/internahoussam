# Roles & Permissions

Four roles in V1. Roles are enforced in the **database** (Row-Level Security + `SECURITY DEFINER` functions), not only in the UI. A tampered client gets nothing more than its role allows.

## 1. Role definitions

| Role | Accounts | Identity model | Session |
|---|---|---|---|
| `owner` | 1 | Personal account (email + password, magic-link fallback) | Long-lived; re-auth for sensitive actions (catalog import, user reset) |
| `shop` | 12 (one per shop) | **Shop account**, not a personal one. Login = choose shop + 6-digit PIN | Permanent on the device. Owner can revoke/reset the PIN. |
| `labo` | 1 (the shared tablet) | Device account + **active team** (`morning` / `night`) chosen at shift start | Permanent on the tablet |
| `deputy` | 1 | Personal account, like the owner | Owner's review powers, no catalog editing or account admin (PRD OWN-14) |

**Why shop accounts, not personal ones:** staff turnover is high and managers share phones. A per-shop identity means a new manager only needs the PIN. If per-person accountability is needed later, add an optional "who are you?" picker on top of the shop account, the same pattern as labo teams.

**Why labo is one account with a team stamp:** the tablet is shared, so logging out and back in at each shift would break in practice. The owner still needs to know which team did what. So every labo action records `labo_team_id`, taken from the tablet's active-team setting, and the active team itself is logged as an event when it changes (`labo_team_switched`).

## 2. Permission matrix

✅ allowed · 🔒 own scope only · ❌ denied

### Catalog

| Action | owner | deputy | shop | labo |
|---|---|---|---|---|
| View categories / products / packs | ✅ | ✅ | ✅ active + greyed inactive | ✅ (names only, for display) |
| Create / edit product | ✅ | ❌ | ❌ | ❌ |
| Toggle product / pack availability | ✅ | ✅ | ❌ | ❌ |
| Reorder / hide categories | ✅ | ❌ | ❌ | ❌ |

### Orders

| Action | owner | deputy | shop | labo |
|---|---|---|---|---|
| Create & submit order | ❌ | ❌ | 🔒 own shop | ❌ |
| Edit / delete until sent to labo (`submitted`, `in_review`) | ❌ | ❌ | 🔒 own shop | ❌ |
| Add note to an order or line (review, and after validation until `ready`) | ✅ | ✅ | ❌ | ❌ |
| Change quantities after validation | ❌ | ❌ | ❌ | ❌ |
| View orders | ✅ all | ✅ all | 🔒 own shop | 🔒 only `validated` / `in_preparation` / `ready` (+ recent history) |
| See refused lines + reasons | ✅ | ✅ | 🔒 own | ❌ (hidden) |
| See owner's note to labo | ✅ | ✅ | ❌ | ✅ |
| See shop's note to owner | ✅ | ✅ | 🔒 own | ❌ |
| Start review / decide lines / validate / refuse | ✅ | ✅ | ❌ | ❌ |
| Assign labo team | ✅ | ✅ | ❌ | ❌ |
| Cancel validated (not started) order | ✅ | ✅ | ❌ | ❌ |
| Tick line / partial / not done + note | ❌ | ❌ | ❌ | ✅ |
| Close order (`ready`) | ❌ | ❌ | ❌ | ✅ |
| Confirm received | ❌ | ❌ | 🔒 own | ❌ |
| View event timeline | ✅ | ✅ | 🔒 own (simplified) | ❌ |
| Share order as text | ✅ | ✅ | 🔒 own | ❌ |

### Statistics & notifications

| Action | owner | deputy | shop | labo |
|---|---|---|---|---|
| View statistics (Activité) | ✅ all shops | ✅ all shops | 🔒 own shop | ❌ |
| Daily recap (shareable text) | ✅ | ✅ | ❌ | ❌ |
| Read / mark own notifications | 🔒 own | 🔒 own | 🔒 own | 🔒 own (device) |

### Administration

| Action | owner | deputy | shop | labo |
|---|---|---|---|---|
| Reset shop PIN / revoke device | ✅ | ❌ | ❌ | ❌ |
| Edit labo team schedules | ✅ | ❌ | ❌ | ❌ |
| Switch active labo team | ❌ | ❌ | ❌ | ✅ with team PIN (logged) |
| Set team PINs | ✅ | ❌ | ❌ | ❌ |
| Manage refusal-reason presets | ✅ | ❌ | ❌ | ❌ |
| Edit or delete `order_events` | ❌ | ❌ | ❌ | ❌ — **nobody**. The only deletion is the nightly 30-day retention job (runs as the database, not as a user). |

## 3. Enforcement

0. **Reviewer = owner or deputy.** Every review RPC accepts `auth_role() in ('owner','deputy')` and stores `reviewed_by`, so the trail shows which person decided.
1. **Profile row per auth user:** `profiles(user_id, role, shop_id)`. `shop_id` is required when `role = 'shop'` and null otherwise (CHECK constraint).
2. **Helper functions** used by every policy: `auth_role()` and `auth_shop_id()`, which read `profiles` and are `STABLE SECURITY DEFINER`.
3. **Reads:** RLS `SELECT` policies per table, following the matrix above.
4. **Writes:** clients have **no direct `INSERT/UPDATE/DELETE`** on `orders`, `order_lines` or `order_events`. Every mutation is an RPC (see [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-server-functions-rpc)) that checks role, scope, current state and `version`, then writes the change and the event together.
5. **Catalog writes:** owner only, through RLS `INSERT/UPDATE` policies. Products are never hard-deleted (`active = false`).
6. **Tests:** every cell of the matrix above has a pgTAP test (`supabase/tests/rls_*.sql`). A matrix change without a test change fails review.

## 4. Shop PIN login: how it works on top of Supabase Auth

Supabase Auth expects email + password. We map each shop to a synthetic login:

- email: `shop-<slug>@auth.mahroussa.internal` (never shown to anyone)
- password: the 6-digit PIN, combined with a server-side pepper inside an Edge Function `shop-login` that rate-limits attempts (5 tries per 15 minutes per shop)

The user sees: **a list of the 12 shop names → keypad → done.** This happens once per device.

Trade-off: a 6-digit PIN is weak on its own. It is acceptable here because (a) the endpoint is rate-limited, (b) the data has no financial value, (c) the owner can revoke a device at any time, and (d) the alternative (real passwords) would mean the shops don't use the app at all.
