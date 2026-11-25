# Design System: "iOS-native"

Mahroussa Pro should feel like an app Apple shipped: calm, precise and obvious. The reference is Apple's **Human Interface Guidelines (HIG)**, adapted for busy shop staff on any phone (iPhone *and* Android) and a floury kitchen tablet.

> Visual preview (8 screens: shop, owner, labo, tokens): https://claude.ai/artifact/F55nzxpUY1sDbQFMYRY5QQ (private until shared). If the preview and this file disagree, this file wins.

## 1. Principles

1. **Clarity over decoration.** White space, one accent colour, content first. No gradients, no heavy shadows, no illustrations.
2. **One screen, one job.** A large title says where you are. One primary button sits at the bottom, under the thumb.
3. **Tap, don't type.** Quick chips first. A typed quantity is a fallback the owner enables per product.
4. **Status is unmistakable.** Colour + SF-style icon + word, never colour alone.
5. **Direct manipulation.** Sheets you can drag down, rows you tap, toggles you flip. Every touch reacts within 100 ms.
6. **Same thing, same place.** Status pills, sheets and buttons behave identically for every role.
7. **RTL-native.** Arabic is a first-class layout. iOS mirrors its UI in Arabic, and so do we.

## 2. Typography

### Font stack

```css
--font: -apple-system, BlinkMacSystemFont, "Inter", "IBM Plex Sans Arabic", system-ui, sans-serif;
--font-rounded: ui-rounded, -apple-system, "Inter", "IBM Plex Sans Arabic", sans-serif; /* numbers in steppers & badges */
```

| Device | What renders | Download |
|---|---|---|
| iPhone / iPad / Mac | **SF Pro + SF Arabic** (the real iOS system fonts) | none |
| Android / Windows | **Inter** (Latin, closest open match to SF) + **IBM Plex Sans Arabic** | self-hosted WOFF2, loaded only on those devices, cached offline |

**Why not ship SF Pro everywhere:** Apple's font licence only allows SF on Apple platforms. The system stack gives the real thing on iPhones and a very close match elsewhere, legally.

Digits: Western (0-9) in both languages. Quantities use `font-variant-numeric: tabular-nums` so columns align.

### Type scale (iOS Dynamic Type "Large" defaults)

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `largeTitle` | 34 / 41 | 700 | Top of each main screen ("Commander", "Commandes") |
| `title1` | 28 / 34 | 700 | Labo order header, sheet titles |
| `title2` | 22 / 28 | 700 | Shop name on owner cards |
| `title3` | 20 / 25 | 600 | Section headings |
| `headline` | 17 / 22 | 600 | Row titles, product names, buttons |
| `body` | 17 / 22 | 400 | **Default text** |
| `callout` | 16 / 21 | 400 | Notes, secondary rows |
| `subheadline` | 15 / 20 | 400 | Meta (time ago, line count) |
| `footnote` | 13 / 18 | 400 | Section footers, timestamps. **The smallest size allowed.** |

The iOS `caption` sizes (11–12 px) are **not used**: too small for this audience. Labo tablet: every size × 1.25. Respect the user's system text size (`rem`-based) up to 200%.

## 3. Colour

iOS semantic system colours. Each colour has a **vibrant** value (fills, icons, large shapes) and an **accessible** value (text on white, ≥ 4.5:1). These are Apple's published "increased contrast" variants.

```css
:root {
  /* backgrounds (iOS grouped style) */
  --bg-grouped:     #F2F2F7;   /* systemGroupedBackground: screen */
  --bg-cell:        #FFFFFF;   /* secondarySystemGroupedBackground: rows/cards */
  --fill:           rgb(120 120 128 / .12); /* tertiarySystemFill: chips, segmented track */
  --separator:      rgb(60 60 67 / .29);    /* hairline, 0.5px on retina */

  /* labels */
  --label:          #000000;
  --label-2:        #6C6C70;                /* secondary text: solid, not iOS's 60% alpha, so it passes 4.5:1 on both white and #F2F2F7 */
  --label-3:        rgb(60 60 67 / .30);    /* placeholders, disabled */

  /* accent: brand placeholder until El Mahroussa colours are provided */
  --accent:         #007AFF;   /* systemBlue (default iOS tint) */
  --accent-text:    #0040DD;

  /* status: fixed meaning everywhere */
  --pending:        #FF9500;  --pending-text: #C93400;  /* 🟠 En attente */
  --ok:             #34C759;  --ok-text:      #248A3D;  /* 🟢 Acceptée   */
  --refused:        #FF3B30;  --refused-text: #D70015;  /* 🔴 Refusée    */
  --info:           #5856D6;  --info-text:    #3634A3;  /* indigo: en préparation (owner/labo) */
  --warn:           #FFCC00;  --warn-text:    #A05A00;  /* reduced qty / partial line */
  --neutral:        #8E8E93;  --neutral-text: #636366;  /* ⚪ Annulée */
}

@media (prefers-color-scheme: dark) {           /* P1: follows the system setting */
  :root {
    --bg-grouped: #000000; --bg-cell: #1C1C1E; --fill: rgb(118 118 128 / .24);
    --separator: rgb(84 84 88 / .6);
    --label: #FFFFFF; --label-2: rgb(235 235 245 / .6); --label-3: rgb(235 235 245 / .3);
    --accent: #0A84FF; --accent-text: #409CFF;
    --pending: #FF9F0A; --ok: #30D158; --refused: #FF453A; --info: #5E5CE6; --warn: #FFD60A;
    /* in dark mode the vibrant colours are used for text too (they pass on #1C1C1E) */
  }
}
```

**Accent colour decision:** iOS blue is the placeholder. If El Mahroussa has a brand colour, it replaces `--accent` only. Status colours never change. Avoid an orange, green or red brand accent, because it would clash with the status meanings.

### Status mapping

| Status | Colour | Icon (Lucide ≈ SF Symbol) | FR | AR |
|---|---|---|---|---|
| submitted / in_review | `pending` | `clock` ≈ clock.fill | En attente | في الانتظار |
| validated | `ok` | `circle-check` ≈ checkmark.circle.fill | Acceptée | مقبولة |
| in_preparation | `ok` (shop) / `info` (owner, labo) | `chef-hat` | En préparation | قيد التحضير |
| ready | `ok` | `package-check` ≈ shippingbox.fill | Prête à récupérer | جاهزة للاستلام |
| received | `neutral` | `check-check` | Reçue | تم الاستلام |
| refused | `refused` | `circle-x` ≈ xmark.circle.fill | Refusée | مرفوضة |
| cancelled | `neutral` | `ban` | Annulée | ملغاة |

Pill style: background = status colour at 15% opacity, text and icon = `-text` value, `headline` weight, fully rounded corners.

## 4. Shape, spacing, depth

- **Spacing** (4 pt grid): `4, 8, 12, 16, 20, 24, 32`. Screen side margin is **16** (iOS default); inset grouped lists use **16** inset.
- **Corner radius:** buttons and fields `12`, cells and cards `12` (inset grouped), sheets `16` on the top corners, chips and pills `full`, product photos `10`, app icon style tiles `22%`.
  - Progressive enhancement: `corner-shape: squircle` where the browser supports it, for Apple's "continuous corners". Otherwise plain `border-radius`.
- **Hairlines:** separators are `0.5px` on 2× and 3× screens (`1px` otherwise), inset to align with the text, not the cell edge, exactly as in iOS lists.
- **Depth:** iOS is flat. Only two levels:
  - `bar`: translucent material: `background: rgb(249 249 249 / .8); backdrop-filter: saturate(180%) blur(20px);` used for the nav bar, tab bar and cart bar.
  - `sheet`: `0 -1px 0 var(--separator), 0 10px 40px rgb(0 0 0 / .18)` with a dimmed backdrop (`rgb(0 0 0 / .4)`).

## 5. Layout & touch

| Rule | Phone (shop, owner, deputy) | Labo tablet |
|---|---|---|
| Min touch target | **44 × 44 pt** (HIG); we use **48** for shop rows | **64 × 64** |
| Primary button | 50 pt tall, full width minus 16 margins, radius 12 | 64 pt |
| Navigation | **Large-title nav bar** (collapses to inline on scroll) + **tab bar** | Fixed header + columns |
| Safe areas | `viewport-fit=cover`; pad with `env(safe-area-inset-*)` | same |

Tab bars:
- **Shop:** `Commander` · `Mes commandes` (badge = orders awaiting action)
- **Owner / deputy:** `À valider` (badge) · `En cours` · `Historique` · `Catalogue` (owner only)
- **Labo:** no tab bar. One board.

RTL: logical CSS properties only (`ps-4`, `me-2`, `start-0`). Chevrons and back arrows flip. Number+unit groups (`250 g`) are wrapped in `<bdi>`.

## 6. Components

All components live in `src/components/ui`. Feature code never restyles them.

| Component | iOS reference | Spec |
|---|---|---|
| `NavBar` | UINavigationBar large title | Large title 34 pt, collapses on scroll, translucent `bar` material, trailing icon buttons 44 pt |
| `TabBar` | UITabBar | 49 pt + safe area, icon 24 + label 10 pt *(the single exception to the 13 pt minimum, as in iOS)*, active = accent, badge = `refused` red |
| `Button` | Filled / tinted / plain | **filled** (accent bg, white text, the one primary action) · **tinted** (accent at 15% opacity, accent text) · **plain** (text only) · **destructive** (red). Pressed: opacity .7, scale .98, 100 ms. Loading: spinner replaces the label, width is kept. No ripples. |
| `List` / `Cell` | Inset grouped table view | White cells on a grey background, radius 12, hairline separators, optional leading icon in a 29 pt rounded square, trailing value / chevron / toggle. Section header in `footnote` uppercase `label-2`. |
| `SearchField` | UISearchBar | `fill` background, radius 10, magnifier icon, 36 pt tall, "Annuler" appears on focus |
| `CategoryTile` | Springboard-ish tile | 2-col grid, icon in a tinted rounded square, name in `headline`, 96 pt tall |
| `ProductCell` | List row with thumbnail | 56 pt photo (radius 10) + name + unit hint. When in the cart: trailing count badge in accent. Inactive: `label-3` text + "Indisponible". |
| `Sheet` | UISheetPresentationController (via **Vaul**) | Grabber 36 × 5, detents **medium / large**, drag to dismiss with rubber-band, spring `stiffness 400, damping 40` |
| `QuantitySheet` | — | Product photo + name. By mode: **count** → `Stepper` + chips · **weight/volume** → chips (`250 g` `500 g` `1 kg`) + "Autre quantité" opening a numeric keypad with unit suffix · **pack** → `SegmentedControl` of active packs + `Stepper`. Big filled "Ajouter" button. |
| `Stepper` | UIStepper, enlarged | − / + as 44 pt circles in `fill`, value in rounded font 28 pt between them. Long-press repeats. Respects min/max/step. |
| `Chip` | iOS 17 filter chips | `fill` background, selected = accent fill + white text, 36 pt tall |
| `SegmentedControl` | UISegmentedControl | `fill` track, white sliding thumb with a small shadow, 32 pt (40 on owner review). Used for pack choice and **Accepter / Réduire / Refuser**. |
| `Toggle` | UISwitch | 51 × 31, green `ok` when on. Used for product and pack availability. |
| `StatusPill` | — | See §3. **The only way to show a status.** |
| `OrderCell` | Mail-style row | Leading status dot, title (shop or order code), `subheadline` meta, trailing time ago, progress ring for orders in preparation |
| `ActionSheet` | UIAlertController action sheet | For irreversible confirmations (send, validate, close order, cancel). Destructive option in red. Cancel button separated. |
| `Alert` | UIAlertController alert | Rare: blocking errors only |
| `Banner` | Notification banner | Top, rounded, `bar` material, auto-hide 3 s: "Commande envoyée ✓", "Hors ligne · sera envoyée" |
| `CartBar` | Translucent bottom bar above the tab bar | "4 articles" + filled "Envoyer" button. Shows an outbox badge while sending is pending. |
| `ShareButton` | iOS share sheet | `navigator.share({ text })` opens the native share sheet (WhatsApp etc.). Fallback: copy to clipboard + banner "Copié". |
| `EmptyState` | iOS ContentUnavailableView | SF-style icon 48 pt in `label-3`, `title3` heading, one sentence, one tinted button |

## 7. Motion & feedback

- **Springs, not easings:** sheets and page pushes use spring physics (Motion library: `type: "spring", stiffness: 400, damping: 40`). Small state changes use 200 ms `cubic-bezier(.25,.1,.25,1)`.
- **Navigation:** push slides in from the trailing edge (from the left in RTL), the previous page shifts 30% with dimming, as in UINavigationController. Swipe from the edge to go back (iOS PWAs need this implemented by hand).
- **Add to cart:** a +1 badge pops (scale 1 → 1.2 → 1) on the cart bar.
- **Send success:** the button morphs into a check, then a banner appears.
- **Haptics:** `navigator.vibrate(10)` on Android. iOS Safari has no vibration API, so the visual feedback must be enough on its own.
- `prefers-reduced-motion`: springs become 150 ms fades.
- **Sounds:** owner/deputy "new order" chime. Labo alarm repeats every 10 s until acknowledged.

## 8. PWA polish (what makes it feel installed, not "a website")

- `display: standalone`, `theme-color` matching `--bg-grouped`, `apple-mobile-web-app-status-bar-style: default`, splash screens for common iPhone sizes, a proper app icon (iOS rounding is applied by the OS).
- No browser behaviour leaks: `-webkit-tap-highlight-color: transparent`, `user-select: none` on controls, `overscroll-behavior-y: contain` on scroll containers, no pull-to-refresh inside sheets.
- Inputs ≥ 16 px (otherwise iOS zooms on focus). Correct `inputmode="numeric"` for quantities and PINs.
- Skeleton rows (grey rounded blocks) while loading, never a full-screen spinner.

## 9. Content & tone

- Short, concrete, imperative. "Envoyer la commande", not "Soumettre".
- **No ambiguous verbs.** Before a label ships, ask: "could a tired manager misread this?" ("Recommander" was rejected for this reason.)
- Errors say what happened and what to do: "Pas de connexion. La commande sera envoyée automatiquement."
- Never show technical terms (UUID, sync, RPC, 409).

## 10. Accessibility checklist (per screen, before merge)

- [ ] Targets meet §5 sizes
- [ ] Text uses `-text` status values on light backgrounds (≥ 4.5:1)
- [ ] Status shown with icon + text
- [ ] Correct in `dir="rtl"` (ar) and `dir="ltr"` (fr) at 360 px width
- [ ] Usable at 200% text size
- [ ] Icon-only buttons have `aria-label` in both languages
- [ ] Light mode verified (dark mode once P1 ships)
