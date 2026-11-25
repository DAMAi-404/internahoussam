# Design System

Mahroussa Pro is used by busy, low-patience people on cheap phones and on a floury kitchen tablet. The system optimises for **speed of recognition and zero ambiguity**, not visual novelty.

## 1. Principles

1. **One screen, one job.** Each screen has a single primary action, placed where the thumb rests (the bottom).
2. **Tap, don't type.** Quick buttons first. A typed quantity is a fallback the owner enables per product.
3. **Pictures and words together.** Product photo + name. Status = colour + icon + word, never colour alone (colour-blind users, sunlight glare).
4. **Instant feedback.** Every tap responds within 100 ms (optimistic UI + haptic tick). Every network action ends in a visible success or failure state.
5. **Forgiving.** Undo instead of "are you sure?", except for irreversible actions (send order, validate, close).
6. **Same thing, same place.** Status colours, buttons and the quantity sheet behave identically on every screen and for every role.
7. **RTL-native.** Arabic is a first-class layout, not a mirrored afterthought.

## 2. Colour tokens

Brand colours are **placeholders** until El Mahroussa's identity is provided.

```css
:root {
  /* brand (placeholder) */
  --brand-600: #B4235A;   /* primary actions */
  --brand-700: #8F1C48;   /* pressed */
  --brand-50:  #FCE8F0;   /* tint backgrounds */

  /* neutrals */
  --bg:        #F7F7F8;
  --surface:   #FFFFFF;
  --border:    #E4E4E7;
  --text:      #18181B;   /* 16.1:1 on surface */
  --text-muted:#52525B;   /*  7.7:1 on surface */

  /* status: fixed meaning across the app */
  --pending-600: #C2410C;  --pending-50: #FFF1E6;   /* 🟠 En attente  */
  --ok-600:      #15803D;  --ok-50:      #E8F7EE;   /* 🟢 Acceptée    */
  --refused-600: #B91C1C;  --refused-50: #FDECEC;   /* 🔴 Refusée     */
  --info-600:    #1D4ED8;  --info-50:    #E8EFFD;   /* owner/labo: en préparation */
  --neutral-600: #52525B;  --neutral-50: #F4F4F5;   /* ⚪ Annulée     */
  --warn-600:    #A16207;  --warn-50:    #FEF6E0;   /* reduced qty, partial line */
}
```

The status `-600` colours are chosen for **≥ 4.5:1 contrast as text on white** (the orange is a deep `#C2410C`, not a bright amber, for that reason). Large status pills use the `-50` background with `-600` text and icon.

| Status | Token | Icon (Lucide) | FR | AR |
|---|---|---|---|---|
| submitted / in_review | `pending` | `clock` | En attente | في الانتظار |
| validated | `ok` | `check-circle` | Acceptée | مقبولة |
| in_preparation | `ok` (shop) / `info` (owner, labo) | `chef-hat` | En préparation | قيد التحضير |
| ready | `ok` | `package-check` | Prête | جاهزة |
| received | `ok` (muted) | `check-check` | Reçue | تم الاستلام |
| refused | `refused` | `x-circle` | Refusée | مرفوضة |
| cancelled | `neutral` | `ban` | Annulée | ملغاة |

Line-level badges: **Réduite** (`warn`, shows `10 → 6`), **Refusée** (`refused` + reason), **Partiel** / **Non fait** (`warn` / `refused` + labo note).

Dark mode: not in V1. Tokens are named semantically so it can be added without touching components.

## 3. Typography

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 28 / 34 | 700 | Screen totals, labo order header |
| `title` | 20 / 28 | 700 | Screen titles, shop name on cards |
| `body-lg` | 18 / 26 | 500 | Product names, line items (**shop default**) |
| `body` | 16 / 24 | 400 | General text, never smaller for content |
| `caption` | 14 / 20 | 500 | Timestamps, secondary meta |

Labo tablet scale: multiply by **1.25** (read from about 1 m away).

**Font:** `IBM Plex Sans Arabic`, which covers Arabic and Latin in one family with matching metrics. Self-hosted (offline), weights 400/500/700 only. Numbers use **Western digits (0-9)** in both languages: they are what Algerian shop staff use for quantities.

## 4. Spacing, radius, elevation

- Spacing scale (4 px base): `4, 8, 12, 16, 24, 32, 48`. Screen padding is 16. Gap between cards is 12.
- Radius: `8` (inputs, chips), `12` (cards), `20` (bottom sheets, top corners), `full` (pills, FAB).
- Elevation: only 2 levels: `card` (`0 1px 2px rgb(0 0 0 / .06)`) and `overlay` (sheet/dialog, `0 8px 24px rgb(0 0 0 / .16)`).

## 5. Touch & layout

| Rule | Shop / Owner (phone) | Labo (tablet) |
|---|---|---|
| Min touch target | **48 × 48 px** | **64 × 64 px** |
| Primary button height | 56 px, full width, bottom-anchored | 72 px |
| Gap between adjacent targets | ≥ 8 px | ≥ 12 px |
| Layout | 1 column; product grid with 2 columns | 2–3 order columns, landscape |

Use CSS **logical properties** only (`ps-4`, `me-2`, `start-0`, `text-start`). `left/right` utilities are banned by lint. Icons with direction (arrows, chevrons) flip in RTL. Number + unit groups (`250 g`) are wrapped in `dir="ltr"` / `<bdi>` so they never reorder.

## 6. Core components

| Component | Purpose | Key states / notes |
|---|---|---|
| `Button` | primary / secondary / ghost / danger | default, pressed, loading (spinner, keeps width), disabled. One primary per screen. |
| `StatusPill` | Order status | Driven by `order_status` + role → token/icon/label from §2. **The only way to show a status.** |
| `CategoryTile` | Shop home | Icon + FR/AR name, 2-col grid, ≥ 96 px tall |
| `ProductCard` | Product grid | Photo (1:1, placeholder icon if none), name, "in cart" badge with quantity. Inactive: 40% opacity + "Indisponible". |
| `QuantitySheet` | Bottom sheet to choose quantity | Renders by `quantity_mode`: **count** stepper + quick chips · **weight/volume** quick chips + optional numeric keypad with unit suffix · **pack** variant chips (inactive ones hidden) + stepper. Primary button: "Ajouter" / "Mettre à jour". |
| `QuantityStepper` | − value + | Long-press repeats. Respects min/max/step. Value is tappable to type if allowed. |
| `QuickChip` | Preset quantities | Single tap = set value. Selected state = brand fill. |
| `CartBar` | Sticky bottom bar | "3 articles · Voir / Envoyer". Hidden when the cart is empty. Shows outbox badge if sending is pending. |
| `OrderCard` | Lists for all roles | Shop name (owner/labo) or order code (shop), time ago, line count, `StatusPill`, progress bar (labo/owner). |
| `LineDecisionRow` | Owner review | Product + requested qty, 3-segment control **Accepter / Réduire / Refuser**. Réduire opens the stepper inline. Refuser opens reason chips + text. |
| `PrepLineRow` | Labo | Large checkbox (64 px) + name + approved qty (display size). Overflow menu: Partiel / Non fait → note sheet (required). |
| `ReasonPicker` | Refusal / labo notes | Preset chips first, free text second |
| `Toast` | Feedback | success (2 s), error (persistent until dismissed, with "Réessayer"), offline/queued |
| `EmptyState` | No orders / empty cart | Illustration-free: icon + one sentence + one action |
| `ConnectionBanner` | Offline indicator | Top bar, `warn`: "Hors ligne — vos actions seront envoyées" |

## 7. Key screens (wireframe level)

**Shop: home**
```
┌───────────────────────────┐
│ El Madania        🔔  ☰   │
│ [🔍 Rechercher un produit] │
│ Souvent commandés  →      │
│ [🍦][🥞][🍕][🧃] …          │
│ ┌──────┐ ┌──────┐          │
│ │Glaces│ │Crêpes│  … 10    │
│ └──────┘ └──────┘          │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ 4 articles      [Envoyer ▸]│  ← CartBar
└───────────────────────────┘
```

**Shop: QuantitySheet (weight mode)**
```
│ Pistache                     │
│ [250 g] [500 g] [1 kg]       │
│ Autre:  [   750   ] g        │
│ [        Ajouter        ]    │
```

**Owner: review**
```
│ Kouba · il y a 6 min   🟠    │
│ Cornet x 200   [✓|−|✕]       │
│ Crème 10 L x 2 [✓|−|✕]       │
│ Pistache 1 kg  [✓|−|✕]       │
│ Note labo: [__________]      │
│ Équipe: (Matin) Nuit         │
│ [Tout accepter & envoyer]    │
```

**Labo: tablet (landscape)**
```
│ Équipe NUIT ▾                     🔔 2 nouvelles │
│ ┌ Kouba 3/5 ──┐ ┌ Rouiba 0/4 ─┐ ┌ Kitani ─┐      │
│ │☑ Cornet 200 │ │☐ …          │ │ …       │      │
│ │☐ Crème 10L×2│ │             │ │         │      │
│ │ [Clôturer]  │ │             │ │         │      │
```

## 8. Motion, sound, haptics

- Durations: 150 ms (press, chip), 200 ms (sheet in/out), 250 ms (page). Easing `cubic-bezier(.2,.8,.2,1)`. All disabled under `prefers-reduced-motion`.
- Haptics (`navigator.vibrate`, Android only): 10 ms on add-to-cart, 30 ms on send success.
- Sounds: owner "new order" chime. Labo alarm repeats every 10 s until acknowledged. Volume controls are in settings.

## 9. Content & tone

- Short, concrete, imperative. "Envoyer la commande", not "Soumettre".
- Errors say **what happened + what to do**: "Pas de connexion. La commande sera envoyée automatiquement."
- Never show technical terms (UUID, sync, RPC, 409).
- Product names come from the owner and are shown exactly as entered.

## 10. Accessibility checklist (per screen, before merge)

- [ ] All targets meet §5 sizes
- [ ] Text contrast ≥ 4.5:1 (≥ 3:1 for ≥ 24 px)
- [ ] Status shown with icon + text
- [ ] Works in `dir="rtl"` and `dir="ltr"` with no overlap or truncation
- [ ] Usable at 200% system font size
- [ ] Every icon-only button has an `aria-label` in both languages
